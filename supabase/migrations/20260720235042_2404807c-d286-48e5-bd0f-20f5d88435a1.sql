
-- 1) Enum de modo de coleta
DO $$ BEGIN
  CREATE TYPE public.psico_modo_coleta AS ENUM ('nominal', 'publico_anonimo');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2) Campos na avaliação
ALTER TABLE public.psico_avaliacoes
  ADD COLUMN IF NOT EXISTS modo_coleta public.psico_modo_coleta NOT NULL DEFAULT 'nominal',
  ADD COLUMN IF NOT EXISTS link_publico_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS campos_identificacao jsonb NOT NULL DEFAULT jsonb_build_object(
    'nome',    jsonb_build_object('ativo', true,  'obrigatorio', true),
    'funcao',  jsonb_build_object('ativo', true,  'obrigatorio', true),
    'setor',   jsonb_build_object('ativo', true,  'obrigatorio', false),
    'unidade', jsonb_build_object('ativo', false, 'obrigatorio', false)
  ),
  ADD COLUMN IF NOT EXISTS registrar_participacao boolean NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS psico_aval_link_publico_idx
  ON public.psico_avaliacoes (link_publico_token) WHERE link_publico_token IS NOT NULL;

-- 3) Tabela de respostas públicas (agregada, sem PII)
CREATE TABLE IF NOT EXISTS public.psico_respostas_publicas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  hash_nome text,
  funcao text,
  setor text,
  unidade text,
  funcao_normalizada text,
  setor_normalizada text,
  unidade_normalizada text,
  respostas jsonb NOT NULL,
  origem_ip_hash text,
  user_agent_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.psico_respostas_publicas TO authenticated;
GRANT ALL ON public.psico_respostas_publicas TO service_role;
ALTER TABLE public.psico_respostas_publicas ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS psico_resp_pub_aval_idx      ON public.psico_respostas_publicas (avaliacao_id);
CREATE INDEX IF NOT EXISTS psico_resp_pub_funcao_idx    ON public.psico_respostas_publicas (avaliacao_id, funcao_normalizada);
CREATE INDEX IF NOT EXISTS psico_resp_pub_setor_idx     ON public.psico_respostas_publicas (avaliacao_id, setor_normalizada);
CREATE INDEX IF NOT EXISTS psico_resp_pub_unidade_idx   ON public.psico_respostas_publicas (avaliacao_id, unidade_normalizada);
CREATE UNIQUE INDEX IF NOT EXISTS psico_resp_pub_dedup_idx
  ON public.psico_respostas_publicas (avaliacao_id, hash_nome)
  WHERE hash_nome IS NOT NULL;

CREATE POLICY "psico_resp_pub_select_interno"
  ON public.psico_respostas_publicas FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));

-- Sem policy de UPDATE/DELETE: registro imutável para respondentes e usuários internos.
-- service_role continua com acesso total via GRANT ALL para operações administrativas.

-- 4) Tabela de registro de participação (nome, sem respostas)
CREATE TABLE IF NOT EXISTS public.psico_registro_participacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  nome_normalizado text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.psico_registro_participacao TO authenticated;
GRANT ALL ON public.psico_registro_participacao TO service_role;
ALTER TABLE public.psico_registro_participacao ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS psico_reg_part_aval_idx ON public.psico_registro_participacao (avaliacao_id);
CREATE UNIQUE INDEX IF NOT EXISTS psico_reg_part_dedup_idx
  ON public.psico_registro_participacao (avaliacao_id, nome_normalizado);

CREATE POLICY "psico_reg_part_select_interno"
  ON public.psico_registro_participacao FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));

-- 5) RPC pública para submeter resposta anônima (chamada pela Edge Function com service_role)
--    Mantida SECURITY DEFINER para permitir inserção sem contexto de usuário autenticado,
--    com deduplicação atômica por hash_nome.
CREATE OR REPLACE FUNCTION public.psico_submeter_resposta_publica(
  p_token text,
  p_hash_nome text,
  p_nome_para_registro text,
  p_funcao text,
  p_setor text,
  p_unidade text,
  p_respostas jsonb,
  p_ip_hash text,
  p_ua_hash text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_aval public.psico_avaliacoes%ROWTYPE;
  v_resposta_id uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
  END IF;

  SELECT * INTO v_aval
    FROM public.psico_avaliacoes
   WHERE link_publico_token = p_token
     AND modo_coleta = 'publico_anonimo';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'avaliacao_nao_encontrada');
  END IF;

  IF v_aval.status NOT IN ('coleta_aberta') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'coleta_fechada');
  END IF;

  IF v_aval.coleta_expira_em IS NOT NULL AND v_aval.coleta_expira_em < now() THEN
    RETURN jsonb_build_object('ok', false, 'error', 'coleta_expirada');
  END IF;

  IF p_respostas IS NULL OR jsonb_typeof(p_respostas) <> 'object' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'respostas_invalidas');
  END IF;

  BEGIN
    INSERT INTO public.psico_respostas_publicas (
      avaliacao_id, hash_nome, funcao, setor, unidade,
      funcao_normalizada, setor_normalizada, unidade_normalizada,
      respostas, origem_ip_hash, user_agent_hash
    ) VALUES (
      v_aval.id,
      NULLIF(p_hash_nome, ''),
      NULLIF(p_funcao, ''),
      NULLIF(p_setor, ''),
      NULLIF(p_unidade, ''),
      NULLIF(lower(unaccent(coalesce(p_funcao, ''))), ''),
      NULLIF(lower(unaccent(coalesce(p_setor, ''))), ''),
      NULLIF(lower(unaccent(coalesce(p_unidade, ''))), ''),
      p_respostas,
      NULLIF(p_ip_hash, ''),
      NULLIF(p_ua_hash, '')
    ) RETURNING id INTO v_resposta_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN jsonb_build_object('ok', false, 'error', 'ja_respondido');
  END;

  IF v_aval.registrar_participacao AND p_nome_para_registro IS NOT NULL AND length(trim(p_nome_para_registro)) > 0 THEN
    BEGIN
      INSERT INTO public.psico_registro_participacao (avaliacao_id, nome, nome_normalizado)
      VALUES (
        v_aval.id,
        trim(p_nome_para_registro),
        lower(unaccent(trim(p_nome_para_registro)))
      );
    EXCEPTION WHEN unique_violation THEN
      -- Já registrado: tudo bem, resposta foi aceita.
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'resposta_id', v_resposta_id);
END;
$$;

REVOKE ALL ON FUNCTION public.psico_submeter_resposta_publica(text,text,text,text,text,text,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_submeter_resposta_publica(text,text,text,text,text,text,jsonb,text,text) TO service_role;

-- 6) RPC para gerar/rotacionar o token do link público (uso interno)
CREATE OR REPLACE FUNCTION public.psico_gerar_link_publico(p_avaliacao_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_token := encode(extensions.gen_random_bytes(24), 'hex');

  UPDATE public.psico_avaliacoes
     SET link_publico_token = v_token,
         modo_coleta = 'publico_anonimo',
         updated_at = now()
   WHERE id = p_avaliacao_id;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.psico_gerar_link_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_gerar_link_publico(uuid) TO authenticated, service_role;
