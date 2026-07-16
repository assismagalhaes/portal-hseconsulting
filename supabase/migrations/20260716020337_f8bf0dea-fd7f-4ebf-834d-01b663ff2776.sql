
-- FASE 9 — BLOCO 5

-- 1) Conteúdo aprovado do relatório com metadados de origem (REL-1.1 automático)
CREATE OR REPLACE FUNCTION public.psico_obter_conteudo_aprovado_relatorio(p_avaliacao_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rev RECORD; _av RECORD; _imp RECORD; _resultado JSONB; _agregado JSONB;
  _modelo_codigo TEXT := 'HSE-PSICO-REL-1.0';
  _modelo_versao TEXT := '1.0.0';
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO _av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF _av IS NULL THEN RETURN jsonb_build_object('ok',false,'code','AVALIACAO_NAO_LOCALIZADA'); END IF;
  SELECT * INTO _rev FROM public.psico_revisoes_tecnicas
    WHERE avaliacao_id = p_avaliacao_id AND status='aprovada' AND ativa=true
    ORDER BY aprovada_em DESC LIMIT 1;
  IF _rev IS NULL THEN RETURN jsonb_build_object('ok',false,'code','REVISAO_NAO_APROVADA'); END IF;

  IF _av.origem_coleta IN ('importacao_bruta','importacao_agregada') THEN
    _modelo_codigo := 'HSE-PSICO-REL-1.1';
    _modelo_versao := '1.1.0';
  END IF;

  IF _av.importacao_avaliacao_id IS NOT NULL THEN
    SELECT id, tipo, nome_arquivo, hash_arquivo_sha256, total_linhas,
           linhas_validas, linhas_invalidas, status, iniciado_em, concluido_em
      INTO _imp FROM public.psico_importacoes_avaliacoes WHERE id = _av.importacao_avaliacao_id;
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
      'importacao', CASE WHEN _imp IS NULL THEN NULL ELSE jsonb_build_object(
        'id', _imp.id, 'tipo', _imp.tipo, 'arquivo_nome', _imp.nome_arquivo,
        'arquivo_hash_sha256', _imp.hash_arquivo_sha256,
        'total_linhas', _imp.total_linhas,
        'linhas_validas', _imp.linhas_validas,
        'linhas_invalidas', _imp.linhas_invalidas,
        'status', _imp.status,
        'iniciada_em', _imp.iniciado_em,
        'finalizada_em', _imp.concluido_em
      ) END
    ),
    'avaliacao', jsonb_build_object('id',_av.id,'codigo',_av.codigo,'titulo',_av.titulo,
      'periodo', jsonb_build_object('inicio',_av.data_inicio_prevista,'fim',_av.data_fim_prevista)),
    'revisao', jsonb_build_object('id',_rev.id,'versao',_rev.versao,'aprovada_em',_rev.aprovada_em,
      'responsavel',_rev.responsavel_snapshot,'conclusao',_rev.conclusao_tecnica,
      'limitacoes',_rev.limitacoes,'contexto',_rev.contexto_organizacional,
      'recomendacao_geral',_rev.recomendacao_geral,'amostra_reduzida',_rev.amostra_reduzida),
    'biblioteca', (SELECT jsonb_build_object('codigo',codigo,'versao',versao,'nome',nome)
      FROM public.psico_bibliotecas_medidas_versoes WHERE id = _rev.biblioteca_versao_id),
    'fatores', (SELECT jsonb_agg(jsonb_build_object('fator_codigo',rf.fator_codigo,
      'significativo',rf.significativo_calculado,'prioridade',rf.prioridade_calculada,
      'tratamento',rf.tratamento_tecnico,'observacao',rf.observacao_tecnica,
      'justificativa',rf.justificativa,'ordem',rf.ordem_relatorio) ORDER BY rf.ordem_relatorio)
      FROM public.psico_revisoes_fatores rf WHERE rf.revisao_id = _rev.id),
    'plano', (SELECT jsonb_build_object('status',p.status,'quantidade',p.quantidade_itens,
      'itens', (SELECT jsonb_agg(jsonb_build_object('id',i.id,'titulo',i.titulo,
        'acao',i.acao_recomendada,'nivel',i.nivel_recomendacao,'grupo',i.grupo_transversal,
        'prioridade',i.prioridade,'prazo_dias',i.prazo_sugerido_dias,
        'responsavel',COALESCE(i.responsavel_definido,array_to_string(i.responsaveis_sugeridos,', ')),
        'evidencias',i.evidencias_recomendadas,'abrangencia',i.abrangencia_rotulo,
        'fatores', (SELECT array_agg(fator_codigo) FROM public.psico_plano_item_fatores
          WHERE plano_item_id = i.id)) ORDER BY i.ordem)
        FROM public.psico_plano_acao_itens i WHERE i.plano_id = p.id AND i.selecionado = true))
      FROM public.psico_planos_acao p WHERE p.revisao_id = _rev.id),
    'agregado', _agregado
  ) INTO _resultado;
  RETURN _resultado;
END $$;
REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(UUID) TO authenticated;

-- 2) View de auditoria
CREATE OR REPLACE VIEW public.psico_importacoes_auditoria AS
SELECT
  imp.id AS importacao_id,
  imp.cliente_id,
  c.razao_social AS cliente_razao_social,
  imp.tipo,
  imp.status,
  imp.nome_arquivo,
  imp.hash_arquivo_sha256,
  imp.total_linhas,
  imp.linhas_validas,
  imp.linhas_invalidas,
  imp.iniciado_por,
  imp.iniciado_em,
  imp.concluido_em,
  imp.avaliacao_id,
  av.codigo AS avaliacao_codigo,
  av.origem_coleta,
  av.participacao_calculavel,
  av.segmentacao_disponivel,
  (SELECT count(*) FROM public.psico_respostas r WHERE r.avaliacao_id = av.id) AS respostas_persistidas,
  (SELECT count(*) FROM public.psico_dados_agregados_perguntas d WHERE d.avaliacao_id = av.id) AS perguntas_agregadas,
  (SELECT count(*) FROM public.psico_convites cv WHERE cv.avaliacao_id = av.id) AS convites_criados,
  (SELECT count(*) FROM public.psico_participantes pt WHERE pt.avaliacao_id = av.id) AS participantes_criados
FROM public.psico_importacoes_avaliacoes imp
LEFT JOIN public.clients c ON c.id = imp.cliente_id
LEFT JOIN public.psico_avaliacoes av ON av.id = imp.avaliacao_id;

GRANT SELECT ON public.psico_importacoes_auditoria TO authenticated, service_role;

-- 3) Suíte de testes de integridade e privacidade
CREATE OR REPLACE FUNCTION public.psico_importacao_testes_integridade()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_resultados jsonb := '[]'::jsonb;
  v_ok boolean; v_qtd int;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE='42501';
  END IF;

  -- T1: staging sem colunas de PII
  SELECT count(*) INTO v_qtd FROM information_schema.columns
   WHERE table_schema='public' AND table_name='psico_importacao_staging_respostas'
     AND column_name IN ('nome','nome_completo','email','telefone','celular','cpf','rg','matricula');
  v_ok := (v_qtd = 0);
  v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
    'teste','staging_sem_pii','ok',v_ok,'contagem',v_qtd,
    'mensagem', CASE WHEN v_ok THEN 'Sem colunas de PII no staging técnico' ELSE 'Coluna de PII presente no staging' END));

  -- T2: agregada sem respostas individuais
  SELECT count(*) INTO v_qtd
    FROM public.psico_avaliacoes av
    JOIN public.psico_respostas r ON r.avaliacao_id = av.id
   WHERE av.origem_coleta = 'importacao_agregada';
  v_ok := (v_qtd = 0);
  v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
    'teste','agregada_sem_respostas','ok',v_ok,'contagem',v_qtd,
    'mensagem', CASE WHEN v_ok THEN 'Nenhuma resposta sintética criada em avaliação agregada' ELSE 'Respostas encontradas em avaliação agregada' END));

  -- T3: agregada sem convites/participantes
  SELECT count(*) INTO v_qtd
    FROM public.psico_avaliacoes av
    WHERE av.origem_coleta = 'importacao_agregada'
      AND (EXISTS (SELECT 1 FROM public.psico_convites cv WHERE cv.avaliacao_id = av.id)
        OR EXISTS (SELECT 1 FROM public.psico_participantes pt WHERE pt.avaliacao_id = av.id));
  v_ok := (v_qtd = 0);
  v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
    'teste','agregada_sem_convites_ou_participantes','ok',v_ok,'contagem',v_qtd,
    'mensagem', CASE WHEN v_ok THEN 'Nenhum convite/participante artificial em agregadas' ELSE 'Convites ou participantes indevidos' END));

  -- T4: bruta sem convites
  SELECT count(*) INTO v_qtd
    FROM public.psico_avaliacoes av
    JOIN public.psico_convites cv ON cv.avaliacao_id = av.id
   WHERE av.origem_coleta = 'importacao_bruta';
  v_ok := (v_qtd = 0);
  v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
    'teste','bruta_sem_convites','ok',v_ok,'contagem',v_qtd,
    'mensagem', CASE WHEN v_ok THEN 'Nenhum convite artificial em importação bruta' ELSE 'Convite indevido em importação bruta' END));

  -- T5: somas coerentes nos agregados
  SELECT count(*) INTO v_qtd FROM public.psico_dados_agregados_perguntas d
   WHERE d.total_respostas IS DISTINCT FROM (
     coalesce(d.quantidade_nunca,0)+coalesce(d.quantidade_raramente,0)+
     coalesce(d.quantidade_as_vezes,0)+coalesce(d.quantidade_frequentemente,0)+
     coalesce(d.quantidade_sempre,0));
  v_ok := (v_qtd = 0);
  v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
    'teste','agregado_soma_coerente','ok',v_ok,'contagem',v_qtd,
    'mensagem', CASE WHEN v_ok THEN 'Somas coerentes' ELSE 'Divergência nas contagens agregadas' END));

  -- T6: origem_coleta populada em todas as avaliações
  SELECT count(*) INTO v_qtd FROM public.psico_avaliacoes WHERE origem_coleta IS NULL;
  v_ok := (v_qtd = 0);
  v_resultados := v_resultados || jsonb_build_array(jsonb_build_object(
    'teste','avaliacoes_com_origem','ok',v_ok,'contagem',v_qtd,
    'mensagem', CASE WHEN v_ok THEN 'Todas as avaliações têm origem definida' ELSE 'Avaliações sem origem_coleta' END));

  RETURN jsonb_build_object(
    'executado_em', now(),
    'total', jsonb_array_length(v_resultados),
    'aprovados', (SELECT count(*) FROM jsonb_array_elements(v_resultados) x WHERE (x->>'ok')::boolean),
    'resultados', v_resultados);
END $$;
REVOKE ALL ON FUNCTION public.psico_importacao_testes_integridade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_importacao_testes_integridade() TO authenticated, service_role;
