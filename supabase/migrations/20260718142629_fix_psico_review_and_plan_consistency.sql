-- Corrige a revisão/plano para os rótulos oficiais dos enums:
-- psico_prioridade_fator = Monitoramento, Média, Alta e Crítica.

CREATE OR REPLACE FUNCTION public.psico_gerar_recomendacoes_internal(
  p_revisao_id UUID,
  p_substituir_geradas BOOLEAN DEFAULT true
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rev RECORD; _plano_id UUID; _item_id UUID; _total INT := 0;
  _fator RECORD; _medida RECORD; _prazo INT; _prio TEXT;
  _grupos_usados TEXT[] := '{}';
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT r.*, b.id AS biblioteca_id INTO _rev
    FROM public.psico_revisoes_tecnicas r
    JOIN public.psico_bibliotecas_medidas_versoes b ON b.id = r.biblioteca_versao_id
   WHERE r.id = p_revisao_id;
  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;

  SELECT id INTO _plano_id FROM public.psico_planos_acao WHERE revisao_id = p_revisao_id;
  IF _plano_id IS NULL THEN
    INSERT INTO public.psico_planos_acao(revisao_id, criado_por)
    VALUES (p_revisao_id, auth.uid()) RETURNING id INTO _plano_id;
  END IF;
  IF p_substituir_geradas THEN
    DELETE FROM public.psico_plano_acao_itens
     WHERE plano_id = _plano_id AND gerado_automaticamente = true AND personalizado = false;
  END IF;

  -- Uma medida-base por fator garante cobertura integral e mantém o plano enxuto (<= 7 itens).
  -- Medidas transversais repetidas são consolidadas no item já criado.
  FOR _fator IN
    SELECT rf.resultado_fator_id, rf.fator_codigo, rf.prioridade_calculada
      FROM public.psico_revisoes_fatores rf
     WHERE rf.revisao_id = p_revisao_id
       AND rf.significativo_calculado = true
       AND rf.tratamento_tecnico <> 'sem_acao_especifica'
     ORDER BY CASE rf.prioridade_calculada
                WHEN 'critica' THEN 1 WHEN 'Crítica' THEN 1
                WHEN 'alta' THEN 2 WHEN 'Alta' THEN 2
                WHEN 'media' THEN 3 WHEN 'Média' THEN 3
                ELSE 4
              END,
              rf.fator_codigo
  LOOP
    _prio := CASE _fator.prioridade_calculada
      WHEN 'Crítica' THEN 'critica' WHEN 'Alta' THEN 'alta'
      WHEN 'Média' THEN 'media' WHEN 'Monitoramento' THEN 'monitoramento'
      ELSE _fator.prioridade_calculada
    END;
    _prazo := CASE _prio WHEN 'critica' THEN 30 WHEN 'alta' THEN 60 WHEN 'media' THEN 90 ELSE 180 END;

    SELECT * INTO _medida
      FROM public.psico_medidas_modelos
     WHERE biblioteca_versao_id = _rev.biblioteca_id
       AND fator_codigo = _fator.fator_codigo
       AND nivel_recomendacao IN ('essencial','complementar')
       AND ativo = true
     ORDER BY CASE nivel_recomendacao WHEN 'essencial' THEN 1 ELSE 2 END, ordem
     LIMIT 1;
    IF NOT FOUND THEN CONTINUE; END IF;

    IF _medida.grupo_transversal IS NOT NULL
       AND _medida.grupo_transversal = ANY(_grupos_usados) THEN
      INSERT INTO public.psico_plano_item_fatores(plano_item_id, resultado_fator_id, fator_codigo)
      SELECT i.id, _fator.resultado_fator_id, _fator.fator_codigo
        FROM public.psico_plano_acao_itens i
       WHERE i.plano_id = _plano_id AND i.grupo_transversal = _medida.grupo_transversal
       ORDER BY i.criado_em DESC LIMIT 1
      ON CONFLICT DO NOTHING;
      CONTINUE;
    END IF;

    INSERT INTO public.psico_plano_acao_itens
      (plano_id, medida_modelo_id, codigo_origem, titulo, acao_recomendada, objetivo,
       orientacoes_praticas, exemplos_aplicacao, nivel_recomendacao, grupo_transversal,
       prioridade, responsaveis_sugeridos, prazo_sugerido_dias, prazo_sugerido_texto,
       evidencias_recomendadas, gerado_automaticamente, selecionado, ordem)
    VALUES
      (_plano_id, _medida.id, _medida.codigo, _medida.titulo, _medida.o_que_significa,
       (SELECT objetivo_medidas FROM public.psico_fatores_orientacoes
         WHERE biblioteca_versao_id = _rev.biblioteca_id AND fator_codigo = _fator.fator_codigo),
       _medida.orientacoes_praticas, _medida.exemplos_aplicacao, _medida.nivel_recomendacao::text,
       _medida.grupo_transversal, _prio, _medida.responsaveis_sugeridos, _prazo,
       format('Sugestão de %s dias (ajustável pela empresa)', _prazo),
       _medida.evidencias_recomendadas, true, true, _total + 1)
    RETURNING id INTO _item_id;

    INSERT INTO public.psico_plano_item_fatores(plano_item_id, resultado_fator_id, fator_codigo)
    VALUES (_item_id, _fator.resultado_fator_id, _fator.fator_codigo)
    ON CONFLICT DO NOTHING;
    IF _medida.grupo_transversal IS NOT NULL THEN
      _grupos_usados := array_append(_grupos_usados, _medida.grupo_transversal);
    END IF;
    _total := _total + 1;
  END LOOP;

  UPDATE public.psico_planos_acao p
     SET quantidade_itens = (SELECT COUNT(*) FROM public.psico_plano_acao_itens WHERE plano_id = p.id),
         status = 'rascunho', atualizado_em = now()
   WHERE p.revisao_id = p_revisao_id;
  RETURN _total;
END;
$$;

REVOKE ALL ON FUNCTION public.psico_gerar_recomendacoes_internal(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_gerar_recomendacoes_internal(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_criar_revisao_tecnica(p_avaliacao_id UUID, p_modo TEXT DEFAULT 'rapida')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _av RECORD; _proc RECORD; _biblio_id UUID; _rev_id UUID; _plano_id UUID;
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
  IF EXISTS (SELECT 1 FROM public.psico_revisoes_tecnicas WHERE processamento_id = _proc.id AND ativa = true) THEN RAISE EXCEPTION 'REVISAO_ATIVA_JA_EXISTE'; END IF;

  SELECT COALESCE(bool_or(amostra_reduzida), false) INTO _amostra_red FROM public.psico_resultado_escopos WHERE processamento_id = _proc.id AND tipo = 'global';
  SELECT COUNT(*) INTO _sig_count FROM public.psico_resultados_fatores rf JOIN public.psico_resultado_escopos e ON e.id = rf.escopo_id WHERE e.processamento_id = _proc.id AND e.tipo = 'global' AND rf.significativo = true;
  SELECT CASE
           WHEN bool_or(rf.prioridade = 'Crítica') THEN 'Crítica'
           WHEN bool_or(rf.prioridade = 'Alta') THEN 'Alta'
           WHEN bool_or(rf.prioridade = 'Média') THEN 'Média'
           ELSE 'Monitoramento'
         END INTO _prio_max
    FROM public.psico_resultados_fatores rf JOIN public.psico_resultado_escopos e ON e.id = rf.escopo_id
   WHERE e.processamento_id = _proc.id AND e.tipo = 'global' AND rf.significativo = true;

  IF _sig_count = 0 THEN
    _concl := 'Com base nos critérios internos 50% / 30% / 10%, nenhum dos sete fatores avaliados foi classificado como significativo. Recomenda-se manter o monitoramento preventivo das condições e da organização do trabalho.';
  ELSE
    _concl := format('Foram identificados %s fatores significativos entre os sete fatores avaliados. A maior prioridade observada foi %s. Recomenda-se a adoção gradual das medidas selecionadas, com atenção inicial aos fatores de maior prioridade.', _sig_count, COALESCE(_prio_max,'Média'));
  END IF;
  IF _amostra_red THEN _concl := _concl || E'\n\nA avaliação possui amostra reduzida. Os resultados globais devem ser interpretados com cautela e não foram geradas segmentações.'; END IF;
  _concl := _concl || E'\n\nOs resultados devem ser considerados em conjunto com as condições reais de trabalho. As medidas propostas são recomendações técnicas e devem ser avaliadas e adaptadas pela empresa.';

  INSERT INTO public.psico_revisoes_tecnicas
    (avaliacao_id, processamento_id, biblioteca_versao_id, modo, conclusao_sugerida, conclusao_tecnica, amostra_reduzida, criada_por)
  VALUES (p_avaliacao_id, _proc.id, _biblio_id, p_modo::public.psico_revisao_modo, _concl, _concl, _amostra_red, auth.uid())
  RETURNING id INTO _rev_id;

  INSERT INTO public.psico_revisoes_fatores
    (revisao_id, resultado_fator_id, fator_codigo, significativo_calculado, prioridade_calculada, tratamento_tecnico, ordem_relatorio)
  SELECT _rev_id, rf.id, f.codigo, rf.significativo,
         CASE rf.prioridade WHEN 'Crítica' THEN 'critica' WHEN 'Alta' THEN 'alta' WHEN 'Média' THEN 'media' ELSE 'monitoramento' END,
         CASE WHEN rf.significativo THEN 'acao_recomendada' ELSE 'monitoramento_preventivo' END::public.psico_tratamento_tecnico,
         ROW_NUMBER() OVER (ORDER BY CASE rf.prioridade WHEN 'Crítica' THEN 1 WHEN 'Alta' THEN 2 WHEN 'Média' THEN 3 ELSE 4 END, f.codigo)
    FROM public.psico_resultados_fatores rf
    JOIN public.psico_resultado_escopos e ON e.id = rf.escopo_id
    JOIN public.psico_fatores f ON f.id = rf.fator_id
   WHERE e.processamento_id = _proc.id AND e.tipo = 'global';

  PERFORM public.psico_gerar_recomendacoes_internal(_rev_id, true);
  SELECT id INTO _plano_id FROM public.psico_planos_acao WHERE revisao_id = _rev_id;
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
  VALUES ('revisao_tecnica', _rev_id, 'revisao_tecnica_criada', jsonb_build_object('avaliacao_id',p_avaliacao_id,'sig_count',_sig_count,'prio_max',_prio_max), auth.uid(), now());
  RETURN jsonb_build_object('ok',true,'revisao_id',_rev_id,'plano_id',_plano_id);
END;
$$;

REVOKE ALL ON FUNCTION public.psico_criar_revisao_tecnica(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_criar_revisao_tecnica(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_regenerar_recomendacoes(p_revisao_id UUID, p_confirmacao TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _rev RECORD; _n INT; _esperado TEXT;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT r.*, a.codigo AS avaliacao_codigo INTO _rev
    FROM public.psico_revisoes_tecnicas r
    JOIN public.psico_avaliacoes a ON a.id=r.avaliacao_id
   WHERE r.id=p_revisao_id;
  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  _esperado := 'REGENERAR ' || _rev.avaliacao_codigo;
  IF p_confirmacao <> _esperado THEN RAISE EXCEPTION 'CONFIRMACAO_INVALIDA: use "%"', _esperado; END IF;
  IF _rev.status <> 'rascunho' THEN RAISE EXCEPTION 'STATUS_INCOMPATIVEL:%', _rev.status; END IF;
  _n := public.psico_gerar_recomendacoes_internal(p_revisao_id, true);
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
  VALUES ('revisao_tecnica', p_revisao_id, 'recomendacoes_regeneradas', jsonb_build_object('itens',_n), auth.uid(), now());
  RETURN jsonb_build_object('ok',true,'itens',_n);
END;
$$;

REVOKE ALL ON FUNCTION public.psico_regenerar_recomendacoes(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_regenerar_recomendacoes(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_validar_revisao_tecnica(p_revisao_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rev RECORD; _erros TEXT[] := '{}'; _avisos TEXT[] := '{}';
  _fatores_sig INT; _itens INT; _sem_resp INT; _sem_prazo INT; _sem_evid INT;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT * INTO _rev FROM public.psico_revisoes_tecnicas WHERE id = p_revisao_id;
  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  IF _rev.responsavel_tecnico_id IS NULL THEN _erros := array_append(_erros, 'RESPONSAVEL_TECNICO_AUSENTE'); END IF;
  IF LENGTH(COALESCE(_rev.conclusao_tecnica,'')) < 50 THEN _erros := array_append(_erros, 'CONCLUSAO_INCOMPLETA'); END IF;
  IF LENGTH(COALESCE(_rev.limitacoes,'')) < 10 THEN _erros := array_append(_erros, 'LIMITACOES_INCOMPLETAS'); END IF;
  SELECT COUNT(*) INTO _fatores_sig FROM public.psico_revisoes_fatores WHERE revisao_id = p_revisao_id AND significativo_calculado = true;

  IF EXISTS (
    SELECT 1 FROM public.psico_revisoes_fatores rf
     WHERE rf.revisao_id = p_revisao_id AND rf.significativo_calculado = true
       AND rf.tratamento_tecnico <> 'sem_acao_especifica'
       AND NOT EXISTS (
         SELECT 1 FROM public.psico_plano_item_fatores pif
         JOIN public.psico_plano_acao_itens i ON i.id = pif.plano_item_id
         JOIN public.psico_planos_acao p ON p.id = i.plano_id
          WHERE p.revisao_id = p_revisao_id AND i.selecionado = true AND pif.fator_codigo = rf.fator_codigo
       )
  ) THEN _erros := array_append(_erros, 'FATOR_SIGNIFICATIVO_SEM_ACAO'); END IF;

  SELECT COUNT(*) INTO _itens FROM public.psico_plano_acao_itens i JOIN public.psico_planos_acao p ON p.id = i.plano_id WHERE p.revisao_id = p_revisao_id AND i.selecionado = true;
  IF _itens = 0 THEN _erros := array_append(_erros, 'PLANO_SEM_ACOES'); END IF;
  SELECT COUNT(*) INTO _sem_resp FROM public.psico_plano_acao_itens i JOIN public.psico_planos_acao p ON p.id = i.plano_id WHERE p.revisao_id = p_revisao_id AND i.selecionado = true AND COALESCE(NULLIF(BTRIM(i.responsavel_definido), ''), array_to_string(i.responsaveis_sugeridos, ', ')) IS NULL;
  SELECT COUNT(*) INTO _sem_prazo FROM public.psico_plano_acao_itens i JOIN public.psico_planos_acao p ON p.id = i.plano_id WHERE p.revisao_id = p_revisao_id AND i.selecionado = true AND i.prazo_sugerido_dias IS NULL;
  SELECT COUNT(*) INTO _sem_evid FROM public.psico_plano_acao_itens i JOIN public.psico_planos_acao p ON p.id = i.plano_id WHERE p.revisao_id = p_revisao_id AND i.selecionado = true AND COALESCE(cardinality(i.evidencias_recomendadas),0) = 0;
  IF _sem_resp > 0 THEN _erros := array_append(_erros, format('ITENS_SEM_RESPONSAVEL:%s', _sem_resp)); END IF;
  IF _sem_prazo > 0 THEN _erros := array_append(_erros, format('ITENS_SEM_PRAZO:%s', _sem_prazo)); END IF;
  IF _sem_evid > 0 THEN _erros := array_append(_erros, format('ITENS_SEM_EVIDENCIA:%s', _sem_evid)); END IF;
  RETURN jsonb_build_object('valido', cardinality(_erros)=0, 'erros',_erros, 'avisos',_avisos, 'fatores_significativos',_fatores_sig, 'itens',_itens);
END;
$$;

REVOKE ALL ON FUNCTION public.psico_validar_revisao_tecnica(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_validar_revisao_tecnica(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_marcar_plano_revisado(p_plano_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _plano RECORD; _val JSONB;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT p.*, r.id AS revisao_id_real INTO _plano
    FROM public.psico_planos_acao p JOIN public.psico_revisoes_tecnicas r ON r.id = p.revisao_id
   WHERE p.id = p_plano_id FOR UPDATE OF p;
  IF _plano IS NULL THEN RAISE EXCEPTION 'PLANO_NAO_LOCALIZADO'; END IF;
  IF _plano.status <> 'rascunho' THEN RAISE EXCEPTION 'STATUS_INCOMPATIVEL:%', _plano.status; END IF;
  _val := public.psico_validar_revisao_tecnica(_plano.revisao_id_real);
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(_val->'erros') AS err(codigo)
     WHERE err.codigo = 'FATOR_SIGNIFICATIVO_SEM_ACAO'
        OR err.codigo = 'PLANO_SEM_ACOES'
        OR err.codigo LIKE 'ITENS_SEM_%'
  ) THEN RAISE EXCEPTION 'PLANO_INCOMPLETO:%', _val->>'erros'; END IF;
  UPDATE public.psico_planos_acao SET status='revisado', atualizado_por=auth.uid(), atualizado_em=now() WHERE id=p_plano_id;
  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
  VALUES ('plano_acao', p_plano_id, 'plano_acao_revisado', jsonb_build_object('revisao_id',_plano.revisao_id_real,'itens',_val->>'itens'), auth.uid(), now());
  RETURN jsonb_build_object('ok',true,'status','revisado');
END;
$$;

REVOKE ALL ON FUNCTION public.psico_marcar_plano_revisado(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_marcar_plano_revisado(UUID) TO authenticated;

-- Repara snapshots criados pela função antiga sem sobrescrever texto já editado manualmente.
UPDATE public.psico_revisoes_fatores
   SET prioridade_calculada = CASE prioridade_calculada
     WHEN 'Crítica' THEN 'critica' WHEN 'Alta' THEN 'alta'
     WHEN 'Média' THEN 'media' WHEN 'Monitoramento' THEN 'monitoramento'
     ELSE prioridade_calculada END
 WHERE prioridade_calculada IN ('Crítica','Alta','Média','Monitoramento');

WITH prioridades AS (
  SELECT r.id,
         CASE WHEN bool_or(rf.prioridade='Crítica') THEN 'Crítica'
              WHEN bool_or(rf.prioridade='Alta') THEN 'Alta'
              WHEN bool_or(rf.prioridade='Média') THEN 'Média'
              ELSE 'Monitoramento' END AS prioridade_maxima
    FROM public.psico_revisoes_tecnicas r
    JOIN public.psico_revisoes_fatores revf ON revf.revisao_id=r.id AND revf.significativo_calculado=true
    JOIN public.psico_resultados_fatores rf ON rf.id=revf.resultado_fator_id
   GROUP BY r.id
), textos AS (
  SELECT r.id, r.conclusao_sugerida AS antiga,
         regexp_replace(r.conclusao_sugerida, 'A maior prioridade observada foi [^.]+\.', 'A maior prioridade observada foi '||p.prioridade_maxima||'.') AS nova
    FROM public.psico_revisoes_tecnicas r JOIN prioridades p ON p.id=r.id
)
UPDATE public.psico_revisoes_tecnicas r
   SET conclusao_sugerida=t.nova,
       conclusao_tecnica=CASE WHEN r.conclusao_tecnica=t.antiga THEN t.nova ELSE r.conclusao_tecnica END,
       atualizada_em=now()
  FROM textos t WHERE t.id=r.id AND t.nova IS DISTINCT FROM t.antiga;

UPDATE public.psico_planos_acao p SET status='rascunho', atualizado_em=now()
 WHERE p.status='revisado'
   AND EXISTS (
     SELECT 1 FROM public.psico_revisoes_fatores rf
      WHERE rf.revisao_id=p.revisao_id AND rf.significativo_calculado=true
        AND rf.tratamento_tecnico <> 'sem_acao_especifica'
        AND NOT EXISTS (
          SELECT 1 FROM public.psico_plano_item_fatores pif
          JOIN public.psico_plano_acao_itens i ON i.id=pif.plano_item_id
           WHERE i.plano_id=p.id AND i.selecionado=true AND pif.fator_codigo=rf.fator_codigo
        )
   );
