-- Enriquece o snapshot imutável do relatório apenas com resultados agregados e
-- nomes técnicos do catálogo. Nenhuma resposta individual ou identificação de
-- participante é incluída.

ALTER FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid)
  RENAME TO psico_obter_conteudo_aprovado_relatorio_sem_resultado_executivo;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_resultado_executivo(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_resultado_executivo(uuid)
  TO service_role;

CREATE FUNCTION public.psico_obter_conteudo_aprovado_relatorio(p_avaliacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conteudo jsonb;
  v_revisao_id uuid;
  v_processamento_id uuid;
  v_resultado jsonb;
  v_fatores jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  v_conteudo := public.psico_obter_conteudo_aprovado_relatorio_sem_resultado_executivo(
    p_avaliacao_id
  );

  IF v_conteudo IS NULL OR COALESCE((v_conteudo->>'ok')::boolean, false) = false THEN
    RETURN v_conteudo;
  END IF;

  v_revisao_id := NULLIF(v_conteudo #>> '{revisao,id}', '')::uuid;

  SELECT a.processamento_resultado_ativo_id
    INTO v_processamento_id
  FROM public.psico_avaliacoes a
  WHERE a.id = p_avaliacao_id;

  SELECT jsonb_build_object(
    'total_participantes', e.respondentes,
    'participantes_elegiveis', e.participantes_elegiveis,
    'percentual_participacao', e.percentual_participacao,
    'indice_geral_descritivo', e.indice_geral_descritivo,
    'classificacao_indice_geral', e.classificacao_indice_geral,
    'fatores_significativos', e.fatores_significativos,
    'prioridade_maxima', e.prioridade_maxima,
    'amostra_reduzida', e.amostra_reduzida
  )
    INTO v_resultado
  FROM public.psico_resultado_escopos e
  WHERE e.processamento_id = v_processamento_id
    AND e.tipo = 'global'
  LIMIT 1;

  SELECT jsonb_agg(
    jsonb_build_object(
      'fator_codigo', prf.fator_codigo,
      'fator_nome', f.nome,
      'fator_descricao', f.descricao,
      'score_medio', rf.score_medio,
      'classificacao', rf.classificacao_media,
      'percentual_medio_alto_critico', rf.percentual_medio_alto_critico,
      'percentual_alto_critico', rf.percentual_alto_critico,
      'significativo', prf.significativo_calculado,
      'prioridade', prf.prioridade_calculada,
      'tratamento', prf.tratamento_tecnico,
      'observacao', prf.observacao_tecnica,
      'justificativa', prf.justificativa,
      'ordem', prf.ordem_relatorio
    )
    ORDER BY prf.ordem_relatorio
  )
    INTO v_fatores
  FROM public.psico_revisoes_fatores prf
  LEFT JOIN public.psico_resultados_fatores rf
    ON rf.id = prf.resultado_fator_id
  LEFT JOIN public.psico_fatores f
    ON f.id = rf.fator_id
  WHERE prf.revisao_id = v_revisao_id;

  RETURN v_conteudo
    || jsonb_build_object('resultado', COALESCE(v_resultado, '{}'::jsonb))
    || jsonb_build_object('fatores', COALESCE(v_fatores, '[]'::jsonb));
END
$function$;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) TO service_role;

-- Uma mudança visual e de conteúdo deve gerar nova revisão, em vez de reutilizar
-- silenciosamente um PDF emitido pelo template anterior.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.psico_preparar_emissao_relatorio(uuid,text,text)'::regprocedure)
    INTO v_definition;

  IF position('v_modelo_versao text := ''1.1.0''' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position('v_modelo_versao text := ''1.0.2''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Versao base inesperada em psico_preparar_emissao_relatorio';
  END IF;

  v_definition := replace(
    v_definition,
    'v_modelo_versao text := ''1.0.2''',
    'v_modelo_versao text := ''1.1.0'''
  );

  EXECUTE v_definition;
END
$migration$;