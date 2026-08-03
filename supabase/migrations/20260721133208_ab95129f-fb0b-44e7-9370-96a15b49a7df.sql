CREATE OR REPLACE FUNCTION public.psico_aplicar_plano_ia(
  p_revisao_id uuid,
  p_selecoes jsonb,
  p_prompt_codigo text DEFAULT NULL::text,
  p_modelo_ia text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _rev record;
  _plano_id uuid;
  _sel jsonb;
  _medida record;
  _prio text;
  _prazo int;
  _item_id uuid;
  _total int := 0;
  _ordem int := 0;
  _fator_code text;
  _fator_row record;
  _grupos_usados text[] := '{}';
  _abr_tipo psico_abrangencia_tipo;
  _abr_rotulo text;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'ACESSO_NEGADO';
  END IF;

  SELECT r.*, a.codigo AS avaliacao_codigo
    INTO _rev
    FROM public.psico_revisoes_tecnicas r
    JOIN public.psico_avaliacoes a ON a.id = r.avaliacao_id
   WHERE r.id = p_revisao_id;

  IF _rev IS NULL THEN RAISE EXCEPTION 'REVISAO_NAO_LOCALIZADA'; END IF;
  IF _rev.status NOT IN ('rascunho','pronta_para_aprovacao') THEN
    RAISE EXCEPTION 'STATUS_INCOMPATIVEL:%', _rev.status;
  END IF;
  IF jsonb_typeof(p_selecoes) <> 'array' THEN RAISE EXCEPTION 'SELECOES_INVALIDAS'; END IF;

  SELECT id INTO _plano_id FROM public.psico_planos_acao WHERE revisao_id = p_revisao_id;
  IF _plano_id IS NULL THEN
    INSERT INTO public.psico_planos_acao(revisao_id, criado_por)
    VALUES (p_revisao_id, auth.uid())
    RETURNING id INTO _plano_id;
  END IF;

  DELETE FROM public.psico_plano_acao_itens
   WHERE plano_id = _plano_id
     AND gerado_automaticamente = true
     AND personalizado = false;

  SELECT COALESCE(MAX(ordem),0) INTO _ordem
    FROM public.psico_plano_acao_itens WHERE plano_id = _plano_id;

  FOR _sel IN SELECT * FROM jsonb_array_elements(p_selecoes) LOOP
    SELECT * INTO _medida
      FROM public.psico_medidas_modelos
     WHERE id = NULLIF(_sel->>'medida_modelo_id','')::uuid
       AND biblioteca_versao_id = _rev.biblioteca_versao_id
       AND ativo = true;
    IF NOT FOUND THEN CONTINUE; END IF;

    _prio  := COALESCE(NULLIF(_sel->>'prioridade',''), 'monitoramento');
    _prazo := COALESCE(NULLIF(_sel->>'prazo_dias','')::int, _medida.prazo_sugerido_dias, 90);

    BEGIN
      _abr_tipo := COALESCE(NULLIF(_sel->>'abrangencia_tipo',''), 'global')::psico_abrangencia_tipo;
    EXCEPTION WHEN OTHERS THEN
      _abr_tipo := 'global';
    END;
    _abr_rotulo := COALESCE(NULLIF(_sel->>'abrangencia_rotulo',''), 'Resultado geral');

    IF _medida.grupo_transversal IS NOT NULL AND _medida.grupo_transversal = ANY(_grupos_usados) THEN
      SELECT id INTO _item_id
        FROM public.psico_plano_acao_itens
       WHERE plano_id = _plano_id AND grupo_transversal = _medida.grupo_transversal
       ORDER BY criado_em DESC LIMIT 1;

      IF _item_id IS NOT NULL THEN
        FOR _fator_code IN SELECT jsonb_array_elements_text(COALESCE(_sel->'fatores_codes','[]'::jsonb)) LOOP
          SELECT rf.resultado_fator_id, rf.fator_codigo INTO _fator_row
            FROM public.psico_revisoes_fatores rf
           WHERE rf.revisao_id = p_revisao_id
             AND rf.fator_codigo = _fator_code
             AND rf.resultado_fator_id IS NOT NULL;
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
       abrangencia_tipo, abrangencia_rotulo,
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
       _abr_tipo, _abr_rotulo,
       true, true, false, _ordem)
    RETURNING id INTO _item_id;

    FOR _fator_code IN SELECT jsonb_array_elements_text(COALESCE(_sel->'fatores_codes','[]'::jsonb)) LOOP
      SELECT rf.resultado_fator_id, rf.fator_codigo INTO _fator_row
        FROM public.psico_revisoes_fatores rf
       WHERE rf.revisao_id = p_revisao_id
         AND rf.fator_codigo = _fator_code
         AND rf.resultado_fator_id IS NOT NULL;
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
         status = 'rascunho',
         atualizado_em = now(),
         atualizado_por = auth.uid()
   WHERE p.id = _plano_id;

  RETURN jsonb_build_object(
    'itens', _total,
    'plano_id', _plano_id,
    'prompt_codigo', p_prompt_codigo,
    'modelo_ia', p_modelo_ia
  );
END;
$function$;