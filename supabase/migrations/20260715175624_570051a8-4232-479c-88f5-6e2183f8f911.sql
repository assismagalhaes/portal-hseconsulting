CREATE OR REPLACE FUNCTION public.psico_processar_resultados(p_avaliacao_id uuid, p_confirmacao text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_av public.psico_avaliacoes%ROWTYPE;
  v_mv public.psico_metodologias_versoes%ROWTYPE;
  v_qv public.psico_questionarios_versoes%ROWTYPE;
  v_valid jsonb;
  v_hash text;
  v_min_global int;
  v_min_seg int;
  v_total_resp int;
  v_amostra_reduzida boolean;
  v_proc_id uuid;
  v_proc_existente uuid;
  v_versao_motor text := 'HSE-PSICO-CALC-1.0.0';

  v_escopo_tipo public.psico_resultado_escopo_tipo;
  v_escopo_key text;
  v_escopo_rot text;
  v_escopo_resp int;
  v_escopo_id uuid;
  v_escopos_criados int := 0;
  v_escopos_func int := 0;
  v_escopos_set int := 0;
  v_escopos_uni int := 0;
  v_escopos_supr int := 0;

  v_indice_geral numeric;
  v_class_geral public.psico_classificacao_risco;
  v_fatores_signif int;
  v_prio_max public.psico_prioridade_fator;
  v_prio_fat public.psico_prioridade_fator;

  v_c_principal numeric;
  v_c_agravamento numeric;
  v_c_critico numeric;

  v_esc record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE='insufficient_privilege';
  END IF;
  IF NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.' USING ERRCODE='no_data_found';
  END IF;

  IF p_confirmacao IS DISTINCT FROM ('PROCESSAR ' || v_av.codigo) THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite: PROCESSAR %', v_av.codigo
      USING ERRCODE='check_violation';
  END IF;

  IF v_av.status NOT IN ('coleta_encerrada','resultado_pronto') THEN
    RAISE EXCEPTION 'Status inválido para processamento.' USING ERRCODE='check_violation';
  END IF;

  v_valid := public.psico_validar_processamento_resultados(p_avaliacao_id);
  IF NOT (v_valid->>'valido')::boolean THEN
    RAISE EXCEPTION 'Validação falhou: %', v_valid->'erros' USING ERRCODE='check_violation';
  END IF;
  IF NOT (v_valid->>'pode_processar')::boolean THEN
    RAISE EXCEPTION 'Amostra insuficiente ou integridade quebrada.' USING ERRCODE='check_violation';
  END IF;

  v_total_resp := (v_valid->>'total_respondentes')::int;
  v_hash := v_valid->>'hash_entrada';

  SELECT id INTO v_proc_existente
    FROM public.psico_resultado_processamentos
   WHERE avaliacao_id = p_avaliacao_id
     AND versao_motor = v_versao_motor
     AND hash_entrada = v_hash
     AND status = 'concluido'
   ORDER BY concluido_em DESC LIMIT 1;

  IF v_proc_existente IS NOT NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'reutilizado', true,
      'processamento_id', v_proc_existente,
      'versao_motor', v_versao_motor,
      'hash_entrada', v_hash
    );
  END IF;

  SELECT * INTO v_mv FROM public.psico_metodologias_versoes WHERE id = v_av.metodologia_versao_id;
  SELECT * INTO v_qv FROM public.psico_questionarios_versoes WHERE id = v_av.questionario_versao_id;
  v_min_global := COALESCE(v_mv.minimo_respondentes_global, 2);
  v_min_seg    := COALESCE(v_mv.minimo_respondentes_segmentacao, 3);
  v_c_principal := COALESCE(v_mv.criterio_principal_percentual, 50);
  v_c_agravamento := COALESCE(v_mv.criterio_agravamento_percentual, 30);
  v_c_critico := COALESCE(v_mv.criterio_critico_percentual, 10);
  v_amostra_reduzida := v_total_resp < 5;

  UPDATE public.psico_resultado_processamentos
     SET ativo = false, substituido_em = now(), status = 'substituido'
   WHERE avaliacao_id = p_avaliacao_id AND ativo = true AND status = 'concluido';

  INSERT INTO public.psico_resultado_processamentos (
    avaliacao_id, questionario_versao_id, metodologia_versao_id,
    versao_motor, status, hash_entrada, total_respondentes, total_itens,
    iniciado_por, iniciado_em, ativo
  ) VALUES (
    p_avaliacao_id, v_av.questionario_versao_id, v_av.metodologia_versao_id,
    v_versao_motor, 'processando', v_hash, v_total_resp, v_total_resp*35,
    v_uid, now(), false
  ) RETURNING id INTO v_proc_id;

  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
  VALUES ('psico_avaliacao', p_avaliacao_id, 'processamento_resultados_iniciado', v_uid,
          jsonb_build_object('processamento_id', v_proc_id,
                             'versao_motor', v_versao_motor,
                             'hash_prefix', substring(v_hash,1,12),
                             'total_respondentes', v_total_resp));

  BEGIN
    FOR v_esc IN
      SELECT 'global'::public.psico_resultado_escopo_tipo AS tipo,
             NULL::text AS chave, 'Resultado geral' AS rotulo, v_total_resp AS respondentes
      UNION ALL
      SELECT 'funcao'::public.psico_resultado_escopo_tipo, funcao_normalizada, max(coalesce(funcao, funcao_normalizada)),
             count(*)::int
        FROM public.psico_respostas
       WHERE avaliacao_id = p_avaliacao_id AND funcao_normalizada IS NOT NULL
         AND NOT v_amostra_reduzida
       GROUP BY funcao_normalizada
      UNION ALL
      SELECT 'setor'::public.psico_resultado_escopo_tipo, setor_normalizado, max(coalesce(setor, setor_normalizado)),
             count(*)::int
        FROM public.psico_respostas
       WHERE avaliacao_id = p_avaliacao_id AND setor_normalizado IS NOT NULL
         AND NOT v_amostra_reduzida
       GROUP BY setor_normalizado
      UNION ALL
      SELECT 'unidade'::public.psico_resultado_escopo_tipo, unidade_normalizada, max(coalesce(unidade, unidade_normalizada)),
             count(*)::int
        FROM public.psico_respostas
       WHERE avaliacao_id = p_avaliacao_id AND unidade_normalizada IS NOT NULL
         AND NOT v_amostra_reduzida
       GROUP BY unidade_normalizada
    LOOP
      v_escopo_tipo := v_esc.tipo;
      v_escopo_key  := v_esc.chave;
      v_escopo_rot  := v_esc.rotulo;
      v_escopo_resp := v_esc.respondentes;

      IF v_escopo_tipo <> 'global' THEN
        IF v_escopo_resp < v_min_seg THEN
          v_escopos_supr := v_escopos_supr + 1;
          CONTINUE;
        END IF;
        IF v_escopo_resp = v_total_resp THEN
          v_escopos_supr := v_escopos_supr + 1;
          CONTINUE;
        END IF;
      END IF;

      INSERT INTO public.psico_resultado_escopos (
        processamento_id, tipo, chave_normalizada, rotulo, respondentes,
        minimo_aplicado, total_itens,
        indice_geral_descritivo, classificacao_indice_geral,
        fatores_significativos, prioridade_maxima, amostra_reduzida
      ) VALUES (
        v_proc_id, v_escopo_tipo, v_escopo_key, v_escopo_rot, v_escopo_resp,
        CASE WHEN v_escopo_tipo='global' THEN v_min_global ELSE v_min_seg END,
        v_escopo_resp * 35,
        0, 'Risco Irrelevante', 0, 'Monitoramento',
        (v_escopo_tipo='global' AND v_amostra_reduzida)
      ) RETURNING id INTO v_escopo_id;

      IF v_escopo_tipo='funcao' THEN v_escopos_func := v_escopos_func + 1; END IF;
      IF v_escopo_tipo='setor'  THEN v_escopos_set  := v_escopos_set  + 1; END IF;
      IF v_escopo_tipo='unidade' THEN v_escopos_uni := v_escopos_uni + 1; END IF;
      v_escopos_criados := v_escopos_criados + 1;

      INSERT INTO public.psico_resultados_perguntas (
        escopo_id, pergunta_id, fator_id, numero,
        total_respostas_validas, soma_pesos, score_medio, classificacao_media,
        quantidade_nunca, quantidade_raramente, quantidade_as_vezes, quantidade_frequentemente, quantidade_sempre,
        percentual_nunca, percentual_raramente, percentual_as_vezes, percentual_frequentemente, percentual_sempre,
        quantidade_peso_0, quantidade_peso_1, quantidade_peso_2, quantidade_peso_3, quantidade_peso_4,
        percentual_peso_0, percentual_peso_1, percentual_peso_2, percentual_peso_3, percentual_peso_4,
        percentual_desfavoravel, percentual_alto_critico, percentual_critico
      )
      SELECT
        v_escopo_id, p.id, p.fator_id, p.numero,
        count(*)::int AS n,
        sum(peso)::numeric AS soma,
        (sum(peso)::numeric / NULLIF(count(*),0))::numeric AS score,
        public.psico_classificar_score(v_av.metodologia_versao_id,
          (sum(peso)::numeric / NULLIF(count(*),0))::numeric),
        sum(CASE WHEN codigo='nunca' THEN 1 ELSE 0 END)::int,
        sum(CASE WHEN codigo='raramente' THEN 1 ELSE 0 END)::int,
        sum(CASE WHEN codigo='as_vezes' THEN 1 ELSE 0 END)::int,
        sum(CASE WHEN codigo='frequentemente' THEN 1 ELSE 0 END)::int,
        sum(CASE WHEN codigo='sempre' THEN 1 ELSE 0 END)::int,
        100.0*sum(CASE WHEN codigo='nunca' THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN codigo='raramente' THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN codigo='as_vezes' THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN codigo='frequentemente' THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN codigo='sempre' THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        sum(CASE WHEN peso=0 THEN 1 ELSE 0 END)::int,
        sum(CASE WHEN peso=1 THEN 1 ELSE 0 END)::int,
        sum(CASE WHEN peso=2 THEN 1 ELSE 0 END)::int,
        sum(CASE WHEN peso=3 THEN 1 ELSE 0 END)::int,
        sum(CASE WHEN peso=4 THEN 1 ELSE 0 END)::int,
        100.0*sum(CASE WHEN peso=0 THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN peso=1 THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN peso=2 THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN peso=3 THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN peso=4 THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN peso>=2 THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN peso>=3 THEN 1 ELSE 0 END)/NULLIF(count(*),0),
        100.0*sum(CASE WHEN peso=4 THEN 1 ELSE 0 END)/NULLIF(count(*),0)
      FROM public.psico_perguntas p
      JOIN public.psico_respostas rr ON rr.avaliacao_id = p_avaliacao_id
      JOIN public.psico_respostas_itens i ON i.resposta_id = rr.id AND i.pergunta_id = p.id
      JOIN LATERAL (
        SELECT o.codigo,
               CASE WHEN p.sentido_pontuacao='direta' THEN o.peso_direta ELSE o.peso_invertida END AS peso
          FROM public.psico_opcoes_resposta o WHERE o.id = i.opcao_resposta_id
      ) o ON true
      WHERE p.questionario_versao_id = v_av.questionario_versao_id
        AND p.ativa = true
        AND (v_escopo_tipo='global'
             OR (v_escopo_tipo='funcao'  AND rr.funcao_normalizada  = v_escopo_key)
             OR (v_escopo_tipo='setor'   AND rr.setor_normalizado   = v_escopo_key)
             OR (v_escopo_tipo='unidade' AND rr.unidade_normalizada = v_escopo_key))
      GROUP BY p.id, p.fator_id, p.numero;

      IF EXISTS (
        SELECT 1 FROM public.psico_resultados_perguntas
         WHERE escopo_id = v_escopo_id AND total_respostas_validas <> v_escopo_resp
      ) OR (
        SELECT count(*) FROM public.psico_resultados_perguntas WHERE escopo_id = v_escopo_id
      ) <> 35 THEN
        RAISE EXCEPTION 'TOTAL_ITENS_INVALIDO' USING ERRCODE='check_violation';
      END IF;

      INSERT INTO public.psico_resultados_fatores (
        escopo_id, fator_id, ordem, quantidade_perguntas,
        total_respostas_validas, soma_pesos, score_medio, classificacao_media,
        quantidade_irrelevante, quantidade_baixo, quantidade_medio, quantidade_alto, quantidade_critico,
        percentual_irrelevante, percentual_baixo, percentual_medio, percentual_alto, percentual_critico,
        percentual_medio_alto_critico, percentual_alto_critico,
        criterio_principal, criterio_agravamento, criterio_critico_automatico,
        criterios_acionados, significativo, prioridade
      )
      SELECT
        v_escopo_id, f.id, f.ordem,
        (SELECT count(*) FROM public.psico_perguntas WHERE fator_id = f.id AND ativa = true)::int,
        sum(rp.total_respostas_validas)::int AS n,
        sum(rp.soma_pesos)::numeric,
        (sum(rp.soma_pesos)::numeric / NULLIF(sum(rp.total_respostas_validas),0))::numeric,
        public.psico_classificar_score(v_av.metodologia_versao_id,
          (sum(rp.soma_pesos)::numeric / NULLIF(sum(rp.total_respostas_validas),0))::numeric),
        sum(rp.quantidade_peso_0)::int, sum(rp.quantidade_peso_1)::int,
        sum(rp.quantidade_peso_2)::int, sum(rp.quantidade_peso_3)::int,
        sum(rp.quantidade_peso_4)::int,
        100.0*sum(rp.quantidade_peso_0)/NULLIF(sum(rp.total_respostas_validas),0),
        100.0*sum(rp.quantidade_peso_1)/NULLIF(sum(rp.total_respostas_validas),0),
        100.0*sum(rp.quantidade_peso_2)/NULLIF(sum(rp.total_respostas_validas),0),
        100.0*sum(rp.quantidade_peso_3)/NULLIF(sum(rp.total_respostas_validas),0),
        100.0*sum(rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0),
        100.0*sum(rp.quantidade_peso_2 + rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0),
        100.0*sum(rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0),
        (100.0*sum(rp.quantidade_peso_2 + rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) > v_c_principal,
        (100.0*sum(rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) >= v_c_agravamento,
        (100.0*sum(rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) >= v_c_critico,
        ARRAY(
          SELECT unnest FROM unnest(ARRAY[
            CASE WHEN (100.0*sum(rp.quantidade_peso_2 + rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) > v_c_principal   THEN 'principal' END,
            CASE WHEN (100.0*sum(rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) >= v_c_agravamento                         THEN 'agravamento' END,
            CASE WHEN (100.0*sum(rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) >= v_c_critico                                                    THEN 'critico_automatico' END
          ]) WHERE unnest IS NOT NULL
        ),
        (
          (100.0*sum(rp.quantidade_peso_2 + rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) > v_c_principal
          OR (100.0*sum(rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) >= v_c_agravamento
          OR (100.0*sum(rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) >= v_c_critico
        ),
        CASE
          WHEN (100.0*sum(rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) >= v_c_critico THEN 'Crítica'::public.psico_prioridade_fator
          WHEN (100.0*sum(rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) >= v_c_agravamento THEN 'Alta'::public.psico_prioridade_fator
          WHEN (100.0*sum(rp.quantidade_peso_2 + rp.quantidade_peso_3 + rp.quantidade_peso_4)/NULLIF(sum(rp.total_respostas_validas),0)) > v_c_principal THEN 'Média'::public.psico_prioridade_fator
          ELSE 'Monitoramento'::public.psico_prioridade_fator
        END
      FROM public.psico_fatores f
      JOIN public.psico_perguntas p ON p.fator_id = f.id AND p.ativa = true
      JOIN public.psico_resultados_perguntas rp ON rp.pergunta_id = p.id AND rp.escopo_id = v_escopo_id
      WHERE f.questionario_versao_id = v_av.questionario_versao_id AND f.ativo = true
      GROUP BY f.id, f.ordem;

      SELECT
        (sum(soma_pesos)::numeric / NULLIF(sum(total_respostas_validas),0))::numeric,
        count(*) FILTER (WHERE significativo),
        COALESCE(
          (SELECT prioridade FROM public.psico_resultados_fatores
             WHERE escopo_id = v_escopo_id
             ORDER BY CASE prioridade
                        WHEN 'Crítica' THEN 4 WHEN 'Alta' THEN 3
                        WHEN 'Média' THEN 2 ELSE 1 END DESC
             LIMIT 1),
          'Monitoramento'
        )
      INTO v_indice_geral, v_fatores_signif, v_prio_max
      FROM public.psico_resultados_fatores WHERE escopo_id = v_escopo_id;

      v_class_geral := public.psico_classificar_score(v_av.metodologia_versao_id, v_indice_geral);

      UPDATE public.psico_resultado_escopos
         SET indice_geral_descritivo = v_indice_geral,
             classificacao_indice_geral = v_class_geral,
             fatores_significativos = v_fatores_signif,
             prioridade_maxima = v_prio_max
       WHERE id = v_escopo_id;
    END LOOP;

    UPDATE public.psico_resultado_processamentos
       SET status = 'concluido',
           ativo = true,
           concluido_em = now(),
           total_escopos = v_escopos_criados,
           escopos_funcao_elegiveis = v_escopos_func,
           escopos_setor_elegiveis = v_escopos_set,
           escopos_unidade_elegiveis = v_escopos_uni,
           escopos_suprimidos = v_escopos_supr
     WHERE id = v_proc_id;

    PERFORM set_config('psico.admin_correcao', 'on', true);
    BEGIN
      UPDATE public.psico_avaliacoes
         SET status = 'resultado_pronto',
             processamento_resultado_ativo_id = v_proc_id,
             resultado_processado_em = now(),
             resultado_processado_por = v_uid,
             versao_motor_resultado = v_versao_motor,
             atualizado_por = v_uid,
             updated_at = now()
       WHERE id = p_avaliacao_id;
    EXCEPTION WHEN OTHERS THEN
      PERFORM set_config('psico.admin_correcao', 'off', true);
      RAISE;
    END;
    PERFORM set_config('psico.admin_correcao', 'off', true);

    INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
    VALUES ('psico_avaliacao', p_avaliacao_id, 'processamento_resultados_concluido', v_uid,
            jsonb_build_object(
              'processamento_id', v_proc_id,
              'versao_motor', v_versao_motor,
              'hash_prefix', substring(v_hash,1,12),
              'total_respondentes', v_total_resp,
              'total_escopos', v_escopos_criados,
              'escopos_suprimidos', v_escopos_supr
            ));

    RETURN jsonb_build_object(
      'ok', true,
      'reutilizado', false,
      'processamento_id', v_proc_id,
      'versao_motor', v_versao_motor,
      'hash_entrada', v_hash,
      'total_respondentes', v_total_resp,
      'total_escopos', v_escopos_criados,
      'escopos_suprimidos', v_escopos_supr
    );
  EXCEPTION WHEN OTHERS THEN
    BEGIN
      UPDATE public.psico_resultado_processamentos
         SET status = 'falhou', ativo = false,
             erro_codigo = COALESCE(SQLERRM, 'ERRO_INTERNO_PROCESSAMENTO')
       WHERE id = v_proc_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    DELETE FROM public.psico_resultados_fatores WHERE escopo_id IN
      (SELECT id FROM public.psico_resultado_escopos WHERE processamento_id = v_proc_id);
    DELETE FROM public.psico_resultados_perguntas WHERE escopo_id IN
      (SELECT id FROM public.psico_resultado_escopos WHERE processamento_id = v_proc_id);
    DELETE FROM public.psico_resultado_escopos WHERE processamento_id = v_proc_id;

    INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
    VALUES ('psico_avaliacao', p_avaliacao_id, 'processamento_resultados_falhou', v_uid,
            jsonb_build_object('processamento_id', v_proc_id,
                               'erro_codigo', 'ERRO_INTERNO_PROCESSAMENTO'));
    RAISE;
  END;
END;
$function$;