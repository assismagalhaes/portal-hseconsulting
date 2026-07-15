
-- =====================================================================
-- FASE 6 · RPCs consolidadas de resultados psicossociais
-- Todas as funções são SECURITY DEFINER, search_path travado,
-- protegidas por public.can_see_internal(auth.uid()).
-- Nenhuma retorna resposta_id, participante_id, convite_id, token, nome.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) DASHBOARD CONSOLIDADO
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.psico_obter_dashboard_resultados(
  p_avaliacao_id uuid,
  p_escopo_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_aval          public.psico_avaliacoes%ROWTYPE;
  v_proc          public.psico_resultado_processamentos%ROWTYPE;
  v_escopo        public.psico_resultado_escopos%ROWTYPE;
  v_quest_codigo  text;
  v_quest_versao  text;
  v_metod_codigo  text;
  v_metod_versao  text;
  v_cliente_nome  text;
  v_fatores       jsonb;
  v_qtd_fat       integer;
  v_qtd_perg      integer;
  v_perguntas_at  jsonb;
  v_participacao  jsonb;
  v_avisos        jsonb := '[]'::jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT * INTO v_aval FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro','PROCESSAMENTO_NAO_LOCALIZADO');
  END IF;
  IF v_aval.status NOT IN ('resultado_pronto','relatorio_emitido') THEN
    RETURN jsonb_build_object('erro','PROCESSAMENTO_NAO_LOCALIZADO');
  END IF;
  IF v_aval.processamento_resultado_ativo_id IS NULL THEN
    RETURN jsonb_build_object('erro','PROCESSAMENTO_NAO_LOCALIZADO');
  END IF;

  SELECT * INTO v_proc FROM public.psico_resultado_processamentos
    WHERE id = v_aval.processamento_resultado_ativo_id;
  IF NOT FOUND OR v_proc.status <> 'concluido' OR v_proc.avaliacao_id <> v_aval.id THEN
    RETURN jsonb_build_object('erro','PROCESSAMENTO_INCOMPLETO');
  END IF;

  -- Escopo: usa o solicitado se pertence ao processamento, senão global.
  IF p_escopo_id IS NOT NULL THEN
    SELECT * INTO v_escopo FROM public.psico_resultado_escopos
      WHERE id = p_escopo_id AND processamento_id = v_proc.id;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('erro','ESCOPO_GLOBAL_NAO_LOCALIZADO');
    END IF;
  ELSE
    SELECT * INTO v_escopo FROM public.psico_resultado_escopos
      WHERE processamento_id = v_proc.id AND tipo = 'global' LIMIT 1;
    IF NOT FOUND THEN
      RETURN jsonb_build_object('erro','ESCOPO_GLOBAL_NAO_LOCALIZADO');
    END IF;
  END IF;

  -- Validação de completude (sempre no escopo global do processamento)
  SELECT count(*) INTO v_qtd_fat FROM public.psico_resultados_fatores rf
    JOIN public.psico_resultado_escopos e ON e.id = rf.escopo_id
   WHERE e.processamento_id = v_proc.id AND e.tipo = 'global';
  IF v_qtd_fat < 7 THEN
    RETURN jsonb_build_object('erro','FATORES_INCOMPLETOS');
  END IF;
  SELECT count(*) INTO v_qtd_perg FROM public.psico_resultados_perguntas rp
    JOIN public.psico_resultado_escopos e ON e.id = rp.escopo_id
   WHERE e.processamento_id = v_proc.id AND e.tipo = 'global';
  IF v_qtd_perg < 35 THEN
    RETURN jsonb_build_object('erro','PERGUNTAS_INCOMPLETAS');
  END IF;

  -- Metadados leves
  SELECT qv.codigo, qv.versao INTO v_quest_codigo, v_quest_versao
    FROM public.psico_questionarios_versoes qv
   WHERE qv.id = v_proc.questionario_versao_id;
  SELECT mv.codigo, mv.versao INTO v_metod_codigo, v_metod_versao
    FROM public.psico_metodologias_versoes mv
   WHERE mv.id = v_proc.metodologia_versao_id;
  SELECT coalesce(c.nome_fantasia, c.razao_social) INTO v_cliente_nome
    FROM public.clients c WHERE c.id = v_aval.cliente_id;

  -- Fatores no escopo escolhido, com meta do fator
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.ordem), '[]'::jsonb) INTO v_fatores FROM (
    SELECT
      rf.id, rf.fator_id, rf.ordem,
      f.codigo AS fator_codigo, f.nome AS fator_nome, f.descricao AS fator_descricao,
      rf.quantidade_perguntas, rf.total_respostas_validas,
      rf.score_medio, rf.classificacao_media,
      rf.quantidade_irrelevante, rf.quantidade_baixo, rf.quantidade_medio,
      rf.quantidade_alto, rf.quantidade_critico,
      rf.percentual_irrelevante, rf.percentual_baixo, rf.percentual_medio,
      rf.percentual_alto, rf.percentual_critico,
      rf.percentual_medio_alto_critico, rf.percentual_alto_critico,
      rf.criterio_principal, rf.criterio_agravamento, rf.criterio_critico_automatico,
      rf.criterios_acionados, rf.significativo, rf.prioridade
    FROM public.psico_resultados_fatores rf
    JOIN public.psico_fatores f ON f.id = rf.fator_id
    WHERE rf.escopo_id = v_escopo.id
    ORDER BY rf.ordem
  ) t;

  -- Perguntas de maior atenção (top 5 do escopo)
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_perguntas_at FROM (
    SELECT rp.pergunta_id, rp.numero, rp.fator_id,
           f.nome AS fator_nome, f.codigo AS fator_codigo,
           pg.enunciado, pg.inversa,
           rp.score_medio, rp.classificacao_media,
           rp.percentual_desfavoravel, rp.percentual_alto_critico, rp.percentual_critico
    FROM public.psico_resultados_perguntas rp
    JOIN public.psico_perguntas pg ON pg.id = rp.pergunta_id
    JOIN public.psico_fatores f    ON f.id  = rp.fator_id
   WHERE rp.escopo_id = v_escopo.id
   ORDER BY rp.percentual_critico DESC NULLS LAST,
            rp.percentual_alto_critico DESC NULLS LAST,
            rp.percentual_desfavoravel DESC NULLS LAST,
            rp.numero
   LIMIT 5
  ) t;

  v_participacao := jsonb_build_object(
    'previstos', v_aval.quantidade_participantes_prevista,
    'ativos_abertura', v_aval.quantidade_participantes_abertura,
    'respondentes', v_escopo.respondentes,
    'percentual', CASE
      WHEN coalesce(v_aval.quantidade_participantes_abertura,0) > 0
        THEN round((v_escopo.respondentes::numeric / v_aval.quantidade_participantes_abertura) * 100, 2)
      ELSE NULL END,
    'coleta_aberta_em', v_aval.coleta_aberta_em,
    'coleta_encerrada_em', v_aval.coleta_encerrada_em
  );

  IF v_escopo.amostra_reduzida THEN
    v_avisos := v_avisos || jsonb_build_object('codigo','AMOSTRA_REDUZIDA');
  END IF;
  IF coalesce(v_proc.escopos_suprimidos,0) > 0 THEN
    v_avisos := v_avisos || jsonb_build_object('codigo','GRUPOS_SUPRIMIDOS');
  END IF;

  RETURN jsonb_build_object(
    'avaliacao', jsonb_build_object(
      'id', v_aval.id,
      'codigo', v_aval.codigo,
      'titulo', v_aval.titulo,
      'cliente', v_cliente_nome,
      'unidade', v_aval.unidade,
      'status', v_aval.status,
      'data_inicio_prevista', v_aval.data_inicio_prevista,
      'data_fim_prevista', v_aval.data_fim_prevista
    ),
    'processamento', jsonb_build_object(
      'id', v_proc.id,
      'versao_motor', v_proc.versao_motor,
      'hash_abreviado', substring(v_proc.hash_entrada,1,12),
      'processado_em', v_proc.concluido_em,
      'questionario', jsonb_build_object('codigo', v_quest_codigo, 'versao', v_quest_versao),
      'metodologia', jsonb_build_object('codigo', v_metod_codigo, 'versao', v_metod_versao),
      'total_respondentes', v_proc.total_respondentes,
      'total_itens', v_proc.total_itens,
      'total_escopos', v_proc.total_escopos,
      'escopos_funcao_elegiveis', v_proc.escopos_funcao_elegiveis,
      'escopos_setor_elegiveis',  v_proc.escopos_setor_elegiveis,
      'escopos_unidade_elegiveis',v_proc.escopos_unidade_elegiveis,
      'escopos_suprimidos', v_proc.escopos_suprimidos
    ),
    'escopo', jsonb_build_object(
      'id', v_escopo.id,
      'tipo', v_escopo.tipo,
      'rotulo', v_escopo.rotulo,
      'respondentes', v_escopo.respondentes,
      'minimo_aplicado', v_escopo.minimo_aplicado,
      'amostra_reduzida', v_escopo.amostra_reduzida,
      'total_itens', v_escopo.total_itens,
      'fatores_significativos', v_escopo.fatores_significativos,
      'prioridade_maxima', v_escopo.prioridade_maxima,
      'indice_geral_descritivo', v_escopo.indice_geral_descritivo,
      'classificacao_indice_geral', v_escopo.classificacao_indice_geral
    ),
    'participacao', v_participacao,
    'resumo', jsonb_build_object(
      'indice_geral_descritivo', v_escopo.indice_geral_descritivo,
      'classificacao_indice_geral', v_escopo.classificacao_indice_geral,
      'fatores_significativos', v_escopo.fatores_significativos,
      'prioridade_maxima', v_escopo.prioridade_maxima,
      'total_respostas_validas', v_escopo.total_itens
    ),
    'fatores', v_fatores,
    'perguntas_atencao', v_perguntas_at,
    'avisos', v_avisos
  );
END;$function$;

REVOKE ALL ON FUNCTION public.psico_obter_dashboard_resultados(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_obter_dashboard_resultados(uuid,uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 2) COMPARAÇÃO DESCRITIVA ENTRE SEGMENTOS
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.psico_obter_comparacao_segmentacoes(
  p_avaliacao_id uuid,
  p_tipo         text
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proc uuid;
  v_segmentos jsonb;
  v_fatores   jsonb;
  v_matriz    jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;
  IF p_tipo NOT IN ('funcao','setor','unidade') THEN
    RETURN jsonb_build_object('erro','CONTRATO_INVALIDO');
  END IF;

  SELECT processamento_resultado_ativo_id INTO v_proc
    FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF v_proc IS NULL THEN
    RETURN jsonb_build_object('erro','PROCESSAMENTO_NAO_LOCALIZADO');
  END IF;

  -- Segmentos elegíveis (persistidos) ordem alfabética
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.rotulo), '[]'::jsonb) INTO v_segmentos FROM (
    SELECT e.id, e.rotulo, e.respondentes, e.minimo_aplicado,
           e.fatores_significativos, e.prioridade_maxima,
           e.indice_geral_descritivo, e.classificacao_indice_geral, e.amostra_reduzida
      FROM public.psico_resultado_escopos e
     WHERE e.processamento_id = v_proc AND e.tipo::text = p_tipo
     ORDER BY e.rotulo
  ) t;

  -- Ordem canônica dos fatores (via escopo global do processamento)
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.ordem), '[]'::jsonb) INTO v_fatores FROM (
    SELECT DISTINCT rf.fator_id, f.codigo, f.nome, rf.ordem
      FROM public.psico_resultados_fatores rf
      JOIN public.psico_fatores f ON f.id = rf.fator_id
      JOIN public.psico_resultado_escopos e ON e.id = rf.escopo_id
     WHERE e.processamento_id = v_proc AND e.tipo = 'global'
     ORDER BY rf.ordem
  ) t;

  -- Matriz [segmento_id][fator_id] = { score, classificacao, significativo, prioridade }
  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_matriz FROM (
    SELECT rf.escopo_id AS segmento_id, rf.fator_id,
           rf.score_medio, rf.classificacao_media,
           rf.significativo, rf.prioridade,
           rf.percentual_alto_critico, rf.percentual_critico
      FROM public.psico_resultados_fatores rf
      JOIN public.psico_resultado_escopos e ON e.id = rf.escopo_id
     WHERE e.processamento_id = v_proc AND e.tipo::text = p_tipo
  ) t;

  RETURN jsonb_build_object(
    'tipo', p_tipo,
    'segmentos', v_segmentos,
    'fatores', v_fatores,
    'matriz', v_matriz
  );
END;$function$;

REVOKE ALL ON FUNCTION public.psico_obter_comparacao_segmentacoes(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_obter_comparacao_segmentacoes(uuid,text) TO authenticated;

-- ---------------------------------------------------------------------
-- 3) INTERPRETAÇÃO EXECUTIVA DETERMINÍSTICA
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.psico_obter_interpretacao_executiva(
  p_avaliacao_id uuid,
  p_escopo_id    uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_proc uuid;
  v_escopo public.psico_resultado_escopos%ROWTYPE;
  v_resumo text;
  v_amostra text;
  v_prio jsonb;
  v_mon  jsonb;
  v_perg jsonb;
  v_lim  jsonb := '[]'::jsonb;
  v_count_sig int;
  v_prio_max text;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT processamento_resultado_ativo_id INTO v_proc
    FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF v_proc IS NULL THEN
    RETURN jsonb_build_object('erro','PROCESSAMENTO_NAO_LOCALIZADO');
  END IF;

  IF p_escopo_id IS NULL THEN
    SELECT * INTO v_escopo FROM public.psico_resultado_escopos
      WHERE processamento_id = v_proc AND tipo = 'global' LIMIT 1;
  ELSE
    SELECT * INTO v_escopo FROM public.psico_resultado_escopos
      WHERE id = p_escopo_id AND processamento_id = v_proc;
  END IF;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('erro','ESCOPO_GLOBAL_NAO_LOCALIZADO');
  END IF;

  v_count_sig := coalesce(v_escopo.fatores_significativos, 0);
  v_prio_max  := v_escopo.prioridade_maxima::text;

  IF v_count_sig = 0 THEN
    v_resumo := 'Nenhum dos sete fatores avaliados atendeu aos critérios de significância 50% / 30% / 10%. Recomenda-se manter o monitoramento preventivo das condições de trabalho.';
  ELSE
    v_resumo := format(
      'Foram identificados %s fator(es) significativo(s) entre os sete fatores avaliados. A maior prioridade observada foi %s.',
      v_count_sig,
      CASE v_prio_max
        WHEN 'critica' THEN 'Crítica'
        WHEN 'alta'    THEN 'Alta'
        WHEN 'media'   THEN 'Média'
        ELSE 'Monitoramento'
      END
    );
  END IF;

  IF v_escopo.amostra_reduzida THEN
    v_amostra := 'A amostra é reduzida. Os resultados devem ser interpretados com cautela e não são apresentadas segmentações por função, setor ou unidade.';
    v_lim := v_lim || to_jsonb('AMOSTRA_REDUZIDA'::text);
  ELSE
    v_amostra := format('Resultado consolidado a partir de %s respondente(s) no escopo analisado.', v_escopo.respondentes);
  END IF;

  -- Fatores significativos com texto individual
  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.prioridade_ord, t.ordem), '[]'::jsonb) INTO v_prio FROM (
    SELECT
      rf.fator_id, f.codigo, f.nome, rf.ordem,
      rf.classificacao_media, rf.prioridade,
      rf.criterio_principal, rf.criterio_agravamento, rf.criterio_critico_automatico,
      CASE rf.prioridade::text
        WHEN 'critica' THEN 1 WHEN 'alta' THEN 2
        WHEN 'media' THEN 3 ELSE 4 END AS prioridade_ord,
      format(
        'O fator %s foi considerado significativo em razão do(s) critério(s) %s. Sua classificação média foi %s, com prioridade %s.%s',
        f.nome,
        array_to_string(
          ARRAY(
            SELECT c FROM unnest(ARRAY[
              CASE WHEN rf.criterio_principal            THEN 'Principal (>50%)' END,
              CASE WHEN rf.criterio_agravamento          THEN 'Agravamento (≥30%)' END,
              CASE WHEN rf.criterio_critico_automatico   THEN 'Crítico automático (≥10%)' END
            ]) c WHERE c IS NOT NULL
          ), ', '),
        CASE rf.classificacao_media::text
          WHEN 'irrelevante' THEN 'Risco Irrelevante'
          WHEN 'baixo' THEN 'Risco Baixo'
          WHEN 'medio' THEN 'Risco Médio'
          WHEN 'alto'  THEN 'Risco Alto'
          WHEN 'critico' THEN 'Risco Crítico'
          ELSE rf.classificacao_media::text END,
        CASE rf.prioridade::text
          WHEN 'critica' THEN 'Crítica'
          WHEN 'alta' THEN 'Alta'
          WHEN 'media' THEN 'Média'
          ELSE 'Monitoramento' END,
        CASE WHEN rf.criterio_critico_automatico
             THEN ' Inclui-se atenção específica à concentração de respostas no nível Crítico.'
             ELSE '' END
      ) AS texto
    FROM public.psico_resultados_fatores rf
    JOIN public.psico_fatores f ON f.id = rf.fator_id
    WHERE rf.escopo_id = v_escopo.id AND rf.significativo = true
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t) ORDER BY t.ordem), '[]'::jsonb) INTO v_mon FROM (
    SELECT rf.fator_id, f.codigo, f.nome, rf.ordem, rf.classificacao_media,
      format('O fator %s não atingiu os critérios de significância e permanece em monitoramento preventivo.', f.nome) AS texto
    FROM public.psico_resultados_fatores rf
    JOIN public.psico_fatores f ON f.id = rf.fator_id
    WHERE rf.escopo_id = v_escopo.id AND rf.significativo = false
  ) t;

  SELECT coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_perg FROM (
    SELECT rp.numero, rp.pergunta_id, rp.fator_id, f.nome AS fator_nome,
           rp.percentual_desfavoravel, rp.percentual_alto_critico, rp.percentual_critico
      FROM public.psico_resultados_perguntas rp
      JOIN public.psico_fatores f ON f.id = rp.fator_id
     WHERE rp.escopo_id = v_escopo.id
     ORDER BY rp.percentual_critico DESC NULLS LAST,
              rp.percentual_alto_critico DESC NULLS LAST,
              rp.percentual_desfavoravel DESC NULLS LAST,
              rp.numero
     LIMIT 5
  ) t;

  RETURN jsonb_build_object(
    'gerado_em', now(),
    'escopo_id', v_escopo.id,
    'resumo_geral', v_resumo,
    'situacao_amostra', v_amostra,
    'fatores_prioritarios', v_prio,
    'fatores_monitoramento', v_mon,
    'perguntas_atencao', v_perg,
    'limitacoes', v_lim
  );
END;$function$;

REVOKE ALL ON FUNCTION public.psico_obter_interpretacao_executiva(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_obter_interpretacao_executiva(uuid,uuid) TO authenticated;
