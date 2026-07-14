
-- FASE 3.1: hardening de edição de participantes + rate limit da rota pública

-- 1) Trigger que bloqueia updates diretos sensíveis após resposta e em avaliação cancelada
CREATE OR REPLACE FUNCTION public.psico_part_bloquear_update_sensivel()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_allow text;
  v_av_status text;
  v_respondido boolean;
BEGIN
  BEGIN
    v_allow := current_setting('psico.allow_update', true);
  EXCEPTION WHEN OTHERS THEN
    v_allow := NULL;
  END;
  IF coalesce(v_allow,'') = 'on' THEN
    RETURN NEW;
  END IF;

  SELECT status::text INTO v_av_status FROM public.psico_avaliacoes WHERE id = NEW.avaliacao_id;
  IF v_av_status = 'cancelada' THEN
    IF NEW.ativo = OLD.ativo THEN
      RAISE EXCEPTION 'Avaliação cancelada: edição de participantes bloqueada.';
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.psico_convites c
    WHERE c.participante_id = NEW.id
      AND (c.status = 'respondido' OR c.respondido_em IS NOT NULL)
  ) INTO v_respondido;

  IF v_respondido THEN
    IF NEW.funcao_normalizada IS DISTINCT FROM OLD.funcao_normalizada
       OR NEW.setor_normalizada IS DISTINCT FROM OLD.setor_normalizada
       OR NEW.unidade_normalizada IS DISTINCT FROM OLD.unidade_normalizada THEN
      RAISE EXCEPTION 'Participante já respondeu: função, setor e unidade não podem ser alterados.';
    END IF;
    IF NEW.ativo = false AND OLD.ativo = true THEN
      RAISE EXCEPTION 'Participante já respondeu: inativação bloqueada por este canal.';
    END IF;
    IF NEW.nome_normalizado IS DISTINCT FROM OLD.nome_normalizado
       OR NEW.email_normalizado IS DISTINCT FROM OLD.email_normalizado
       OR NEW.telefone_normalizado IS DISTINCT FROM OLD.telefone_normalizado THEN
      RAISE EXCEPTION 'Correção administrativa de participante respondido requer fluxo autorizado (RPC segura).';
    END IF;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_psico_part_bloquear_update_sensivel ON public.psico_participantes;
CREATE TRIGGER trg_psico_part_bloquear_update_sensivel
  BEFORE UPDATE ON public.psico_participantes
  FOR EACH ROW EXECUTE FUNCTION public.psico_part_bloquear_update_sensivel();

-- 2) RPC segura para edição
CREATE OR REPLACE FUNCTION public.psico_atualizar_participante(
  _participante_id uuid,
  _nome text,
  _email text,
  _telefone text,
  _funcao text,
  _setor text,
  _unidade text,
  _justificativa text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_uid uuid := auth.uid();
  p record;
  av_status text;
  v_respondido boolean;
  v_admin boolean;
  v_nome text; v_email text; v_tel text; v_func text; v_set text; v_uni text;
  v_nome_n text; v_email_n text; v_tel_n text; v_func_n text; v_set_n text; v_uni_n text;
  v_dup_id uuid;
  v_campos text[] := ARRAY[]::text[];
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'Sem permissão para editar participantes.';
  END IF;
  v_admin := public.has_role(v_uid, 'admin');

  SELECT * INTO p FROM public.psico_participantes WHERE id = _participante_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Participante não encontrado.'; END IF;

  SELECT status::text INTO av_status FROM public.psico_avaliacoes WHERE id = p.avaliacao_id;
  IF av_status = 'cancelada' THEN RAISE EXCEPTION 'Avaliação cancelada: edição bloqueada.'; END IF;
  IF NOT p.ativo THEN RAISE EXCEPTION 'Participante inativo não pode ser editado por este fluxo.'; END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.psico_convites c
    WHERE c.participante_id = p.id AND (c.status = 'respondido' OR c.respondido_em IS NOT NULL)
  ) INTO v_respondido;

  -- Normalização
  v_nome := regexp_replace(btrim(coalesce(_nome, p.nome)), '\s+', ' ', 'g');
  v_email := NULLIF(btrim(coalesce(_email, '')), '');
  v_tel := NULLIF(btrim(coalesce(_telefone, '')), '');
  v_func := NULLIF(regexp_replace(btrim(coalesce(_funcao,'')), '\s+', ' ', 'g'), '');
  v_set := NULLIF(regexp_replace(btrim(coalesce(_setor,'')), '\s+', ' ', 'g'), '');
  v_uni := NULLIF(regexp_replace(btrim(coalesce(_unidade,'')), '\s+', ' ', 'g'), '');

  IF v_nome IS NULL OR length(v_nome) = 0 THEN RAISE EXCEPTION 'Nome é obrigatório.'; END IF;
  IF v_email IS NOT NULL AND v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' THEN RAISE EXCEPTION 'E-mail inválido.'; END IF;
  IF v_tel IS NOT NULL AND length(regexp_replace(v_tel,'\D','','g')) NOT BETWEEN 10 AND 13 THEN
    RAISE EXCEPTION 'Telefone inválido.';
  END IF;

  v_nome_n := coalesce(public.psico_norm_texto(v_nome),'');
  v_email_n := public.psico_norm_email(v_email);
  v_tel_n := public.psico_norm_fone(v_tel);
  v_func_n := public.psico_norm_texto(v_func);
  v_set_n := public.psico_norm_texto(v_set);
  v_uni_n := public.psico_norm_texto(v_uni);

  -- Regras pós-resposta
  IF v_respondido THEN
    IF v_func_n IS DISTINCT FROM p.funcao_normalizada
       OR v_set_n IS DISTINCT FROM p.setor_normalizada
       OR v_uni_n IS DISTINCT FROM p.unidade_normalizada THEN
      RAISE EXCEPTION 'Este participante já concluiu o questionário. Função, setor e unidade não podem ser alterados.';
    END IF;
    IF v_nome_n IS DISTINCT FROM p.nome_normalizado
       OR v_email_n IS DISTINCT FROM p.email_normalizado
       OR v_tel_n IS DISTINCT FROM p.telefone_normalizado THEN
      IF NOT v_admin THEN
        RAISE EXCEPTION 'Correção após resposta é restrita a administradores.';
      END IF;
      IF _justificativa IS NULL OR length(btrim(_justificativa)) < 10 THEN
        RAISE EXCEPTION 'Justificativa obrigatória (mínimo 10 caracteres).';
      END IF;
    END IF;
  END IF;

  -- Duplicidade (excluindo o próprio)
  IF v_email_n IS NOT NULL THEN
    SELECT id INTO v_dup_id FROM public.psico_participantes
     WHERE avaliacao_id = p.avaliacao_id AND ativo = true AND id <> p.id
       AND email_normalizado = v_email_n LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'Existe outro participante ativo com o mesmo e-mail normalizado nesta avaliação.';
    END IF;
  END IF;
  IF v_tel_n IS NOT NULL THEN
    SELECT id INTO v_dup_id FROM public.psico_participantes
     WHERE avaliacao_id = p.avaliacao_id AND ativo = true AND id <> p.id
       AND telefone_normalizado = v_tel_n LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'Existe outro participante ativo com o mesmo telefone normalizado nesta avaliação.';
    END IF;
  END IF;
  IF v_email_n IS NULL AND v_tel_n IS NULL THEN
    SELECT id INTO v_dup_id FROM public.psico_participantes
     WHERE avaliacao_id = p.avaliacao_id AND ativo = true AND id <> p.id
       AND nome_normalizado = v_nome_n
       AND coalesce(funcao_normalizada,'') = coalesce(v_func_n,'')
       AND coalesce(setor_normalizada,'') = coalesce(v_set_n,'')
       AND coalesce(unidade_normalizada,'') = coalesce(v_uni_n,'')
     LIMIT 1;
    IF v_dup_id IS NOT NULL THEN
      RAISE EXCEPTION 'Existe outro participante ativo com nome e segmentação idênticos nesta avaliação.';
    END IF;
  END IF;

  -- Detectar quais campos mudaram (para auditoria sanitizada)
  IF v_nome_n IS DISTINCT FROM p.nome_normalizado THEN v_campos := v_campos || 'nome'; END IF;
  IF v_email_n IS DISTINCT FROM p.email_normalizado THEN v_campos := v_campos || 'email'; END IF;
  IF v_tel_n IS DISTINCT FROM p.telefone_normalizado THEN v_campos := v_campos || 'telefone'; END IF;
  IF v_func_n IS DISTINCT FROM p.funcao_normalizada THEN v_campos := v_campos || 'funcao'; END IF;
  IF v_set_n IS DISTINCT FROM p.setor_normalizada THEN v_campos := v_campos || 'setor'; END IF;
  IF v_uni_n IS DISTINCT FROM p.unidade_normalizada THEN v_campos := v_campos || 'unidade'; END IF;

  -- Autorizar update sensível
  PERFORM set_config('psico.allow_update', 'on', true);

  UPDATE public.psico_participantes
     SET nome = v_nome,
         email = v_email,
         telefone = v_tel,
         funcao = v_func,
         setor = v_set,
         unidade = v_uni,
         atualizado_por = v_uid,
         updated_at = now()
   WHERE id = p.id;

  PERFORM set_config('psico.allow_update', 'off', true);

  IF array_length(v_campos,1) IS NOT NULL THEN
    INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, usuario_id, metadados)
    VALUES ('participante', p.id, 'participante_editado', v_uid,
      jsonb_build_object(
        'avaliacao_id', p.avaliacao_id,
        'campos_alterados', to_jsonb(v_campos),
        'alteracao_pos_resposta', v_respondido,
        'justificativa_informada', (_justificativa IS NOT NULL AND length(btrim(_justificativa)) >= 10)
      )
    );
  END IF;

  RETURN jsonb_build_object('ok', true, 'campos_alterados', to_jsonb(v_campos));
END $$;

GRANT EXECUTE ON FUNCTION public.psico_atualizar_participante(uuid, text, text, text, text, text, text, text) TO authenticated;

-- 3) Tabela de rate limiting para a rota pública
CREATE TABLE IF NOT EXISTS public.psico_rate_limits (
  id bigserial PRIMARY KEY,
  bucket text NOT NULL,
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL DEFAULT now(),
  count integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, key_hash)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_rate_limits TO service_role;
ALTER TABLE public.psico_rate_limits ENABLE ROW LEVEL SECURITY;
-- Sem policies: somente service_role acessa via edge function.

CREATE OR REPLACE FUNCTION public.psico_rate_limit_hit(
  _bucket text, _key_hash text, _window_seconds int, _max int
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_ok boolean;
BEGIN
  DELETE FROM public.psico_rate_limits
   WHERE updated_at < now() - interval '1 hour';

  INSERT INTO public.psico_rate_limits(bucket, key_hash, window_start, count, updated_at)
  VALUES (_bucket, _key_hash, now(), 1, now())
  ON CONFLICT (bucket, key_hash) DO UPDATE
    SET count = CASE
                  WHEN public.psico_rate_limits.window_start < now() - make_interval(secs => _window_seconds)
                    THEN 1
                  ELSE public.psico_rate_limits.count + 1
                END,
        window_start = CASE
                         WHEN public.psico_rate_limits.window_start < now() - make_interval(secs => _window_seconds)
                           THEN now()
                         ELSE public.psico_rate_limits.window_start
                       END,
        updated_at = now()
  RETURNING (count <= _max) INTO v_ok;
  RETURN coalesce(v_ok, true);
END $$;

GRANT EXECUTE ON FUNCTION public.psico_rate_limit_hit(text, text, int, int) TO service_role;
