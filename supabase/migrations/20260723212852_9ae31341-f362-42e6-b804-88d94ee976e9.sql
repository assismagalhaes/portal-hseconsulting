
-- Convites individuais: colunas para fluxo público v2
ALTER TABLE public.psico_individual_convites
  ADD COLUMN IF NOT EXISTS public_id uuid NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS token_version integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'psico_ind_conv_public_id_key'
  ) THEN
    ALTER TABLE public.psico_individual_convites
      ADD CONSTRAINT psico_ind_conv_public_id_key UNIQUE (public_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'psico_ind_conv_status_chk'
  ) THEN
    ALTER TABLE public.psico_individual_convites
      ADD CONSTRAINT psico_ind_conv_status_chk
      CHECK (status IN ('ativo','revogado','expirado','respondido'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS psico_ind_conv_av_papel_uniq
  ON public.psico_individual_convites (avaliacao_id, papel);

-- Reuso do rate_limit já existente (psico_rate_limit_hit). Se não existir, criar.
CREATE OR REPLACE FUNCTION public.psico_rate_limit_hit(
  _bucket text, _key_hash text, _window_seconds integer, _max integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_since timestamptz := now() - make_interval(secs => _window_seconds);
BEGIN
  INSERT INTO public.psico_rate_limits(bucket, key_hash, created_at)
  VALUES (_bucket, _key_hash, now())
  ON CONFLICT DO NOTHING;
  SELECT count(*) INTO v_count
    FROM public.psico_rate_limits
   WHERE bucket = _bucket AND key_hash = _key_hash AND created_at >= v_since;
  RETURN v_count <= _max;
EXCEPTION WHEN OTHERS THEN
  RETURN true;
END;
$$;

-- Finalização transacional da submissão individual
CREATE OR REPLACE FUNCTION public.psico_ind_finalizar_submissao(
  p_public_id uuid,
  p_token_version integer,
  p_papel text,
  p_instrumento_versao_id uuid,
  p_respostas jsonb,           -- [{pergunta_id, opcao_id}]
  p_livres jsonb DEFAULT '[]'::jsonb, -- [{pergunta_id, conteudo}]
  p_ip_hash text DEFAULT NULL,
  p_ua_hash text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conv record;
  v_form_id uuid;
  v_r jsonb;
  v_valor numeric;
BEGIN
  SELECT * INTO v_conv
    FROM public.psico_individual_convites
   WHERE public_id = p_public_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'convite_nao_encontrado';
  END IF;
  IF v_conv.token_version <> p_token_version THEN
    RAISE EXCEPTION 'token_invalido';
  END IF;
  IF v_conv.status <> 'ativo' THEN
    RAISE EXCEPTION 'ja_respondido';
  END IF;
  IF v_conv.papel <> p_papel THEN
    RAISE EXCEPTION 'papel_invalido';
  END IF;
  IF v_conv.expira_em IS NOT NULL AND v_conv.expira_em < now() THEN
    UPDATE public.psico_individual_convites SET status='expirado' WHERE id=v_conv.id;
    RAISE EXCEPTION 'expirado';
  END IF;

  INSERT INTO public.psico_individual_formularios (
    avaliacao_id, convite_id, instrumento_versao_id, papel,
    iniciado_em, concluido_em, ip_hash, user_agent_hash
  ) VALUES (
    v_conv.avaliacao_id, v_conv.id, p_instrumento_versao_id, p_papel,
    now(), now(), p_ip_hash, p_ua_hash
  ) RETURNING id INTO v_form_id;

  FOR v_r IN SELECT * FROM jsonb_array_elements(coalesce(p_respostas,'[]'::jsonb))
  LOOP
    SELECT valor_numerico INTO v_valor
      FROM public.psico_individual_opcoes
     WHERE id = (v_r->>'opcao_id')::uuid
       AND pergunta_id = (v_r->>'pergunta_id')::uuid;
    INSERT INTO public.psico_individual_respostas (
      formulario_id, pergunta_id, opcao_id, valor_numerico
    ) VALUES (
      v_form_id,
      (v_r->>'pergunta_id')::uuid,
      (v_r->>'opcao_id')::uuid,
      v_valor
    );
  END LOOP;

  FOR v_r IN SELECT * FROM jsonb_array_elements(coalesce(p_livres,'[]'::jsonb))
  LOOP
    INSERT INTO public.psico_individual_respostas_livres (
      formulario_id, pergunta_id, conteudo
    ) VALUES (
      v_form_id,
      (v_r->>'pergunta_id')::uuid,
      left(coalesce(v_r->>'conteudo',''), 4000)
    );
  END LOOP;

  UPDATE public.psico_individual_convites
     SET status='respondido', consumido_em = now()
   WHERE id = v_conv.id;

  RETURN jsonb_build_object('status','registrada','formulario_id', v_form_id);
END;
$$;

REVOKE ALL ON FUNCTION public.psico_ind_finalizar_submissao(uuid,integer,text,uuid,jsonb,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_finalizar_submissao(uuid,integer,text,uuid,jsonb,jsonb,text,text) TO service_role;
