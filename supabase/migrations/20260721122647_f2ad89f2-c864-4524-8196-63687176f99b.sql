
-- Contexto para IA gerar plano de ação
CREATE OR REPLACE FUNCTION public.psico_obter_contexto_plano_ia(p_revisao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rev record;
  v_escopo_id uuid;
  v_ctx jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT r.*, a.codigo AS avaliacao_codigo, a.titulo AS avaliacao_titulo, a.unidade
    INTO v_rev
    FROM public.psico_revisoes_tecnicas r
    JOIN public.psico_avaliacoes a ON a.id = r.avaliacao_id
   WHERE r.id = p_revisao_id;
  IF v_rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  IF v_rev.status = 'aprovada' THEN RAISE EXCEPTION 'REVISAO_IMUTAVEL'; END IF;

  SELECT id INTO v_escopo_id FROM public.psico_resultado_escopos
   WHERE processamento_id = v_rev.processamento_id AND tipo = 'global' LIMIT 1;

  SELECT jsonb_build_object(
    'avaliacao', jsonb_build_object(
       'codigo', v_rev.avaliacao_codigo,
       'titulo', v_rev.avaliacao_titulo,
       'unidade', v_rev.unidade,
       'contexto_organizacional', v_rev.contexto_organizacional,
       'limitacoes', v_rev.limitacoes
    ),
    'participacao', (
       SELECT jsonb_build_object(
          'respondentes', e.respondentes,
          'participantes_elegiveis', e.participantes_elegiveis,
          'percentual_participacao', e.percentual_participacao,
          'amostra_reduzida', e.amostra_reduzida
       )
       FROM public.psico_resultado_escopos e WHERE e.id = v_escopo_id
    ),
    'fatores', (
       SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'codigo', rf.fator_codigo,
          'resultado_fator_id', rf.resultado_fator_id,
          'score', res.score_medio,
          'classificacao', res.classificacao_media,
          'mac', res.percentual_medio_alto_critico,
          'ac', res.percentual_alto_critico,
          'critico', res.percentual_critico,
          'significativo', rf.significativo_calculado,
          'prioridade', rf.prioridade_calculada,
          'tratamento', rf.tratamento_tecnico,
          'observacao_tecnica', rf.observacao_tecnica
       ) ORDER BY rf.ordem_relatorio), '[]'::jsonb)
       FROM public.psico_revisoes_fatores rf
       JOIN public.psico_resultados_fatores res ON res.id = rf.resultado_fator_id
       WHERE rf.revisao_id = v_rev.id
    ),
    'catalogo_medidas', (
       SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', m.id,
          'codigo', m.codigo,
          'fator_codigo', m.fator_codigo,
          'nivel', m.nivel_recomendacao,
          'grupo_transversal', m.grupo_transversal,
          'titulo', m.titulo,
          'o_que_significa', m.o_que_significa,
          'orientacoes_praticas', m.orientacoes_praticas,
          'exemplos_aplicacao', m.exemplos_aplicacao,
          'responsaveis_sugeridos', m.responsaveis_sugeridos,
          'evidencias_recomendadas', m.evidencias_recomendadas,
          'indicadores_sugeridos', m.indicadores_sugeridos,
          'prazo_sugerido_dias', m.prazo_sugerido_dias
       ) ORDER BY m.fator_codigo, m.ordem), '[]'::jsonb)
       FROM public.psico_medidas_modelos m
       WHERE m.biblioteca_versao_id = v_rev.biblioteca_versao_id AND m.ativo = true
    ),
    'itens_personalizados_existentes', (
       SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'id', i.id, 'titulo', i.titulo, 'personalizado', i.personalizado
       )), '[]'::jsonb)
       FROM public.psico_plano_acao_itens i
       JOIN public.psico_planos_acao p ON p.id = i.plano_id
       WHERE p.revisao_id = v_rev.id AND i.personalizado = true
    )
  ) INTO v_ctx;
  RETURN v_ctx;
END;
$$;
REVOKE ALL ON FUNCTION public.psico_obter_contexto_plano_ia(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_obter_contexto_plano_ia(uuid) TO authenticated;

-- Aplica seleção da IA no plano (substitui itens gerados automaticamente, preserva personalizados)
CREATE OR REPLACE FUNCTION public.psico_aplicar_plano_ia(
  p_revisao_id uuid,
  p_selecoes jsonb,
  p_prompt_codigo text DEFAULT NULL,
  p_modelo_ia text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _rev record; _plano_id uuid; _sel jsonb; _medida record; _prio text; _prazo int;
  _item_id uuid; _total int := 0; _ordem int := 0;
  _fator_code text; _fator_row record;
  _grupos_usados text[] := '{}';
  _overrides jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'ACESSO_NEGADO'; END IF;
  SELECT r.*, a.codigo AS avaliacao_codigo INTO _rev
    FROM public.psico_revisoes_tecnicas r
    JOIN public.psico_avaliacoes a ON a.id = r.avaliacao_id
   WHERE r.id = p_revisao_id;
  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  IF _rev.status <> 'rascunho' THEN RAISE EXCEPTION 'STATUS_INCOMPATIVEL:%', _rev.status; END IF;
  IF jsonb_typeof(p_selecoes) <> 'array' THEN RAISE EXCEPTION 'SELECOES_INVALIDAS'; END IF;

  SELECT id INTO _plano_id FROM public.psico_planos_acao WHERE revisao_id = p_revisao_id;
  IF _plano_id IS NULL THEN
    INSERT INTO public.psico_planos_acao(revisao_id, criado_por)
    VALUES (p_revisao_id, auth.uid()) RETURNING id INTO _plano_id;
  END IF;

  DELETE FROM public.psico_plano_acao_itens
   WHERE plano_id = _plano_id AND gerado_automaticamente = true AND personalizado = false;

  SELECT COALESCE(MAX(ordem), 0) INTO _ordem FROM public.psico_plano_acao_itens WHERE plano_id = _plano_id;

  FOR _sel IN SELECT * FROM jsonb_array_elements(p_selecoes) LOOP
    SELECT * INTO _medida FROM public.psico_medidas_modelos
     WHERE id = NULLIF(_sel->>'medida_modelo_id','')::uuid
       AND biblioteca_versao_id = _rev.biblioteca_versao_id
       AND ativo = true;
    IF NOT FOUND THEN CONTINUE; END IF;

    _prio := COALESCE(NULLIF(_sel->>'prioridade',''), 'monitoramento');
    _prazo := COALESCE(NULLIF(_sel->>'prazo_dias','')::int, _medida.prazo_sugerido_dias, 90);
    _overrides := jsonb_build_object(
       'justificativa_ia', _sel->>'justificativa',
       'responsavel_sugerido_ia', _sel->>'responsavel_sugerido',
       'indicador_ia', _sel->>'indicador_sugerido'
    );

    -- Consolida transversal em item já criado
    IF _medida.grupo_transversal IS NOT NULL
       AND _medida.grupo_transversal = ANY(_grupos_usados) THEN
      SELECT id INTO _item_id FROM public.psico_plano_acao_itens
        WHERE plano_id = _plano_id AND grupo_transversal = _medida.grupo_transversal
        ORDER BY criado_em DESC LIMIT 1;
      IF _item_id IS NOT NULL THEN
        FOR _fator_code IN SELECT jsonb_array_elements_text(COALESCE(_sel->'fatores_codes','[]'::jsonb)) LOOP
          SELECT rf.id AS resultado_fator_id, rf.fator_codigo INTO _fator_row
            FROM public.psico_revisoes_fatores rf
           WHERE rf.revisao_id = p_revisao_id AND rf.fator_codigo = _fator_code;
          IF FOUND THEN
            INSERT INTO public.psico_plano_item_fatores(plano_item_id, resultado_fator_id, fator_codigo)
            VALUES (_item_id, _fator_row.resultado_fator_id, _fator_row.fator_codigo)
            ON CONFLICT DO NOTHING;
          END IF;
        END LOOP;
      END IF;
      CONTINUE;
    END IF;

    _ordem := _ordem + 1;
    INSERT INTO public.psico_plano_acao_itens
      (plano_id, medida_modelo_id, codigo_origem, titulo, acao_recomendada, objetivo,
       orientacoes_praticas, exemplos_aplicacao, nivel_recomendacao, grupo_transversal,
       prioridade, responsaveis_sugeridos, prazo_sugerido_dias, prazo_sugerido_texto,
       evidencias_recomendadas, indicador_sugerido, indicadores_sugeridos,
       gerado_automaticamente, selecionado, personalizado, ordem)
    VALUES
      (_plano_id, _medida.id, _medida.codigo, _medida.titulo,
       COALESCE(NULLIF(_sel->>'acao_recomendada',''), _medida.titulo),
       COALESCE(NULLIF(_sel->>'objetivo',''), _medida.o_que_significa),
       _medida.orientacoes_praticas, _medida.exemplos_aplicacao,
       _medida.nivel_recomendacao::text, _medida.grupo_transversal, _prio,
       _medida.responsaveis_sugeridos, _prazo,
       format('Sugestão de %s dias (ajustável pela empresa)', _prazo),
       _medida.evidencias_recomendadas,
       COALESCE(NULLIF(_sel->>'indicador_sugerido',''), (_medida.indicadores_sugeridos)[1]),
       _medida.indicadores_sugeridos,
       true, true, false, _ordem)
    RETURNING id INTO _item_id;

    FOR _fator_code IN SELECT jsonb_array_elements_text(COALESCE(_sel->'fatores_codes','[]'::jsonb)) LOOP
      SELECT rf.id AS resultado_fator_id, rf.fator_codigo INTO _fator_row
        FROM public.psico_revisoes_fatores rf
       WHERE rf.revisao_id = p_revisao_id AND rf.fator_codigo = _fator_code;
      IF FOUND THEN
        INSERT INTO public.psico_plano_item_fatores(plano_item_id, resultado_fator_id, fator_codigo)
        VALUES (_item_id, _fator_row.resultado_fator_id, _fator_row.fator_codigo)
        ON CONFLICT DO NOTHING;
      END IF;
    END LOOP;

    IF _medida.grupo_transversal IS NOT NULL THEN
      _grupos_usados := array_append(_grupos_usados, _medida.grupo_transversal);
    END IF;
    _total := _total + 1;
  END LOOP;

  UPDATE public.psico_planos_acao p
     SET quantidade_itens = (SELECT COUNT(*) FROM public.psico_plano_acao_itens WHERE plano_id = p.id),
         status = 'rascunho', atualizado_em = now(), atualizado_por = auth.uid()
   WHERE p.id = _plano_id;

  INSERT INTO public.psico_auditoria(entidade, entidade_id, acao, metadados, usuario_id, created_at)
  VALUES ('plano_acao', _plano_id, 'plano_gerado_ia',
          jsonb_build_object('itens', _total, 'prompt_codigo', p_prompt_codigo, 'modelo', p_modelo_ia,
                             'avaliacao_codigo', _rev.avaliacao_codigo),
          auth.uid(), now());

  RETURN jsonb_build_object('ok', true, 'itens', _total, 'plano_id', _plano_id);
END;
$$;
REVOKE ALL ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text) TO authenticated;
