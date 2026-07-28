-- Permite que profissionais do cadastro operacional usem a mesma assinatura
-- gráfica privada já disponível para usuários internos.
ALTER TABLE public.execucao_profissionais
  ADD COLUMN IF NOT EXISTS assinatura_modo text NOT NULL DEFAULT 'em_branco',
  ADD COLUMN IF NOT EXISTS assinatura_storage_path text,
  ADD COLUMN IF NOT EXISTS assinatura_nome_arquivo text,
  ADD COLUMN IF NOT EXISTS assinatura_mime_type text,
  ADD COLUMN IF NOT EXISTS assinatura_hash_sha256 text,
  ADD COLUMN IF NOT EXISTS assinatura_carregada_por uuid,
  ADD COLUMN IF NOT EXISTS assinatura_carregada_em timestamptz,
  ADD COLUMN IF NOT EXISTS assinatura_ativa boolean NOT NULL DEFAULT false;

ALTER TABLE public.execucao_profissionais
  DROP CONSTRAINT IF EXISTS execucao_profissionais_assinatura_modo_check;
ALTER TABLE public.execucao_profissionais
  ADD CONSTRAINT execucao_profissionais_assinatura_modo_check
  CHECK (assinatura_modo IN ('em_branco', 'imagem'));

ALTER TABLE public.execucao_profissionais
  DROP CONSTRAINT IF EXISTS execucao_profissionais_assinatura_mime_type_check;
ALTER TABLE public.execucao_profissionais
  ADD CONSTRAINT execucao_profissionais_assinatura_mime_type_check
  CHECK (assinatura_mime_type IS NULL OR assinatura_mime_type IN ('image/png', 'image/jpeg'));

CREATE OR REPLACE FUNCTION public.psico_guard_assinatura_profissional()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(auth.jwt()->>'role', '') <> 'service_role' AND (
    OLD.assinatura_modo IS DISTINCT FROM NEW.assinatura_modo OR
    OLD.assinatura_storage_path IS DISTINCT FROM NEW.assinatura_storage_path OR
    OLD.assinatura_nome_arquivo IS DISTINCT FROM NEW.assinatura_nome_arquivo OR
    OLD.assinatura_mime_type IS DISTINCT FROM NEW.assinatura_mime_type OR
    OLD.assinatura_hash_sha256 IS DISTINCT FROM NEW.assinatura_hash_sha256 OR
    OLD.assinatura_carregada_por IS DISTINCT FROM NEW.assinatura_carregada_por OR
    OLD.assinatura_carregada_em IS DISTINCT FROM NEW.assinatura_carregada_em OR
    OLD.assinatura_ativa IS DISTINCT FROM NEW.assinatura_ativa
  ) THEN
    RAISE EXCEPTION 'ASSINATURA_ALTERACAO_SOMENTE_VIA_FLUXO_SEGURO';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tg_execucao_profissionais_guard_assinatura
  ON public.execucao_profissionais;
CREATE TRIGGER tg_execucao_profissionais_guard_assinatura
BEFORE UPDATE ON public.execucao_profissionais
FOR EACH ROW EXECUTE FUNCTION public.psico_guard_assinatura_profissional();

CREATE OR REPLACE FUNCTION public.psico_aprovar_revisao_tecnica(
  p_revisao_id uuid,
  p_confirmacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev record;
  v_val jsonb;
  v_esperado text;
  v_snap jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  SELECT r.*, a.codigo AS avaliacao_codigo
    INTO v_rev
    FROM public.psico_revisoes_tecnicas r
    JOIN public.psico_avaliacoes a ON a.id = r.avaliacao_id
   WHERE r.id = p_revisao_id
   FOR UPDATE OF r;

  IF NOT FOUND THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  v_esperado := 'APROVAR ' || v_rev.avaliacao_codigo;
  IF p_confirmacao <> v_esperado THEN
    RAISE EXCEPTION 'CONFIRMACAO_INVALIDA: use "%"', v_esperado;
  END IF;
  IF v_rev.status = 'aprovada' THEN RAISE EXCEPTION 'REVISAO_JA_APROVADA'; END IF;

  v_val := public.psico_validar_revisao_tecnica(p_revisao_id);
  IF COALESCE((v_val->>'valido')::boolean, false) = false THEN
    RAISE EXCEPTION 'CHECKLIST_INCOMPLETO: %', v_val->>'erros';
  END IF;

  SELECT jsonb_strip_nulls(jsonb_build_object(
    'nome', COALESCE(NULLIF(BTRIM(nome), ''), email),
    'cargo', NULLIF(BTRIM(cargo), ''),
    'registro_profissional', NULLIF(BTRIM(registro_profissional), ''),
    'origem', 'perfil',
    'aprovado_em', now(),
    'assinatura_modo', assinatura_modo,
    'assinatura_storage_path',
      CASE WHEN assinatura_modo = 'imagem' AND assinatura_ativa THEN assinatura_storage_path END,
    'assinatura_mime_type',
      CASE WHEN assinatura_modo = 'imagem' AND assinatura_ativa THEN assinatura_mime_type END,
    'assinatura_hash_sha256',
      CASE WHEN assinatura_modo = 'imagem' AND assinatura_ativa THEN assinatura_hash_sha256 END
  ))
    INTO v_snap
    FROM public.profiles
   WHERE id = v_rev.responsavel_tecnico_id;

  IF v_snap IS NULL THEN
    SELECT jsonb_strip_nulls(jsonb_build_object(
      'nome', NULLIF(BTRIM(nome), ''),
      'cargo', NULLIF(BTRIM(cargo), ''),
      'registro_profissional', NULLIF(BTRIM(registro_profissional), ''),
      'origem', 'profissional',
      'aprovado_em', now(),
      'assinatura_modo', assinatura_modo,
      'assinatura_storage_path',
        CASE WHEN assinatura_modo = 'imagem' AND assinatura_ativa THEN assinatura_storage_path END,
      'assinatura_mime_type',
        CASE WHEN assinatura_modo = 'imagem' AND assinatura_ativa THEN assinatura_mime_type END,
      'assinatura_hash_sha256',
        CASE WHEN assinatura_modo = 'imagem' AND assinatura_ativa THEN assinatura_hash_sha256 END
    ))
      INTO v_snap
      FROM public.execucao_profissionais
     WHERE id = v_rev.responsavel_tecnico_id
       AND situacao = 'ativo';
  END IF;

  IF v_snap IS NULL THEN
    RAISE EXCEPTION 'RESPONSAVEL_TECNICO_NAO_LOCALIZADO';
  END IF;

  UPDATE public.psico_revisoes_tecnicas
     SET status = 'aprovada',
         aprovada_por = auth.uid(),
         aprovada_em = now(),
         responsavel_snapshot = v_snap,
         atualizada_por = auth.uid()
   WHERE id = p_revisao_id;

  UPDATE public.psico_planos_acao
     SET status = 'aprovado',
         aprovado_em = now(),
         atualizado_por = auth.uid()
   WHERE revisao_id = p_revisao_id;

  INSERT INTO public.psico_auditoria(
    entidade,
    entidade_id,
    acao,
    metadados,
    usuario_id,
    created_at
  )
  VALUES (
    'revisao_tecnica',
    p_revisao_id,
    'revisao_aprovada',
    jsonb_build_object(
      'avaliacao_codigo', v_rev.avaliacao_codigo,
      'itens', v_val->>'itens',
      'parecer_origem', v_rev.parecer_origem,
      'assinatura_modo', v_snap->>'assinatura_modo',
      'responsavel_origem', v_snap->>'origem'
    ),
    auth.uid(),
    now()
  );

  RETURN jsonb_build_object('ok', true, 'status', 'aprovada');
END;
$$;

REVOKE ALL ON FUNCTION public.psico_aprovar_revisao_tecnica(uuid, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_aprovar_revisao_tecnica(uuid, text)
  TO authenticated;
