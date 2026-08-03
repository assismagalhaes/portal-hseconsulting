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
       evidencias_recomendadas, indicador_sugerido, indicadores_sugeridos,
       gerado_automaticamente, selecionado, ordem)
    VALUES
      (_plano_id, _medida.id, _medida.codigo, _medida.titulo, _medida.o_que_significa,
       (SELECT objetivo_medidas FROM public.psico_fatores_orientacoes
         WHERE biblioteca_versao_id = _rev.biblioteca_id AND fator_codigo = _fator.fator_codigo),
       _medida.orientacoes_praticas, _medida.exemplos_aplicacao, _medida.nivel_recomendacao::text,
       _medida.grupo_transversal, _prio, _medida.responsaveis_sugeridos, _prazo,
       format('Sugestão de %s dias (ajustável pela empresa)', _prazo),
       _medida.evidencias_recomendadas,
       (_medida.indicadores_sugeridos)[1],
       _medida.indicadores_sugeridos,
       true, true, _total + 1)
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

-- Preenche indicadores nas ações já cadastradas automaticamente que estão sem sugestão
UPDATE public.psico_plano_acao_itens i
   SET indicadores_sugeridos = COALESCE(i.indicadores_sugeridos, m.indicadores_sugeridos),
       indicador_sugerido    = COALESCE(i.indicador_sugerido, (m.indicadores_sugeridos)[1])
  FROM public.psico_medidas_modelos m
 WHERE i.medida_modelo_id = m.id
   AND (
        i.indicador_sugerido IS NULL
     OR i.indicadores_sugeridos IS NULL
     OR array_length(i.indicadores_sugeridos, 1) IS NULL
   )
   AND m.indicadores_sugeridos IS NOT NULL
   AND array_length(m.indicadores_sugeridos, 1) > 0;
