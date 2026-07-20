CREATE OR REPLACE FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_metodologia(p_avaliacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rev RECORD;
  _av RECORD;
  _imp_id uuid;
  _imp_tipo public.psico_importacao_tipo;
  _imp_nome_arquivo text;
  _imp_hash_arquivo_sha256 text;
  _imp_total_linhas integer;
  _imp_linhas_validas integer;
  _imp_linhas_invalidas integer;
  _imp_status public.psico_importacao_status;
  _imp_iniciado_em timestamptz;
  _imp_concluido_em timestamptz;
  _resultado jsonb;
  _agregado jsonb;
  _tem_importacao boolean := false;
  _modelo_codigo text := 'HSE-PSICO-REL-1.0';
  _modelo_versao text := '1.0.0';
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
    SELECT
      i.id,
      i.tipo,
      i.nome_arquivo,
      i.hash_arquivo_sha256,
      i.total_linhas,
      i.linhas_validas,
      i.linhas_invalidas,
      i.status,
      i.iniciado_em,
      i.concluido_em
    INTO
      _imp_id,
      _imp_tipo,
      _imp_nome_arquivo,
      _imp_hash_arquivo_sha256,
      _imp_total_linhas,
      _imp_linhas_validas,
      _imp_linhas_invalidas,
      _imp_status,
      _imp_iniciado_em,
      _imp_concluido_em
    FROM public.psico_importacoes_avaliacoes i
    WHERE i.id = _av.importacao_avaliacao_id;

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
        'id', _imp_id,
        'tipo', _imp_tipo::text,
        'arquivo_nome', _imp_nome_arquivo,
        'arquivo_hash_sha256', _imp_hash_arquivo_sha256,
        'total_linhas', _imp_total_linhas,
        'linhas_validas', _imp_linhas_validas,
        'linhas_invalidas', _imp_linhas_invalidas,
        'status', _imp_status::text,
        'iniciada_em', _imp_iniciado_em,
        'finalizada_em', _imp_concluido_em
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
    'plano_acao', (
      SELECT jsonb_agg(jsonb_build_object(
        'id', pai.id,
        'titulo', pai.titulo,
        'descricao', pai.descricao,
        'prioridade', pai.prioridade,
        'prazo', pai.prazo_previsto,
        'responsavel', pai.responsavel_snapshot,
        'status', pai.status,
        'fatores', (
          SELECT jsonb_agg(pif.fator_codigo)
          FROM public.psico_plano_item_fatores pif
          WHERE pif.plano_item_id = pai.id
        )
      ) ORDER BY pai.prioridade, pai.created_at)
      FROM public.psico_plano_acao_itens pai
      JOIN public.psico_planos_acao pa ON pa.id = pai.plano_id
      WHERE pa.avaliacao_id = p_avaliacao_id AND pa.ativo = true
    ),
    'agregado', _agregado
  ) INTO _resultado;

  RETURN _resultado;
END
$function$;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_metodologia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio_sem_metodologia(uuid) TO service_role;

REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(uuid) TO service_role;