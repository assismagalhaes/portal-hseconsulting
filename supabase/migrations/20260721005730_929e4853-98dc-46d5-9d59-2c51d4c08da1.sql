CREATE OR REPLACE FUNCTION public.psico_submeter_resposta_publica(
  p_token text, p_hash_nome text, p_nome_para_registro text,
  p_funcao text, p_setor text, p_unidade text,
  p_respostas jsonb, p_ip_hash text, p_ua_hash text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  v_aval public.psico_avaliacoes%ROWTYPE;
  v_resposta_id uuid;
BEGIN
  IF p_token IS NULL OR length(p_token) < 8 OR length(p_token) > 128 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'token_invalido');
  END IF;

  SELECT * INTO v_aval
    FROM public.psico_avaliacoes
   WHERE link_publico_token = p_token
     AND modo_coleta = 'publico_anonimo';

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'avaliacao_nao_encontrada');
  END IF;

  IF v_aval.status NOT IN ('coleta_em_andamento', 'coleta_aberta') THEN
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
      NULL;
    END;
  END IF;

  RETURN jsonb_build_object('ok', true, 'resposta_id', v_resposta_id);
END;
$function$;