-- Acrescenta somente parâmetros metodológicos e indicadores agregados necessários
-- à leitura visual. Respostas individuais e identificação de participantes não
-- fazem parte do snapshot do relatório.

ALTER FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid)
  RENAME TO psico_obter_conteudo_aprovado_relatorio_sem_visual_v1_2;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_visual_v1_2(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_visual_v1_2(uuid)
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
  v_metodologia jsonb;
  v_fatores jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  v_conteudo := public.psico_obter_conteudo_aprovado_relatorio_sem_visual_v1_2(
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
    'codigo', mv.codigo,
    'versao', mv.versao,
    'nome', mv.nome,
    'escala_min', 0,
    'escala_max', COALESCE(mv.faixa_critico_max, 4),
    'faixa_irrelevante_max', mv.faixa_irrelevante_max,
    'faixa_baixo_max', mv.faixa_baixo_max,
    'faixa_medio_max', mv.faixa_medio_max,
    'faixa_alto_max', mv.faixa_alto_max,
    'criterio_principal_percentual', mv.criterio_principal_percentual,
    'criterio_principal_operador', mv.criterio_principal_operador,
    'criterio_agravamento_percentual', mv.criterio_agravamento_percentual,
    'criterio_agravamento_operador', mv.criterio_agravamento_operador,
    'criterio_critico_percentual', mv.criterio_critico_percentual,
    'criterio_critico_operador', mv.criterio_critico_operador
  )
    INTO v_metodologia
  FROM public.psico_resultado_processamentos rp
  JOIN public.psico_metodologias_versoes mv ON mv.id = rp.metodologia_versao_id
  WHERE rp.id = v_processamento_id;

  SELECT jsonb_agg(
    jsonb_build_object(
      'fator_codigo', prf.fator_codigo,
      'fator_nome', f.nome,
      'fator_descricao', f.descricao,
      'score_medio', rf.score_medio,
      'classificacao', rf.classificacao_media,
      'percentual_irrelevante', rf.percentual_irrelevante,
      'percentual_baixo', rf.percentual_baixo,
      'percentual_medio', rf.percentual_medio,
      'percentual_alto', rf.percentual_alto,
      'percentual_critico', rf.percentual_critico,
      'percentual_medio_alto_critico', rf.percentual_medio_alto_critico,
      'percentual_alto_critico', rf.percentual_alto_critico,
      'criterio_principal', rf.criterio_principal,
      'criterio_agravamento', rf.criterio_agravamento,
      'criterio_critico_automatico', rf.criterio_critico_automatico,
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
  LEFT JOIN public.psico_resultados_fatores rf ON rf.id = prf.resultado_fator_id
  LEFT JOIN public.psico_fatores f ON f.id = rf.fator_id
  WHERE prf.revisao_id = v_revisao_id;

  v_conteudo := jsonb_set(
    v_conteudo,
    '{avaliacao,metodologia}',
    COALESCE(v_metodologia, v_conteudo #> '{avaliacao,metodologia}', '{}'::jsonb),
    true
  );

  RETURN v_conteudo || jsonb_build_object('fatores', COALESCE(v_fatores, '[]'::jsonb));
END
$function$;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) TO service_role;

-- Mudanças de conteúdo e identidade visual devem gerar uma nova revisão do PDF.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.psico_preparar_emissao_relatorio(uuid,text,text)'::regprocedure)
    INTO v_definition;

  IF position('v_modelo_versao text := ''1.2.0''' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position('v_modelo_versao text := ''1.1.0''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Versao base inesperada em psico_preparar_emissao_relatorio';
  END IF;

  v_definition := replace(
    v_definition,
    'v_modelo_versao text := ''1.1.0''',
    'v_modelo_versao text := ''1.2.0'''
  );

  EXECUTE v_definition;
END
$migration$;