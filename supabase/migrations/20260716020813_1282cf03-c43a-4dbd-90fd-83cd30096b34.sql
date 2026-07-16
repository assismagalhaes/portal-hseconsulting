
CREATE OR REPLACE FUNCTION public.psico_importacao_ingerir_staging_bruta(
  p_importacao_id uuid,
  p_linhas jsonb
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer := 0; v_imp record;
BEGIN
  PERFORM public._psico_require_admin_tec();
  SELECT * INTO v_imp FROM public.psico_importacoes_avaliacoes WHERE id = p_importacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'importacao_nao_encontrada'; END IF;
  IF v_imp.tipo <> 'bruta_respondentes' THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF v_imp.status NOT IN ('mapeamento','validando') THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE='55000';
  END IF;
  UPDATE public.psico_importacoes_avaliacoes
     SET status='validando', updated_at=now()
   WHERE id=p_importacao_id AND status='mapeamento';

  INSERT INTO public.psico_importacao_staging_respostas
    (importacao_id, data_resposta, funcao, setor, unidade,
     funcao_normalizada, setor_normalizado, unidade_normalizada, respostas_normalizadas,
     layout_detectado, identificador_origem_hash, tipo_identificador)
  SELECT
    p_importacao_id,
    NULLIF(x->>'data_resposta','')::date,
    NULLIF(x->>'funcao',''),
    NULLIF(x->>'setor',''),
    NULLIF(x->>'unidade',''),
    NULLIF(x->>'funcao_normalizada',''),
    NULLIF(x->>'setor_normalizado',''),
    NULLIF(x->>'unidade_normalizada',''),
    COALESCE(x->'respostas', '{}'::jsonb),
    NULLIF(x->>'layout_detectado',''),
    NULLIF(x->>'identificador_origem_hash',''),
    NULLIF(x->>'tipo_identificador','')
  FROM jsonb_array_elements(COALESCE(p_linhas,'[]'::jsonb)) x;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END $$;
