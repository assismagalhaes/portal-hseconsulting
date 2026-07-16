
CREATE OR REPLACE FUNCTION public.psico_importacao_commit_bruta(
  p_importacao_id uuid,
  p_avaliacao jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imp record;
  v_aval_id uuid;
  v_stg record;
  v_resposta_id uuid;
  v_num integer;
  v_opcao text;
  v_pergunta_id uuid;
  v_opcao_id uuid;
  v_qtd_itens integer;
  v_respondentes integer := 0;
  v_total_itens integer := 0;
BEGIN
  PERFORM public._psico_require_admin_tec();

  SELECT * INTO v_imp FROM public.psico_importacoes_avaliacoes WHERE id=p_importacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'importacao_nao_encontrada'; END IF;
  IF v_imp.tipo <> 'bruta_respondentes' THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF v_imp.status <> 'pronto_para_importar' THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE='55000';
  END IF;

  UPDATE public.psico_importacoes_avaliacoes SET status='importando', updated_at=now() WHERE id=p_importacao_id;

  IF (p_avaliacao ? 'avaliacao_id') AND NULLIF(p_avaliacao->>'avaliacao_id','') IS NOT NULL THEN
    v_aval_id := (p_avaliacao->>'avaliacao_id')::uuid;
    UPDATE public.psico_avaliacoes
       SET origem_coleta = CASE WHEN origem_coleta='portal' THEN 'importacao_bruta'::psico_origem_coleta ELSE origem_coleta END,
           importacao_avaliacao_id = p_importacao_id,
           importado_em = COALESCE(importado_em, now()),
           importado_por = COALESCE(importado_por, auth.uid()),
           observacao_origem = COALESCE(p_avaliacao->>'observacao_origem', observacao_origem),
           updated_at = now()
     WHERE id = v_aval_id AND cliente_id = v_imp.cliente_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'avaliacao_incompativel' USING ERRCODE='23514'; END IF;
  ELSE
    INSERT INTO public.psico_avaliacoes (
      codigo, cliente_id, metodologia_versao_id, questionario_versao_id,
      titulo, unidade, data_inicio_prevista, data_fim_prevista, status,
      origem_coleta, importacao_avaliacao_id, importado_em, importado_por,
      observacao_origem, criado_por, atualizado_por,
      coleta_encerrada_em, motivo_encerramento
    ) VALUES (
      'IMP-' || substr(encode(gen_random_bytes(6),'hex'),1,10),
      v_imp.cliente_id, v_imp.metodologia_versao_id, v_imp.questionario_versao_id,
      COALESCE(p_avaliacao->>'titulo','Avaliação histórica importada'),
      NULLIF(p_avaliacao->>'unidade',''),
      NULLIF(p_avaliacao->>'data_inicio','')::date,
      NULLIF(p_avaliacao->>'data_fim','')::date,
      'coleta_encerrada'::psico_avaliacao_status,
      'importacao_bruta'::psico_origem_coleta,
      p_importacao_id, now(), auth.uid(),
      NULLIF(p_avaliacao->>'observacao_origem',''),
      auth.uid(), auth.uid(),
      now(), 'Importação histórica'
    ) RETURNING id INTO v_aval_id;
  END IF;

  UPDATE public.psico_importacoes_avaliacoes SET avaliacao_id=v_aval_id, updated_at=now() WHERE id=p_importacao_id;

  FOR v_stg IN
    SELECT * FROM public.psico_importacao_staging_respostas WHERE importacao_id=p_importacao_id ORDER BY criado_em
  LOOP
    v_qtd_itens := 0;
    INSERT INTO public.psico_respostas (
      avaliacao_id, questionario_versao_id, metodologia_versao_id,
      funcao, setor, unidade, funcao_normalizada, setor_normalizado, unidade_normalizada,
      data_resposta, quantidade_itens, origem_registro, importacao_id
    ) VALUES (
      v_aval_id, v_imp.questionario_versao_id, v_imp.metodologia_versao_id,
      v_stg.funcao, v_stg.setor, v_stg.unidade,
      v_stg.funcao_normalizada, v_stg.setor_normalizado, v_stg.unidade_normalizada,
      COALESCE(v_stg.data_resposta, CURRENT_DATE),
      0, 'importacao_bruta'::psico_resposta_origem, p_importacao_id
    ) RETURNING id INTO v_resposta_id;

    FOR v_num, v_opcao IN
      SELECT (key)::int, (value #>> '{}')::text
        FROM jsonb_each(v_stg.respostas_normalizadas)
    LOOP
      SELECT id INTO v_pergunta_id
        FROM public.psico_perguntas
       WHERE questionario_versao_id = v_imp.questionario_versao_id AND numero = v_num
       LIMIT 1;
      IF v_pergunta_id IS NULL THEN CONTINUE; END IF;

      SELECT id INTO v_opcao_id
        FROM public.psico_opcoes_resposta
       WHERE metodologia_versao_id = v_imp.metodologia_versao_id AND codigo = v_opcao
       LIMIT 1;
      IF v_opcao_id IS NULL THEN CONTINUE; END IF;

      INSERT INTO public.psico_respostas_itens (resposta_id, pergunta_id, opcao_resposta_id)
      VALUES (v_resposta_id, v_pergunta_id, v_opcao_id);
      v_qtd_itens := v_qtd_itens + 1;
    END LOOP;

    UPDATE public.psico_respostas SET quantidade_itens=v_qtd_itens WHERE id=v_resposta_id;
    v_respondentes := v_respondentes + 1;
    v_total_itens := v_total_itens + v_qtd_itens;
  END LOOP;

  DELETE FROM public.psico_importacao_staging_respostas WHERE importacao_id=p_importacao_id;

  UPDATE public.psico_importacoes_avaliacoes
     SET status = CASE WHEN v_respondentes > 0 THEN 'concluida'::psico_importacao_status ELSE 'falhou'::psico_importacao_status END,
         respondentes_importados = v_respondentes,
         total_itens_importados = v_total_itens,
         concluido_em = now(),
         updated_at = now()
   WHERE id = p_importacao_id;

  RETURN jsonb_build_object(
    'avaliacao_id', v_aval_id,
    'respondentes_importados', v_respondentes,
    'total_itens_importados', v_total_itens
  );
END;
$$;
