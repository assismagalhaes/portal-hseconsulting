-- ==================== RPCs Fase 7 ====================

CREATE OR REPLACE FUNCTION public.psico_validar_biblioteca_medidas(p_biblioteca_versao_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _b RECORD; _erros TEXT[] := '{}'; _avisos TEXT[] := '{}';
  _total_fatores INT; _total_medidas INT; _por_fator JSONB;
  _fatores_esperados TEXT[] := ARRAY['carga_excessiva','falta_autonomia','conflitos_hierarquicos','relacoes_interpessoais','conflitos_interpessoais','falta_clareza','gestao_mudancas'];
  _contagens_esperadas JSONB := jsonb_build_object(
    'carga_excessiva',7,'falta_autonomia',7,'conflitos_hierarquicos',8,
    'relacoes_interpessoais',8,'conflitos_interpessoais',8,'falta_clareza',7,'gestao_mudancas',6
  );
  _fk TEXT; _sem_conteudo JSONB := '[]'::jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO _b FROM public.psico_bibliotecas_medidas_versoes WHERE id = p_biblioteca_versao_id;
  IF _b IS NULL THEN RETURN jsonb_build_object('valido',false,'erros',ARRAY['BIBLIOTECA_NAO_LOCALIZADA']); END IF;
  IF _b.metodologia_versao_id IS NULL THEN _erros := _erros || 'METODOLOGIA_NAO_VINCULADA'; END IF;
  SELECT COUNT(*) INTO _total_fatores FROM public.psico_fatores_orientacoes WHERE biblioteca_versao_id = p_biblioteca_versao_id;
  IF _total_fatores <> 7 THEN _erros := _erros || format('FATORES_INCORRETOS:%s', _total_fatores); END IF;
  SELECT COUNT(*) INTO _total_medidas FROM public.psico_medidas_modelos WHERE biblioteca_versao_id = p_biblioteca_versao_id;
  IF _total_medidas <> 51 THEN _erros := _erros || format('MEDIDAS_INCORRETAS:%s', _total_medidas); END IF;
  SELECT jsonb_object_agg(fator_codigo, cnt) INTO _por_fator FROM (
    SELECT fator_codigo, COUNT(*)::int AS cnt FROM public.psico_medidas_modelos
      WHERE biblioteca_versao_id = p_biblioteca_versao_id GROUP BY fator_codigo) x;
  FOREACH _fk IN ARRAY _fatores_esperados LOOP
    IF COALESCE((_por_fator->>_fk)::int, 0) <> (_contagens_esperadas->>_fk)::int THEN
      _erros := _erros || format('CONTAGEM_FATOR_%s:%s_esperado_%s', _fk, COALESCE((_por_fator->>_fk)::int,0), (_contagens_esperadas->>_fk)::int);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.psico_fatores_orientacoes WHERE biblioteca_versao_id = p_biblioteca_versao_id AND fator_codigo = _fk) THEN
      _erros := _erros || format('ORIENTACAO_AUSENTE:%s', _fk);
    END IF;
  END LOOP;
  SELECT jsonb_agg(codigo) INTO _sem_conteudo FROM public.psico_medidas_modelos
    WHERE biblioteca_versao_id = p_biblioteca_versao_id
      AND (LENGTH(COALESCE(o_que_significa,'')) < 30
        OR cardinality(orientacoes_praticas) = 0
        OR cardinality(exemplos_aplicacao) = 0
        OR cardinality(responsaveis_sugeridos) = 0
        OR cardinality(evidencias_recomendadas) = 0);
  IF jsonb_array_length(COALESCE(_sem_conteudo,'[]'::jsonb)) > 0 THEN
    _erros := _erros || 'MEDIDAS_SEM_CONTEUDO_MINIMO';
  END IF;
  IF EXISTS (SELECT 1 FROM public.psico_medidas_modelos
    WHERE biblioteca_versao_id = p_biblioteca_versao_id
      AND (o_que_significa ILIKE '%acima da média%' OR o_que_significa ILIKE '%por trabalhador%' OR o_que_significa ILIKE '%NALU%')) THEN
    _erros := _erros || 'CONTEUDO_PROIBIDO_DETECTADO';
  END IF;
  RETURN jsonb_build_object('valido', cardinality(_erros)=0, 'total_fatores',_total_fatores,'total_medidas',_total_medidas,
    'contagem_por_fator',COALESCE(_por_fator,'{}'::jsonb),'medidas_sem_conteudo',COALESCE(_sem_conteudo,'[]'::jsonb),'erros',_erros,'avisos',_avisos);
END $$;
REVOKE ALL ON FUNCTION public.psico_validar_biblioteca_medidas(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_validar_biblioteca_medidas(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_publicar_biblioteca_medidas(p_biblioteca_versao_id UUID, p_confirmacao TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _b RECORD; _val JSONB; _esperado TEXT;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO _b FROM public.psico_bibliotecas_medidas_versoes WHERE id = p_biblioteca_versao_id FOR UPDATE;
  IF _b IS NULL THEN RAISE EXCEPTION 'BIBLIOTECA_NAO_LOCALIZADA'; END IF;
  _esperado := 'PUBLICAR ' || _b.codigo || '-' || _b.versao;
  IF p_confirmacao <> _esperado THEN RAISE EXCEPTION 'CONFIRMACAO_INVALIDA: use "%"', _esperado; END IF;
  IF _b.status <> 'em_configuracao' THEN RAISE EXCEPTION 'STATUS_INCOMPATIVEL:%', _b.status; END IF;
  _val := public.psico_validar_biblioteca_medidas(p_biblioteca_versao_id);
  IF (_val->>'valido')::boolean = false THEN RAISE EXCEPTION 'VALIDACAO_FALHOU: %', _val->>'erros'; END IF;
  UPDATE public.psico_bibliotecas_medidas_versoes SET vigente = false WHERE vigente = true;
  UPDATE public.psico_bibliotecas_medidas_versoes
    SET status='publicada', vigente=true, publicado_por=auth.uid(), publicado_em=now()
    WHERE id = p_biblioteca_versao_id;
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
    VALUES ('biblioteca_medidas', p_biblioteca_versao_id, 'biblioteca_medidas_publicada',
      jsonb_build_object('codigo',_b.codigo,'versao',_b.versao,'total_medidas',_val->>'total_medidas'), auth.uid(), now());
  RETURN jsonb_build_object('ok', true, 'biblioteca_id', p_biblioteca_versao_id);
END $$;
REVOKE ALL ON FUNCTION public.psico_publicar_biblioteca_medidas(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_publicar_biblioteca_medidas(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_duplicar_biblioteca_medidas(p_biblioteca_versao_id UUID, p_nova_versao TEXT, p_novo_nome TEXT DEFAULT NULL)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _origem RECORD; _novo_id UUID;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO _origem FROM public.psico_bibliotecas_medidas_versoes WHERE id = p_biblioteca_versao_id;
  IF _origem IS NULL THEN RAISE EXCEPTION 'BIBLIOTECA_NAO_LOCALIZADA'; END IF;
  INSERT INTO public.psico_bibliotecas_medidas_versoes
    (codigo, nome, versao, metodologia_versao_id, descricao, fonte, status, vigente, quantidade_fatores_prevista, quantidade_medidas_prevista, criado_por, metadados)
  VALUES (_origem.codigo, COALESCE(p_novo_nome,_origem.nome), p_nova_versao, _origem.metodologia_versao_id, _origem.descricao, _origem.fonte,
    'em_configuracao', false, _origem.quantidade_fatores_prevista, _origem.quantidade_medidas_prevista, auth.uid(),
    jsonb_build_object('duplicada_de', p_biblioteca_versao_id))
  RETURNING id INTO _novo_id;
  INSERT INTO public.psico_fatores_orientacoes
    (biblioteca_versao_id, fator_codigo, nome, ordem, definicao_resumida, impactos_possiveis, situacoes_associadas, objetivo_medidas, perguntas_avaliacao_interna, orientacao_priorizacao, observacao_final, ativo)
  SELECT _novo_id, fator_codigo, nome, ordem, definicao_resumida, impactos_possiveis, situacoes_associadas, objetivo_medidas, perguntas_avaliacao_interna, orientacao_priorizacao, observacao_final, ativo
  FROM public.psico_fatores_orientacoes WHERE biblioteca_versao_id = p_biblioteca_versao_id;
  INSERT INTO public.psico_medidas_modelos
    (biblioteca_versao_id, fator_codigo, codigo, ordem, titulo, nivel_recomendacao, grupo_transversal, o_que_significa, orientacoes_praticas, exemplos_aplicacao, responsaveis_sugeridos, evidencias_recomendadas, indicadores_sugeridos, prazo_sugerido_dias, complexidade, custo_estimado, observacoes, ativo)
  SELECT _novo_id, fator_codigo, codigo, ordem, titulo, nivel_recomendacao, grupo_transversal, o_que_significa, orientacoes_praticas, exemplos_aplicacao, responsaveis_sugeridos, evidencias_recomendadas, indicadores_sugeridos, prazo_sugerido_dias, complexidade, custo_estimado, observacoes, ativo
  FROM public.psico_medidas_modelos WHERE biblioteca_versao_id = p_biblioteca_versao_id;
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
    VALUES ('biblioteca_medidas', _novo_id, 'biblioteca_medidas_duplicada', jsonb_build_object('origem',p_biblioteca_versao_id,'nova_versao',p_nova_versao), auth.uid(), now());
  RETURN _novo_id;
END $$;
REVOKE ALL ON FUNCTION public.psico_duplicar_biblioteca_medidas(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_duplicar_biblioteca_medidas(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_gerar_recomendacoes_internal(p_revisao_id UUID, p_substituir_geradas BOOLEAN DEFAULT true)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rev RECORD; _plano_id UUID; _item_id UUID; _total INT := 0; _limite INT := 12;
  _fator RECORD; _medida RECORD; _prazo INT; _prio TEXT;
  _grupos_usados TEXT[] := '{}';
BEGIN
  SELECT r.*, b.id AS biblioteca_id INTO _rev
    FROM public.psico_revisoes_tecnicas r
    JOIN public.psico_bibliotecas_medidas_versoes b ON b.id = r.biblioteca_versao_id
    WHERE r.id = p_revisao_id;
  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  SELECT id INTO _plano_id FROM public.psico_planos_acao WHERE revisao_id = p_revisao_id;
  IF _plano_id IS NULL THEN
    INSERT INTO public.psico_planos_acao(revisao_id, criado_por) VALUES (p_revisao_id, auth.uid()) RETURNING id INTO _plano_id;
  END IF;
  IF p_substituir_geradas THEN
    DELETE FROM public.psico_plano_acao_itens WHERE plano_id = _plano_id AND gerado_automaticamente = true AND personalizado = false;
  END IF;
  FOR _fator IN
    SELECT rf.id, rf.revisao_id, rf.resultado_fator_id, rf.fator_codigo, rf.prioridade_calculada
      FROM public.psico_revisoes_fatores rf
      WHERE rf.revisao_id = p_revisao_id AND rf.significativo_calculado = true
      ORDER BY CASE rf.prioridade_calculada WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END
  LOOP
    _prio := _fator.prioridade_calculada;
    _prazo := CASE _prio WHEN 'critica' THEN 30 WHEN 'alta' THEN 60 WHEN 'media' THEN 90 ELSE 180 END;
    FOR _medida IN
      SELECT * FROM public.psico_medidas_modelos
        WHERE biblioteca_versao_id = _rev.biblioteca_id
          AND fator_codigo = _fator.fator_codigo
          AND nivel_recomendacao IN ('essencial','complementar')
          AND ativo = true
        ORDER BY CASE nivel_recomendacao WHEN 'essencial' THEN 1 ELSE 2 END, ordem
        LIMIT 5
    LOOP
      IF _total >= _limite THEN EXIT; END IF;
      IF _medida.grupo_transversal IS NOT NULL AND _medida.grupo_transversal = ANY(_grupos_usados) THEN
        INSERT INTO public.psico_plano_item_fatores(plano_item_id, resultado_fator_id, fator_codigo)
          SELECT i.id, _fator.resultado_fator_id, _fator.fator_codigo
          FROM public.psico_plano_acao_itens i
          WHERE i.plano_id = _plano_id AND i.grupo_transversal = _medida.grupo_transversal
          ORDER BY i.criado_em DESC LIMIT 1
          ON CONFLICT DO NOTHING;
        CONTINUE;
      END IF;
      INSERT INTO public.psico_plano_acao_itens
        (plano_id, medida_modelo_id, codigo_origem, titulo, acao_recomendada, objetivo, orientacoes_praticas, exemplos_aplicacao,
         nivel_recomendacao, grupo_transversal, prioridade, responsaveis_sugeridos, prazo_sugerido_dias, prazo_sugerido_texto,
         evidencias_recomendadas, gerado_automaticamente, selecionado, ordem)
      VALUES (_plano_id, _medida.id, _medida.codigo, _medida.titulo, _medida.o_que_significa,
        (SELECT objetivo_medidas FROM public.psico_fatores_orientacoes WHERE biblioteca_versao_id = _rev.biblioteca_id AND fator_codigo = _fator.fator_codigo),
        _medida.orientacoes_praticas, _medida.exemplos_aplicacao, _medida.nivel_recomendacao::text, _medida.grupo_transversal,
        _prio, _medida.responsaveis_sugeridos, _prazo, format('Sugestão de %s dias (ajustável pela empresa)', _prazo),
        _medida.evidencias_recomendadas, true, true, _total + 1)
      RETURNING id INTO _item_id;
      INSERT INTO public.psico_plano_item_fatores(plano_item_id, resultado_fator_id, fator_codigo)
        VALUES (_item_id, _fator.resultado_fator_id, _fator.fator_codigo)
        ON CONFLICT DO NOTHING;
      IF _medida.grupo_transversal IS NOT NULL THEN _grupos_usados := _grupos_usados || _medida.grupo_transversal; END IF;
      _total := _total + 1;
    END LOOP;
  END LOOP;
  UPDATE public.psico_planos_acao p
    SET quantidade_itens = (SELECT COUNT(*) FROM public.psico_plano_acao_itens WHERE plano_id = p.id),
        atualizado_em = now()
    WHERE p.revisao_id = p_revisao_id;
  RETURN _total;
END $$;

CREATE OR REPLACE FUNCTION public.psico_criar_revisao_tecnica(p_avaliacao_id UUID, p_modo TEXT DEFAULT 'rapida')
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _av RECORD; _proc RECORD; _biblio_id UUID; _rev_id UUID; _plano_id UUID;
  _sig_count INT; _prio_max TEXT; _concl TEXT; _amostra_red BOOLEAN;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO _av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id FOR UPDATE;
  IF _av IS NULL THEN RAISE EXCEPTION 'AVALIACAO_NAO_LOCALIZADA'; END IF;
  IF _av.status NOT IN ('resultado_pronto','relatorio_emitido') THEN RAISE EXCEPTION 'STATUS_INCOMPATIVEL:%', _av.status; END IF;
  SELECT * INTO _proc FROM public.psico_resultado_processamentos WHERE avaliacao_id = p_avaliacao_id AND status = 'concluido' ORDER BY concluido_em DESC LIMIT 1;
  IF _proc IS NULL THEN RAISE EXCEPTION 'PROCESSAMENTO_NAO_LOCALIZADO'; END IF;
  SELECT id INTO _biblio_id FROM public.psico_bibliotecas_medidas_versoes WHERE vigente = true AND status = 'publicada' LIMIT 1;
  IF _biblio_id IS NULL THEN RAISE EXCEPTION 'BIBLIOTECA_VIGENTE_INDISPONIVEL'; END IF;
  IF EXISTS (SELECT 1 FROM public.psico_revisoes_tecnicas WHERE processamento_id = _proc.id AND ativa = true) THEN
    RAISE EXCEPTION 'REVISAO_ATIVA_JA_EXISTE';
  END IF;
  SELECT COALESCE(bool_or(amostra_reduzida), false) INTO _amostra_red FROM public.psico_resultado_escopos WHERE processamento_id = _proc.id AND tipo = 'global';
  SELECT COUNT(*) INTO _sig_count FROM public.psico_resultados_fatores rf JOIN public.psico_resultado_escopos e ON e.id = rf.escopo_id WHERE e.processamento_id = _proc.id AND e.tipo = 'global' AND rf.significativo = true;
  SELECT CASE WHEN bool_or(rf.prioridade::text='critica') THEN 'critica' WHEN bool_or(rf.prioridade::text='alta') THEN 'alta' WHEN bool_or(rf.prioridade::text='media') THEN 'media' ELSE 'baixa' END INTO _prio_max
    FROM public.psico_resultados_fatores rf JOIN public.psico_resultado_escopos e ON e.id = rf.escopo_id WHERE e.processamento_id = _proc.id AND e.tipo = 'global' AND rf.significativo = true;
  IF _sig_count = 0 THEN
    _concl := 'Com base nos critérios internos 50% / 30% / 10%, nenhum dos sete fatores avaliados foi classificado como significativo. Recomenda-se manter o monitoramento preventivo das condições e da organização do trabalho.';
  ELSE
    _concl := format('Foram identificados %s fatores significativos entre os sete fatores avaliados. A maior prioridade observada foi %s. Recomenda-se a adoção gradual das medidas selecionadas, com atenção inicial aos fatores de maior prioridade.', _sig_count, COALESCE(_prio_max,'Média'));
  END IF;
  IF _amostra_red THEN
    _concl := _concl || E'\n\nA avaliação possui amostra reduzida. Os resultados globais devem ser interpretados com cautela e não foram geradas segmentações.';
  END IF;
  _concl := _concl || E'\n\nOs resultados devem ser considerados em conjunto com as condições reais de trabalho. As medidas propostas são recomendações técnicas e devem ser avaliadas e adaptadas pela empresa.';
  INSERT INTO public.psico_revisoes_tecnicas
    (avaliacao_id, processamento_id, biblioteca_versao_id, modo, conclusao_sugerida, conclusao_tecnica, amostra_reduzida, criada_por)
  VALUES (p_avaliacao_id, _proc.id, _biblio_id, p_modo::public.psico_revisao_modo, _concl, _concl, _amostra_red, auth.uid())
  RETURNING id INTO _rev_id;
  INSERT INTO public.psico_revisoes_fatores (revisao_id, resultado_fator_id, fator_codigo, significativo_calculado, prioridade_calculada, tratamento_tecnico, ordem_relatorio)
  SELECT _rev_id, rf.id, f.codigo, rf.significativo, COALESCE(rf.prioridade::text,'baixa'),
         CASE WHEN rf.significativo THEN 'acao_recomendada' ELSE 'monitoramento_preventivo' END::public.psico_tratamento_tecnico,
         ROW_NUMBER() OVER (ORDER BY CASE rf.prioridade::text WHEN 'critica' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END, f.codigo)
    FROM public.psico_resultados_fatores rf
    JOIN public.psico_resultado_escopos e ON e.id = rf.escopo_id
    JOIN public.psico_fatores f ON f.id = rf.fator_id
    WHERE e.processamento_id = _proc.id AND e.tipo = 'global';
  PERFORM public.psico_gerar_recomendacoes_internal(_rev_id, true);
  SELECT id INTO _plano_id FROM public.psico_planos_acao WHERE revisao_id = _rev_id;
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
    VALUES ('revisao_tecnica', _rev_id, 'revisao_tecnica_criada',
      jsonb_build_object('avaliacao_id',p_avaliacao_id,'sig_count',_sig_count,'prio_max',_prio_max), auth.uid(), now());
  RETURN jsonb_build_object('ok',true,'revisao_id',_rev_id,'plano_id',_plano_id);
END $$;
REVOKE ALL ON FUNCTION public.psico_criar_revisao_tecnica(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_criar_revisao_tecnica(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_regenerar_recomendacoes(p_revisao_id UUID, p_confirmacao TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rev RECORD; _n INT;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  IF p_confirmacao <> 'REGENERAR' THEN RAISE EXCEPTION 'CONFIRMACAO_INVALIDA'; END IF;
  SELECT * INTO _rev FROM public.psico_revisoes_tecnicas WHERE id = p_revisao_id;
  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  IF _rev.status <> 'rascunho' THEN RAISE EXCEPTION 'STATUS_INCOMPATIVEL:%', _rev.status; END IF;
  _n := public.psico_gerar_recomendacoes_internal(p_revisao_id, true);
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
    VALUES ('revisao_tecnica', p_revisao_id, 'recomendacoes_regeneradas', jsonb_build_object('itens', _n), auth.uid(), now());
  RETURN jsonb_build_object('ok', true, 'itens', _n);
END $$;
REVOKE ALL ON FUNCTION public.psico_regenerar_recomendacoes(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_regenerar_recomendacoes(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_validar_revisao_tecnica(p_revisao_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rev RECORD; _erros TEXT[] := '{}'; _avisos TEXT[] := '{}';
  _fatores_sig INT; _com_acao INT; _itens INT; _sem_resp INT; _sem_prazo INT; _sem_evid INT;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO _rev FROM public.psico_revisoes_tecnicas WHERE id = p_revisao_id;
  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  IF _rev.responsavel_tecnico_id IS NULL THEN _erros := _erros || 'RESPONSAVEL_TECNICO_AUSENTE'; END IF;
  IF LENGTH(COALESCE(_rev.conclusao_tecnica,'')) < 50 THEN _erros := _erros || 'CONCLUSAO_INCOMPLETA'; END IF;
  IF LENGTH(COALESCE(_rev.limitacoes,'')) < 10 THEN _erros := _erros || 'LIMITACOES_INCOMPLETAS'; END IF;
  SELECT COUNT(*) INTO _fatores_sig FROM public.psico_revisoes_fatores WHERE revisao_id = p_revisao_id AND significativo_calculado = true;
  SELECT COUNT(DISTINCT pif.fator_codigo) INTO _com_acao
    FROM public.psico_plano_item_fatores pif
    JOIN public.psico_plano_acao_itens i ON i.id = pif.plano_item_id
    JOIN public.psico_planos_acao p ON p.id = i.plano_id
    WHERE p.revisao_id = p_revisao_id AND i.selecionado = true;
  IF _fatores_sig > 0 AND _com_acao < _fatores_sig THEN
    IF EXISTS (SELECT 1 FROM public.psico_revisoes_fatores WHERE revisao_id = p_revisao_id AND significativo_calculado = true
      AND tratamento_tecnico <> 'sem_acao_especifica'
      AND fator_codigo NOT IN (SELECT DISTINCT pif.fator_codigo FROM public.psico_plano_item_fatores pif
        JOIN public.psico_plano_acao_itens i ON i.id = pif.plano_item_id
        JOIN public.psico_planos_acao p ON p.id = i.plano_id WHERE p.revisao_id = p_revisao_id AND i.selecionado = true)) THEN
      _erros := _erros || 'FATOR_SIGNIFICATIVO_SEM_ACAO';
    END IF;
  END IF;
  SELECT COUNT(*) INTO _itens FROM public.psico_plano_acao_itens i JOIN public.psico_planos_acao p ON p.id = i.plano_id
    WHERE p.revisao_id = p_revisao_id AND i.selecionado = true;
  SELECT COUNT(*) INTO _sem_resp FROM public.psico_plano_acao_itens i JOIN public.psico_planos_acao p ON p.id = i.plano_id
    WHERE p.revisao_id = p_revisao_id AND i.selecionado = true AND (i.responsavel_definido IS NULL AND cardinality(i.responsaveis_sugeridos) = 0);
  SELECT COUNT(*) INTO _sem_prazo FROM public.psico_plano_acao_itens i JOIN public.psico_planos_acao p ON p.id = i.plano_id
    WHERE p.revisao_id = p_revisao_id AND i.selecionado = true AND i.prazo_sugerido_dias IS NULL;
  SELECT COUNT(*) INTO _sem_evid FROM public.psico_plano_acao_itens i JOIN public.psico_planos_acao p ON p.id = i.plano_id
    WHERE p.revisao_id = p_revisao_id AND i.selecionado = true AND cardinality(i.evidencias_recomendadas) = 0;
  IF _sem_resp > 0 THEN _erros := _erros || format('ITENS_SEM_RESPONSAVEL:%s', _sem_resp); END IF;
  IF _sem_prazo > 0 THEN _erros := _erros || format('ITENS_SEM_PRAZO:%s', _sem_prazo); END IF;
  IF _sem_evid > 0 THEN _erros := _erros || format('ITENS_SEM_EVIDENCIA:%s', _sem_evid); END IF;
  RETURN jsonb_build_object('valido', cardinality(_erros)=0, 'erros',_erros,'avisos',_avisos,'fatores_significativos',_fatores_sig,'itens',_itens);
END $$;
REVOKE ALL ON FUNCTION public.psico_validar_revisao_tecnica(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_validar_revisao_tecnica(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_aprovar_revisao_tecnica(p_revisao_id UUID, p_confirmacao TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rev RECORD; _val JSONB; _esperado TEXT; _snap JSONB;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT r.*, a.codigo AS avaliacao_codigo INTO _rev
    FROM public.psico_revisoes_tecnicas r JOIN public.psico_avaliacoes a ON a.id = r.avaliacao_id
    WHERE r.id = p_revisao_id FOR UPDATE;
  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  _esperado := 'APROVAR ' || _rev.avaliacao_codigo;
  IF p_confirmacao <> _esperado THEN RAISE EXCEPTION 'CONFIRMACAO_INVALIDA: use "%"', _esperado; END IF;
  IF _rev.status = 'aprovada' THEN RAISE EXCEPTION 'REVISAO_JA_APROVADA'; END IF;
  _val := public.psico_validar_revisao_tecnica(p_revisao_id);
  IF (_val->>'valido')::boolean = false THEN RAISE EXCEPTION 'CHECKLIST_INCOMPLETO: %', _val->>'erros'; END IF;
  SELECT jsonb_build_object(
    'nome', COALESCE(nome, email),
    'email', email,
    'cargo', COALESCE(cargo, 'Não informado'),
    'registro_profissional', COALESCE(registro_profissional, 'Não aplicável'),
    'aprovado_em', now()
  ) INTO _snap FROM public.profiles WHERE id = _rev.responsavel_tecnico_id;
  UPDATE public.psico_revisoes_tecnicas
    SET status='aprovada', aprovada_por=auth.uid(), aprovada_em=now(),
        responsavel_snapshot=_snap, atualizada_por=auth.uid()
    WHERE id = p_revisao_id;
  UPDATE public.psico_planos_acao
    SET status='aprovado', aprovado_em=now(), atualizado_por=auth.uid()
    WHERE revisao_id = p_revisao_id;
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
    VALUES ('revisao_tecnica', p_revisao_id, 'revisao_aprovada',
      jsonb_build_object('avaliacao_codigo',_rev.avaliacao_codigo,'itens',_val->>'itens'), auth.uid(), now());
  RETURN jsonb_build_object('ok',true,'revisao_id',p_revisao_id,'status','aprovada');
END $$;
REVOKE ALL ON FUNCTION public.psico_aprovar_revisao_tecnica(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_aprovar_revisao_tecnica(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_reabrir_revisao_tecnica(p_revisao_id UUID, p_motivo TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rev RECORD;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  IF LENGTH(COALESCE(p_motivo,'')) < 20 THEN RAISE EXCEPTION 'MOTIVO_INSUFICIENTE_MIN_20'; END IF;
  SELECT * INTO _rev FROM public.psico_revisoes_tecnicas WHERE id = p_revisao_id FOR UPDATE;
  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  IF _rev.status <> 'aprovada' THEN RAISE EXCEPTION 'STATUS_INCOMPATIVEL:%', _rev.status; END IF;
  IF EXISTS (SELECT 1 FROM public.psico_avaliacoes WHERE id = _rev.avaliacao_id AND status = 'relatorio_emitido') THEN
    RAISE EXCEPTION 'RELATORIO_JA_EMITIDO_CRIE_NOVA_VERSAO';
  END IF;
  UPDATE public.psico_revisoes_tecnicas SET status='reaberta', reaberta_por=auth.uid(), reaberta_em=now(), motivo_reabertura=p_motivo WHERE id = p_revisao_id;
  UPDATE public.psico_planos_acao SET status='rascunho' WHERE revisao_id = p_revisao_id;
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
    VALUES ('revisao_tecnica', p_revisao_id, 'revisao_reaberta', jsonb_build_object('motivo_hash', md5(p_motivo)), auth.uid(), now());
  RETURN jsonb_build_object('ok', true);
END $$;
REVOKE ALL ON FUNCTION public.psico_reabrir_revisao_tecnica(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_reabrir_revisao_tecnica(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_obter_conteudo_aprovado_relatorio(p_avaliacao_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _rev RECORD; _av RECORD; _resultado JSONB;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO _av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF _av IS NULL THEN RETURN jsonb_build_object('ok',false,'code','AVALIACAO_NAO_LOCALIZADA'); END IF;
  SELECT * INTO _rev FROM public.psico_revisoes_tecnicas WHERE avaliacao_id = p_avaliacao_id AND status='aprovada' AND ativa=true ORDER BY aprovada_em DESC LIMIT 1;
  IF _rev IS NULL THEN RETURN jsonb_build_object('ok',false,'code','REVISAO_NAO_APROVADA'); END IF;
  SELECT jsonb_build_object(
    'ok', true,
    'avaliacao', jsonb_build_object('id',_av.id,'codigo',_av.codigo,'titulo',_av.titulo,'periodo',jsonb_build_object('inicio',_av.data_inicio_prevista,'fim',_av.data_fim_prevista)),
    'revisao', jsonb_build_object('id',_rev.id,'versao',_rev.versao,'aprovada_em',_rev.aprovada_em,'responsavel',_rev.responsavel_snapshot,'conclusao',_rev.conclusao_tecnica,'limitacoes',_rev.limitacoes,'contexto',_rev.contexto_organizacional,'recomendacao_geral',_rev.recomendacao_geral,'amostra_reduzida',_rev.amostra_reduzida),
    'biblioteca', (SELECT jsonb_build_object('codigo',codigo,'versao',versao,'nome',nome) FROM public.psico_bibliotecas_medidas_versoes WHERE id = _rev.biblioteca_versao_id),
    'fatores', (SELECT jsonb_agg(jsonb_build_object('fator_codigo',rf.fator_codigo,'significativo',rf.significativo_calculado,'prioridade',rf.prioridade_calculada,'tratamento',rf.tratamento_tecnico,'observacao',rf.observacao_tecnica,'justificativa',rf.justificativa,'ordem',rf.ordem_relatorio) ORDER BY rf.ordem_relatorio) FROM public.psico_revisoes_fatores rf WHERE rf.revisao_id = _rev.id),
    'plano', (SELECT jsonb_build_object('status',p.status,'quantidade',p.quantidade_itens,'itens', (SELECT jsonb_agg(jsonb_build_object('id',i.id,'titulo',i.titulo,'acao',i.acao_recomendada,'nivel',i.nivel_recomendacao,'grupo',i.grupo_transversal,'prioridade',i.prioridade,'prazo_dias',i.prazo_sugerido_dias,'responsavel',COALESCE(i.responsavel_definido,array_to_string(i.responsaveis_sugeridos,', ')),'evidencias',i.evidencias_recomendadas,'abrangencia',i.abrangencia_rotulo,'fatores', (SELECT array_agg(fator_codigo) FROM public.psico_plano_item_fatores WHERE plano_item_id = i.id)) ORDER BY i.ordem) FROM public.psico_plano_acao_itens i WHERE i.plano_id = p.id AND i.selecionado = true)) FROM public.psico_planos_acao p WHERE p.revisao_id = _rev.id)
  ) INTO _resultado;
  RETURN _resultado;
END $$;
REVOKE ALL ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_obter_conteudo_aprovado_relatorio(UUID) TO authenticated;