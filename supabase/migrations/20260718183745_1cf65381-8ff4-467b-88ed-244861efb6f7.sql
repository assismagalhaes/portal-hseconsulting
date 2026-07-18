CREATE OR REPLACE FUNCTION public.psico_obter_conteudo_aprovado_relatorio(p_avaliacao_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rev RECORD;
  _av RECORD;
  _imp public.psico_importacoes_avaliacoes%ROWTYPE;
  _resultado JSONB;
  _agregado JSONB;
  _tem_importacao BOOLEAN := false;
  _modelo_codigo TEXT := 'HSE-PSICO-REL-1.0';
  _modelo_versao TEXT := '1.0.0';
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  SELECT * INTO _av
  FROM public.psico_avaliacoes
  WHERE id = p_avaliacao_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'AVALIACAO_NAO_LOCALIZADA');
  END IF;

  SELECT * INTO _rev
  FROM public.psico_revisoes_tecnicas
  WHERE avaliacao_id = p_avaliacao_id
    AND status = 'aprovada'
    AND ativa = true
  ORDER BY aprovada_em DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'code', 'REVISAO_NAO_APROVADA');
  END IF;

  IF _av.origem_coleta IN ('importacao_bruta', 'importacao_agregada') THEN
    _modelo_codigo := 'HSE-PSICO-REL-1.1';
    _modelo_versao := '1.1.0';
  END IF;

  IF _av.importacao_avaliacao_id IS NOT NULL THEN
    SELECT id, tipo, nome_arquivo, hash_arquivo_sha256, total_linhas,
           linhas_validas, linhas_invalidas, status, iniciado_em, concluido_em
    INTO _imp
    FROM public.psico_importacoes_avaliacoes
    WHERE id = _av.importacao_avaliacao_id;

    _tem_importacao := FOUND;
  END IF;

  IF _av.origem_coleta = 'importacao_agregada' THEN
    SELECT jsonb_agg(jsonb_build_object(
      'pergunta_id', da.pergunta_id,
      'numero', da.numero,
      'total_respostas', da.total_respostas,
      'quantidade_nunca', da.quantidade_nunca,
      'quantidade_raramente', da.quantidade_raramente,
      'quantidade_as_vezes', da.quantidade_as_vezes,
      'quantidade_frequentemente', da.quantidade_frequentemente,
      'quantidade_sempre', da.quantidade_sempre
    ) ORDER BY da.numero) INTO _agregado
    FROM public.psico_dados_agregados_perguntas da
    WHERE da.avaliacao_id = p_avaliacao_id;
  END IF;

  SELECT jsonb_build_object(
    'ok', true,
    'modelo', jsonb_build_object('codigo', _modelo_codigo, 'versao', _modelo_versao),
    'origem', jsonb_build_object(
      'coleta', _av.origem_coleta,
      'participacao_calculavel', _av.participacao_calculavel,
      'segmentacao_disponivel', _av.segmentacao_disponivel,
      'observacao_origem', _av.observacao_origem,
      'importacao', CASE WHEN NOT _tem_importacao THEN NULL ELSE jsonb_build_object(
        'id', _imp.id,
        'tipo', _imp.tipo,
        'arquivo_nome', _imp.nome_arquivo,
        'arquivo_hash_sha256', _imp.hash_arquivo_sha256,
        'total_linhas', _imp.total_linhas,
        'linhas_validas', _imp.linhas_validas,
        'linhas_invalidas', _imp.linhas_invalidas,
        'status', _imp.status,
        'iniciada_em', _imp.iniciado_em,
        'finalizada_em', _imp.concluido_em
      ) END
    ),
    'avaliacao', jsonb_build_object(
      'id', _av.id,
      'codigo', _av.codigo,
      'titulo', _av.titulo,
      'periodo', jsonb_build_object('inicio', _av.data_inicio_prevista, 'fim', _av.data_fim_prevista)
    ),
    'revisao', jsonb_build_object(
      'id', _rev.id,
      'versao', _rev.versao,
      'aprovada_em', _rev.aprovada_em,
      'responsavel', _rev.responsavel_snapshot,
      'conclusao', _rev.conclusao_tecnica,
      'limitacoes', _rev.limitacoes,
      'contexto', _rev.contexto_organizacional,
      'recomendacao_geral', _rev.recomendacao_geral,
      'amostra_reduzida', _rev.amostra_reduzida
    ),
    'biblioteca', (
      SELECT jsonb_build_object('codigo', codigo, 'versao', versao, 'nome', nome)
      FROM public.psico_bibliotecas_medidas_versoes
      WHERE id = _rev.biblioteca_versao_id
    ),
    'fatores', (
      SELECT jsonb_agg(jsonb_build_object(
        'fator_codigo', rf.fator_codigo,
        'significativo', rf.significativo_calculado,
        'prioridade', rf.prioridade_calculada,
        'tratamento', rf.tratamento_tecnico,
        'observacao', rf.observacao_tecnica,
        'justificativa', rf.justificativa,
        'ordem', rf.ordem_relatorio
      ) ORDER BY rf.ordem_relatorio)
      FROM public.psico_revisoes_fatores rf
      WHERE rf.revisao_id = _rev.id
    ),
    'plano', (
      SELECT jsonb_build_object(
        'status', p.status,
        'quantidade', p.quantidade_itens,
        'itens', (
          SELECT jsonb_agg(jsonb_build_object(
            'id', i.id,
            'titulo', i.titulo,
            'acao', i.acao_recomendada,
            'nivel', i.nivel_recomendacao,
            'grupo', i.grupo_transversal,
            'prioridade', i.prioridade,
            'prazo_dias', i.prazo_sugerido_dias,
            'responsavel', COALESCE(i.responsavel_definido, array_to_string(i.responsaveis_sugeridos, ', ')),
            'evidencias', i.evidencias_recomendadas,
            'abrangencia', i.abrangencia_rotulo,
            'fatores', (
              SELECT array_agg(fator_codigo)
              FROM public.psico_plano_item_fatores
              WHERE plano_item_id = i.id
            )
          ) ORDER BY i.ordem)
          FROM public.psico_plano_acao_itens i
          WHERE i.plano_id = p.id
            AND i.selecionado = true
        )
      )
      FROM public.psico_planos_acao p
      WHERE p.revisao_id = _rev.id
    ),
    'agregado', _agregado
  ) INTO _resultado;

  RETURN _resultado;
END $$;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(UUID) TO authenticated;