CREATE OR REPLACE FUNCTION public.psico_validar_processamento_resultados(p_avaliacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_av public.psico_avaliacoes%ROWTYPE;
  v_qv public.psico_questionarios_versoes%ROWTYPE;
  v_mv public.psico_metodologias_versoes%ROWTYPE;
  v_erros jsonb := '[]'::jsonb;
  v_avisos jsonb := '[]'::jsonb;
  v_qtd_fatores int;
  v_qtd_perg int;
  v_qtd_opcoes int;
  v_qtd_resp int;
  v_qtd_itens int;
  v_itens_esperados int;
  v_qtd_convites_resp int;
  v_itens_por_resposta_ok boolean;
  v_hash text;
  v_proc_existente uuid;
  v_min_global int;
  v_amostra_ok boolean;
  v_amostra_reduzida boolean := false;
  v_importacao_bruta boolean;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.' USING ERRCODE='no_data_found';
  END IF;

  v_importacao_bruta := v_av.origem_coleta = 'importacao_bruta';

  IF v_av.status NOT IN ('coleta_encerrada','resultado_pronto') THEN
    v_erros := v_erros || jsonb_build_array('Status inválido: só é possível processar após encerrar a coleta.');
  END IF;
  IF v_av.questionario_versao_id IS NULL THEN
    v_erros := v_erros || jsonb_build_array('Avaliação sem questionário vinculado.');
  END IF;
  IF v_av.metodologia_versao_id IS NULL THEN
    v_erros := v_erros || jsonb_build_array('Avaliação sem metodologia vinculada.');
  END IF;

  IF v_av.questionario_versao_id IS NOT NULL THEN
    SELECT * INTO v_qv FROM public.psico_questionarios_versoes WHERE id = v_av.questionario_versao_id;
    IF NOT FOUND THEN
      v_erros := v_erros || jsonb_build_array('Versão do questionário vinculada não existe.');
    ELSIF v_qv.status::text NOT IN ('publicada','arquivada') THEN
      IF v_importacao_bruta THEN
        v_avisos := v_avisos || jsonb_build_array('Importação histórica vinculada a questionário legado não publicado.');
      ELSE
        v_erros := v_erros || jsonb_build_array('Questionário não está publicado ou arquivado.');
      END IF;
    END IF;
  END IF;

  IF v_av.metodologia_versao_id IS NOT NULL THEN
    SELECT * INTO v_mv FROM public.psico_metodologias_versoes WHERE id = v_av.metodologia_versao_id;
    IF v_mv.unidade_calculo IS DISTINCT FROM 'quantidade_respostas' THEN
      v_erros := v_erros || jsonb_build_array('Unidade de cálculo deve ser quantidade_respostas.');
    END IF;
  END IF;

  SELECT count(*) INTO v_qtd_fatores FROM public.psico_fatores
   WHERE questionario_versao_id = v_av.questionario_versao_id AND ativo = true;
  SELECT count(*) INTO v_qtd_perg FROM public.psico_perguntas
   WHERE questionario_versao_id = v_av.questionario_versao_id AND ativa = true;
  SELECT count(*) INTO v_qtd_opcoes FROM public.psico_opcoes_resposta
   WHERE metodologia_versao_id = v_av.metodologia_versao_id AND ativo = true;

  IF v_qtd_fatores <> 7 THEN
    v_erros := v_erros || jsonb_build_array(format('Questionário deve ter 7 fatores ativos (encontrados: %s).', v_qtd_fatores));
  END IF;
  IF v_qtd_perg <> 35 THEN
    v_erros := v_erros || jsonb_build_array(format('Questionário deve ter 35 perguntas ativas (encontradas: %s).', v_qtd_perg));
  END IF;
  IF v_qtd_opcoes <> 5 THEN
    v_erros := v_erros || jsonb_build_array(format('Metodologia deve ter 5 opções de resposta ativas (encontradas: %s).', v_qtd_opcoes));
  END IF;

  SELECT count(*) INTO v_qtd_resp FROM public.psico_respostas WHERE avaliacao_id = p_avaliacao_id;
  SELECT count(*) INTO v_qtd_convites_resp FROM public.psico_convites
   WHERE avaliacao_id = p_avaliacao_id AND status = 'respondido';
  SELECT count(*) INTO v_qtd_itens
    FROM public.psico_respostas_itens i
    JOIN public.psico_respostas r ON r.id = i.resposta_id
   WHERE r.avaliacao_id = p_avaliacao_id;

  v_itens_esperados := v_qtd_resp * COALESCE(v_qtd_perg, 35);

  IF NOT v_importacao_bruta AND v_qtd_convites_resp <> v_qtd_resp THEN
    v_erros := v_erros || jsonb_build_array(
      format('Divergência entre convites respondidos (%s) e respostas anônimas (%s).',
             v_qtd_convites_resp, v_qtd_resp));
  ELSIF v_importacao_bruta AND v_qtd_convites_resp <> 0 THEN
    v_avisos := v_avisos || jsonb_build_array(
      format('Importação histórica possui %s convite(s), que não participam da validação de integridade.',
             v_qtd_convites_resp));
  END IF;

  SELECT NOT EXISTS (
    SELECT 1 FROM (
      SELECT r.id, count(i.*) c
        FROM public.psico_respostas r
        JOIN public.psico_respostas_itens i ON i.resposta_id = r.id
       WHERE r.avaliacao_id = p_avaliacao_id
       GROUP BY r.id
    ) t WHERE t.c <> 35
  ) INTO v_itens_por_resposta_ok;
  IF NOT v_itens_por_resposta_ok THEN
    v_erros := v_erros || jsonb_build_array('Existe(m) resposta(s) sem exatamente 35 itens.');
  END IF;

  v_min_global := COALESCE(v_mv.minimo_respondentes_global, 2);
  v_amostra_ok := v_qtd_resp >= v_min_global;
  v_amostra_reduzida := v_qtd_resp >= v_min_global AND v_qtd_resp < 5;

  IF v_qtd_resp = 0 THEN
    v_avisos := v_avisos || jsonb_build_array('Nenhuma resposta foi coletada.');
  ELSIF v_qtd_resp < v_min_global THEN
    v_avisos := v_avisos || jsonb_build_array(format('A amostra não atende ao mínimo global de %s respondentes.', v_min_global));
  ELSIF v_amostra_reduzida THEN
    v_avisos := v_avisos || jsonb_build_array('Amostra reduzida: resultados globais válidos, sem segmentações.');
  END IF;

  v_hash := public.psico_hash_entrada_resultado(p_avaliacao_id);
  SELECT id INTO v_proc_existente
    FROM public.psico_resultado_processamentos
   WHERE avaliacao_id = p_avaliacao_id
     AND versao_motor = 'HSE-PSICO-CALC-1.0.0'
     AND hash_entrada = v_hash
     AND status = 'concluido'
   ORDER BY concluido_em DESC LIMIT 1;

  RETURN jsonb_build_object(
    'valido', jsonb_array_length(v_erros) = 0,
    'pode_processar', jsonb_array_length(v_erros) = 0 AND v_amostra_ok AND v_itens_por_resposta_ok,
    'status_avaliacao', v_av.status,
    'origem_coleta', v_av.origem_coleta,
    'convites_respondidos', v_qtd_convites_resp,
    'total_respondentes', v_qtd_resp,
    'total_respostas_anonimas', v_qtd_resp,
    'total_itens', v_qtd_itens,
    'itens_esperados', v_itens_esperados,
    'minimo_global', v_min_global,
    'amostra_suficiente', v_amostra_ok,
    'amostra_reduzida', v_amostra_reduzida,
    'integridade_ok', v_itens_por_resposta_ok
      AND (v_importacao_bruta OR v_qtd_convites_resp = v_qtd_resp)
      AND v_qtd_itens = v_itens_esperados,
    'processamento_existente', v_proc_existente IS NOT NULL,
    'mesmo_hash', v_proc_existente IS NOT NULL,
    'hash_entrada', v_hash,
    'versao_motor', 'HSE-PSICO-CALC-1.0.0',
    'erros', v_erros,
    'avisos', v_avisos
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.psico_validar_processamento_resultados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_validar_processamento_resultados(uuid) TO authenticated;