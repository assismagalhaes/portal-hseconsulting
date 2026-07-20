-- Corrige o commit da importacao bruta para respeitar a invariavel de 35 itens.
CREATE OR REPLACE FUNCTION public.psico_importacao_commit_bruta(
  p_importacao_id uuid,
  p_avaliacao jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_imp record;
  v_aval_id uuid;
  v_stg record;
  v_resposta_id uuid;
  v_qtd_itens integer;
  v_respondentes integer := 0;
  v_total_itens integer := 0;
BEGIN
  PERFORM public._psico_require_admin_tec();

  SELECT * INTO v_imp
    FROM public.psico_importacoes_avaliacoes
   WHERE id = p_importacao_id
   FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'importacao_nao_encontrada'; END IF;
  IF v_imp.tipo <> 'bruta_respondentes' THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF v_imp.status <> 'pronto_para_importar' THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE = '55000';
  END IF;

  UPDATE public.psico_importacoes_avaliacoes
     SET status = 'importando', updated_at = now()
   WHERE id = p_importacao_id;

  IF (p_avaliacao ? 'avaliacao_id')
     AND NULLIF(p_avaliacao->>'avaliacao_id', '') IS NOT NULL THEN
    v_aval_id := (p_avaliacao->>'avaliacao_id')::uuid;

    UPDATE public.psico_avaliacoes
       SET origem_coleta = CASE
             WHEN origem_coleta = 'portal' THEN 'importacao_bruta'::psico_origem_coleta
             ELSE origem_coleta
           END,
           importacao_avaliacao_id = p_importacao_id,
           importado_em = COALESCE(importado_em, now()),
           importado_por = COALESCE(importado_por, auth.uid()),
           observacao_origem = COALESCE(p_avaliacao->>'observacao_origem', observacao_origem),
           updated_at = now()
     WHERE id = v_aval_id
       AND cliente_id = v_imp.cliente_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'avaliacao_incompativel' USING ERRCODE = '23514';
    END IF;
  ELSE
    INSERT INTO public.psico_avaliacoes (
      codigo, cliente_id, metodologia_versao_id, questionario_versao_id,
      titulo, unidade, data_inicio_prevista, data_fim_prevista, status,
      origem_coleta, importacao_avaliacao_id, importado_em, importado_por,
      observacao_origem, criado_por, atualizado_por,
      coleta_encerrada_em, motivo_encerramento
    ) VALUES (
      'IMP-' || substr(encode(gen_random_bytes(6), 'hex'), 1, 10),
      v_imp.cliente_id, v_imp.metodologia_versao_id, v_imp.questionario_versao_id,
      COALESCE(p_avaliacao->>'titulo', 'Avaliacao historica importada'),
      NULLIF(p_avaliacao->>'unidade', ''),
      NULLIF(p_avaliacao->>'data_inicio', '')::date,
      NULLIF(p_avaliacao->>'data_fim', '')::date,
      'coleta_encerrada'::psico_avaliacao_status,
      'importacao_bruta'::psico_origem_coleta,
      p_importacao_id, now(), auth.uid(),
      NULLIF(p_avaliacao->>'observacao_origem', ''),
      auth.uid(), auth.uid(),
      now(), 'Importacao historica'
    ) RETURNING id INTO v_aval_id;
  END IF;

  UPDATE public.psico_importacoes_avaliacoes
     SET avaliacao_id = v_aval_id, updated_at = now()
   WHERE id = p_importacao_id;

  FOR v_stg IN
    SELECT *
      FROM public.psico_importacao_staging_respostas
     WHERE importacao_id = p_importacao_id
     ORDER BY criado_em
  LOOP
    IF jsonb_typeof(v_stg.respostas_normalizadas) IS DISTINCT FROM 'object' THEN
      RAISE EXCEPTION 'respostas_normalizadas_invalidas'
        USING ERRCODE = '23514',
              DETAIL = format(
                'As respostas normalizadas devem ser um objeto JSON; staging_id=%s.',
                v_stg.id
              );
    END IF;

    IF jsonb_object_length(v_stg.respostas_normalizadas) <> 35 THEN
      RAISE EXCEPTION 'quantidade_itens_invalida'
        USING ERRCODE = '23514',
              DETAIL = format(
                'Cada respondente deve possuir exatamente 35 respostas normalizadas; staging_id=%s.',
                v_stg.id
              );
    END IF;

    SELECT count(*)
      INTO v_qtd_itens
      FROM jsonb_each_text(v_stg.respostas_normalizadas) AS resposta(numero, opcao)
      JOIN public.psico_perguntas pergunta
        ON pergunta.numero = CASE
             WHEN resposta.numero ~ '^[0-9]+$' THEN resposta.numero::integer
           END
       AND pergunta.questionario_versao_id = v_imp.questionario_versao_id
       AND pergunta.ativa = true
      JOIN public.psico_opcoes_resposta opcao
        ON opcao.codigo = resposta.opcao
       AND opcao.metodologia_versao_id = v_imp.metodologia_versao_id
       AND opcao.ativo = true;

    IF v_qtd_itens <> 35 THEN
      RAISE EXCEPTION 'respostas_normalizadas_invalidas'
        USING ERRCODE = '23514',
              DETAIL = format(
                'Somente %s de 35 respostas puderam ser associadas a perguntas e opcoes ativas; staging_id=%s.',
                v_qtd_itens,
                v_stg.id
              );
    END IF;

    INSERT INTO public.psico_respostas (
      avaliacao_id, questionario_versao_id, metodologia_versao_id,
      funcao, setor, unidade, funcao_normalizada, setor_normalizado, unidade_normalizada,
      data_resposta, quantidade_itens, origem_registro, importacao_id
    ) VALUES (
      v_aval_id, v_imp.questionario_versao_id, v_imp.metodologia_versao_id,
      v_stg.funcao, v_stg.setor, v_stg.unidade,
      v_stg.funcao_normalizada, v_stg.setor_normalizado, v_stg.unidade_normalizada,
      COALESCE(v_stg.data_resposta, CURRENT_DATE),
      35, 'importacao_bruta'::psico_resposta_origem, p_importacao_id
    ) RETURNING id INTO v_resposta_id;

    INSERT INTO public.psico_respostas_itens (
      resposta_id, pergunta_id, opcao_resposta_id
    )
    SELECT v_resposta_id, pergunta.id, opcao.id
      FROM jsonb_each_text(v_stg.respostas_normalizadas) AS resposta(numero, opcao)
      JOIN public.psico_perguntas pergunta
        ON pergunta.numero = CASE
             WHEN resposta.numero ~ '^[0-9]+$' THEN resposta.numero::integer
           END
       AND pergunta.questionario_versao_id = v_imp.questionario_versao_id
       AND pergunta.ativa = true
      JOIN public.psico_opcoes_resposta opcao
        ON opcao.codigo = resposta.opcao
       AND opcao.metodologia_versao_id = v_imp.metodologia_versao_id
       AND opcao.ativo = true;

    GET DIAGNOSTICS v_qtd_itens = ROW_COUNT;
    IF v_qtd_itens <> 35 THEN
      RAISE EXCEPTION 'quantidade_itens_persistida_invalida'
        USING ERRCODE = '23514',
              DETAIL = format(
                'Foram persistidos %s itens para a resposta %s; esperado=35.',
                v_qtd_itens,
                v_resposta_id
              );
    END IF;

    v_respondentes := v_respondentes + 1;
    v_total_itens := v_total_itens + v_qtd_itens;
  END LOOP;

  DELETE FROM public.psico_importacao_staging_respostas
   WHERE importacao_id = p_importacao_id;

  UPDATE public.psico_importacoes_avaliacoes
     SET status = CASE
           WHEN v_respondentes > 0 THEN 'concluida'::psico_importacao_status
           ELSE 'falhou'::psico_importacao_status
         END,
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

REVOKE ALL ON FUNCTION public.psico_importacao_commit_bruta(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_importacao_commit_bruta(uuid, jsonb) TO authenticated, service_role;