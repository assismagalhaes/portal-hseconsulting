
-- =============================================================
-- FASE 5 · BLOCO 3 — MOTOR DE CÁLCULO
-- Versão do motor: HSE-PSICO-CALC-1.0.0
-- =============================================================

-- Extensão pgcrypto (para digest sha256)
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Helper: comparar prioridades ---------------------------------
CREATE OR REPLACE FUNCTION public.psico_prioridade_max(
  a public.psico_prioridade_fator, b public.psico_prioridade_fator
) RETURNS public.psico_prioridade_fator
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN (CASE a WHEN 'Crítica' THEN 4 WHEN 'Alta' THEN 3 WHEN 'Média' THEN 2 ELSE 1 END)
       >= (CASE b WHEN 'Crítica' THEN 4 WHEN 'Alta' THEN 3 WHEN 'Média' THEN 2 ELSE 1 END)
    THEN a ELSE b END;
$$;

-- Hash determinístico ------------------------------------------
CREATE OR REPLACE FUNCTION public.psico_hash_entrada_resultado(p_avaliacao_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txt text;
  v_hash text;
  v_qv uuid;
  v_mv uuid;
BEGIN
  SELECT questionario_versao_id, metodologia_versao_id
    INTO v_qv, v_mv
    FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;

  SELECT string_agg(linha, E'\n' ORDER BY linha) INTO v_txt
  FROM (
    SELECT r.id::text || '|' || i.pergunta_id::text || '|' || i.opcao_resposta_id::text AS linha
      FROM public.psico_respostas r
      JOIN public.psico_respostas_itens i ON i.resposta_id = r.id
     WHERE r.avaliacao_id = p_avaliacao_id
  ) s;

  v_txt := coalesce(p_avaliacao_id::text,'') || '|' ||
           coalesce(v_qv::text,'') || '|' ||
           coalesce(v_mv::text,'') || E'\n' || coalesce(v_txt,'');

  v_hash := encode(public.digest(v_txt, 'sha256'), 'hex');
  RETURN v_hash;
END;
$$;

-- =============================================================
-- VALIDAÇÃO
-- =============================================================
CREATE OR REPLACE FUNCTION public.psico_validar_processamento_resultados(
  p_avaliacao_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_av public.psico_avaliacoes%ROWTYPE;
  v_qv public.psico_questionarios_versoes%ROWTYPE;
  v_mv public.psico_metodologias_versoes%ROWTYPE;
  v_erros jsonb := '[]'::jsonb;
  v_avisos jsonb := '[]'::jsonb;
  v_qtd_fatores int;
  v_qtd_perg int;
  v_qtd_opcoes int;
  v_qtd_resp int;
  v_qtd_convites_resp int;
  v_itens_por_resposta_ok boolean;
  v_hash text;
  v_proc_existente uuid;
  v_min_global int;
  v_amostra_ok boolean;
  v_amostra_reduzida boolean := false;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Avaliação não encontrada.' USING ERRCODE='no_data_found';
  END IF;

  IF v_av.status NOT IN ('coleta_encerrada','resultado_pronto') THEN
    v_erros := v_erros || jsonb_build_array('Status inválido: só é possível processar após encerrar a coleta.');
  END IF;
  IF v_av.questionario_versao_id IS NULL THEN
    v_erros := v_erros || jsonb_build_array('Avaliação sem questionário vinculado.');
  END IF;
  IF v_av.metodologia_versao_id IS NULL THEN
    v_erros := v_erros || jsonb_build_array('Avaliação sem metodologia vinculada.');
  END IF;

  IF v_av.questionario_versao_id IS NOT NULL THEN
    SELECT * INTO v_qv FROM public.psico_questionarios_versoes WHERE id = v_av.questionario_versao_id;
    IF NOT FOUND OR v_qv.status NOT IN ('publicado','arquivado') THEN
      v_erros := v_erros || jsonb_build_array('Questionário não está publicado ou arquivado.');
    END IF;
  END IF;

  IF v_av.metodologia_versao_id IS NOT NULL THEN
    SELECT * INTO v_mv FROM public.psico_metodologias_versoes WHERE id = v_av.metodologia_versao_id;
    IF NOT FOUND OR v_mv.status NOT IN ('ativa','arquivada','publicada') THEN
      -- aceita ativa/publicada/arquivada de acordo com o enum existente
      NULL;
    END IF;
    IF v_mv.unidade_calculo IS DISTINCT FROM 'quantidade_respostas' THEN
      v_erros := v_erros || jsonb_build_array('Unidade de cálculo deve ser quantidade_respostas.');
    END IF;
  END IF;

  -- Estrutura questionário
  SELECT count(*) INTO v_qtd_fatores FROM public.psico_fatores
   WHERE questionario_versao_id = v_av.questionario_versao_id AND ativo = true;
  SELECT count(*) INTO v_qtd_perg FROM public.psico_perguntas
   WHERE questionario_versao_id = v_av.questionario_versao_id AND ativa = true;
  SELECT count(*) INTO v_qtd_opcoes FROM public.psico_opcoes_resposta
   WHERE metodologia_versao_id = v_av.metodologia_versao_id AND ativo = true;

  IF v_qtd_fatores <> 7 THEN
    v_erros := v_erros || jsonb_build_array(format('Questionário deve ter 7 fatores ativos (encontrados: %s).', v_qtd_fatores));
  END IF;
  IF v_qtd_perg <> 35 THEN
    v_erros := v_erros || jsonb_build_array(format('Questionário deve ter 35 perguntas ativas (encontradas: %s).', v_qtd_perg));
  END IF;
  IF v_qtd_opcoes <> 5 THEN
    v_erros := v_erros || jsonb_build_array(format('Metodologia deve ter 5 opções de resposta (encontradas: %s).', v_qtd_opcoes));
  END IF;

  -- Respostas
  SELECT count(*) INTO v_qtd_resp FROM public.psico_respostas WHERE avaliacao_id = p_avaliacao_id;
  SELECT count(*) INTO v_qtd_convites_resp FROM public.psico_convites
   WHERE avaliacao_id = p_avaliacao_id AND status = 'respondido';

  -- Convites respondidos == respostas
  IF v_qtd_convites_resp <> v_qtd_resp THEN
    v_erros := v_erros || jsonb_build_array(
      format('Divergência entre convites respondidos (%s) e respostas anônimas (%s).',
             v_qtd_convites_resp, v_qtd_resp));
  END IF;

  -- 35 itens por resposta e sem duplicidade
  SELECT NOT EXISTS (
    SELECT 1 FROM (
      SELECT r.id, count(i.*) c
        FROM public.psico_respostas r
        JOIN public.psico_respostas_itens i ON i.resposta_id = r.id
       WHERE r.avaliacao_id = p_avaliacao_id
       GROUP BY r.id
    ) t WHERE t.c <> 35
  ) INTO v_itens_por_resposta_ok;
  IF NOT v_itens_por_resposta_ok THEN
    v_erros := v_erros || jsonb_build_array('Existe(m) resposta(s) sem exatamente 35 itens.');
  END IF;

  -- Mínimo global e amostra
  v_min_global := COALESCE(v_mv.minimo_respondentes_global, 2);
  v_amostra_ok := v_qtd_resp >= v_min_global;
  v_amostra_reduzida := v_qtd_resp >= v_min_global AND v_qtd_resp < 5;

  IF v_qtd_resp = 0 THEN
    v_avisos := v_avisos || jsonb_build_array('Nenhuma resposta foi coletada.');
  ELSIF v_qtd_resp = 1 THEN
    v_avisos := v_avisos || jsonb_build_array('A amostra não atende ao mínimo global de 2 respondentes.');
  ELSIF v_amostra_reduzida THEN
    v_avisos := v_avisos || jsonb_build_array('Amostra reduzida: resultados globais válidos, sem segmentações.');
  END IF;

  -- Hash e idempotência
  v_hash := public.psico_hash_entrada_resultado(p_avaliacao_id);
  SELECT id INTO v_proc_existente
    FROM public.psico_resultado_processamentos
   WHERE avaliacao_id = p_avaliacao_id
     AND versao_motor = 'HSE-PSICO-CALC-1.0.0'
     AND hash_entrada = v_hash
     AND status = 'concluido'
   ORDER BY concluido_em DESC LIMIT 1;

  RETURN jsonb_build_object(
    'valido', jsonb_array_length(v_erros) = 0,
    'pode_processar', jsonb_array_length(v_erros) = 0 AND v_amostra_ok,
    'total_respondentes', v_qtd_resp,
    'total_itens', v_qtd_resp * 35,
    'minimo_global', v_min_global,
    'amostra_suficiente', v_amostra_ok,
    'amostra_reduzida', v_amostra_reduzida,
    'integridade_ok', v_itens_por_resposta_ok AND (v_qtd_convites_resp = v_qtd_resp),
    'processamento_existente', v_proc_existente,
    'mesmo_hash', v_proc_existente IS NOT NULL,
    'hash_entrada', v_hash,
    'versao_motor', 'HSE-PSICO-CALC-1.0.0',
    'erros', v_erros,
    'avisos', v_avisos
  );
END;
$$;

REVOKE ALL ON FUNCTION public.psico_validar_processamento_resultados(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_validar_processamento_resultados(uuid) TO authenticated;

-- =============================================================
-- MOTOR DE PROCESSAMENTO
-- =============================================================
CREATE OR REPLACE FUNCTION public.psico_processar_resultados(
  p_avaliacao_id uuid,
  p_confirmacao text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Escopos
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

  -- Cálculo
  v_indice_geral numeric;
  v_class_geral public.psico_classificacao_risco;
  v_fatores_signif int;
  v_prio_max public.psico_prioridade_fator;
  v_prio_fat public.psico_prioridade_fator;

  -- Critérios metodologia
  v_c_principal numeric;
  v_c_agravamento numeric;
  v_c_critico numeric;

  r record;
BEGIN
  -- 1) Auth
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado.' USING ERRCODE='insufficient_privilege';
  END IF;
  IF NOT public.can_see_internal(v_uid) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;

  -- 2) Bloqueio + validação básica
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

  -- 3) Idempotência: já existe processamento concluído com mesmo hash?
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

  -- 4) Metodologia / limites
  SELECT * INTO v_mv FROM public.psico_metodologias_versoes WHERE id = v_av.metodologia_versao_id;
  SELECT * INTO v_qv FROM public.psico_questionarios_versoes WHERE id = v_av.questionario_versao_id;
  v_min_global := COALESCE(v_mv.minimo_respondentes_global, 2);
  v_min_seg    := COALESCE(v_mv.minimo_respondentes_segmentacao, 3);
  v_c_principal := COALESCE(v_mv.criterio_principal_percentual, 50);
  v_c_agravamento := COALESCE(v_mv.criterio_agravamento_percentual, 30);
  v_c_critico := COALESCE(v_mv.criterio_critico_percentual, 10);
  v_amostra_reduzida := v_total_resp < 5;

  -- 5) Desativar processamentos ativos anteriores (marca como substituido)
  UPDATE public.psico_resultado_processamentos
     SET ativo = false, substituido_em = now(), status = 'substituido'
   WHERE avaliacao_id = p_avaliacao_id AND ativo = true AND status = 'concluido';

  -- 6) Criar processamento em curso
  INSERT INTO public.psico_resultado_processamentos (
    avaliacao_id, questionario_versao_id, metodologia_versao_id,
    versao_motor, status, hash_entrada, total_respondentes, total_itens,
    iniciado_por, iniciado_em, ativo
  ) VALUES (
    p_avaliacao_id, v_av.questionario_versao_id, v_av.metodologia_versao_id,
    v_versao_motor, 'processando', v_hash, v_total_resp, v_total_resp*35,
    v_uid, now(), false
  ) RETURNING id INTO v_proc_id;

  -- Auditoria início
  INSERT INTO public.psico_auditoria (entidade, entidade_id, acao, usuario_id, metadados)
  VALUES ('psico_avaliacao', p_avaliacao_id, 'processamento_resultados_iniciado', v_uid,
          jsonb_build_object('processamento_id', v_proc_id,
                             'versao_motor', v_versao_motor,
                             'hash_prefix', substring(v_hash,1,12),
                             'total_respondentes', v_total_resp));

  BEGIN
    -- =========================================================
    -- 7) Montar lista de escopos a processar
    -- =========================================================
    -- Global sempre
    -- Segmentações somente se v_total_resp >= 5 (fase 5)
    -- e cada segmento com respondentes >= v_min_seg
    FOR r IN
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
      v_escopo_tipo := r.tipo;
      v_escopo_key  := r.chave;
      v_escopo_rot  := r.rotulo;
      v_escopo_resp := r.respondentes;

      -- Supressão
      IF v_escopo_tipo <> 'global' THEN
        IF v_escopo_resp < v_min_seg THEN
          v_escopos_supr := v_escopos_supr + 1;
          CONTINUE;
        END IF;
        -- Segmento igual ao global (mesmo total) — evitar duplicata
        IF v_escopo_resp = v_total_resp THEN
          v_escopos_supr := v_escopos_supr + 1;
          CONTINUE;
        END IF;
      END IF;

      -- Cria escopo (índice/prioridade preenchidos ao fim)
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

      -- Contadores para metadados
      IF v_escopo_tipo='funcao' THEN v_escopos_func := v_escopos_func + 1; END IF;
      IF v_escopo_tipo='setor'  THEN v_escopos_set  := v_escopos_set  + 1; END IF;
      IF v_escopo_tipo='unidade' THEN v_escopos_uni := v_escopos_uni + 1; END IF;
      v_escopos_criados := v_escopos_criados + 1;

      -- =====================================================
      -- 7a) Resultados por PERGUNTA para este escopo
      -- =====================================================
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
      JOIN public.psico_respostas r ON r.avaliacao_id = p_avaliacao_id
      JOIN public.psico_respostas_itens i ON i.resposta_id = r.id AND i.pergunta_id = p.id
      JOIN LATERAL (
        SELECT o.codigo,
               CASE WHEN p.sentido_pontuacao='direta' THEN o.peso_direta ELSE o.peso_invertida END AS peso
          FROM public.psico_opcoes_resposta o WHERE o.id = i.opcao_resposta_id
      ) o ON true
      WHERE p.questionario_versao_id = v_av.questionario_versao_id
        AND p.ativa = true
        AND (v_escopo_tipo='global'
             OR (v_escopo_tipo='funcao'  AND r.funcao_normalizada  = v_escopo_key)
             OR (v_escopo_tipo='setor'   AND r.setor_normalizado   = v_escopo_key)
             OR (v_escopo_tipo='unidade' AND r.unidade_normalizada = v_escopo_key))
      GROUP BY p.id, p.fator_id, p.numero;

      -- Valida: cada pergunta deve ter v_escopo_resp respostas válidas
      IF EXISTS (
        SELECT 1 FROM public.psico_resultados_perguntas
         WHERE escopo_id = v_escopo_id AND total_respostas_validas <> v_escopo_resp
      ) OR (
        SELECT count(*) FROM public.psico_resultados_perguntas WHERE escopo_id = v_escopo_id
      ) <> 35 THEN
        RAISE EXCEPTION 'TOTAL_ITENS_INVALIDO' USING ERRCODE='check_violation';
      END IF;

      -- =====================================================
      -- 7b) Resultados por FATOR
      -- =====================================================
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
        -- critérios (usando valores exatos, não arredondados)
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

      -- =====================================================
      -- 7c) Atualizar escopo: índice geral, sig, prio_max
      -- =====================================================
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

      -- Update permitido enquanto processamento está 'processando'
      UPDATE public.psico_resultado_escopos
         SET indice_geral_descritivo = v_indice_geral,
             classificacao_indice_geral = v_class_geral,
             fatores_significativos = v_fatores_signif,
             prioridade_maxima = v_prio_max
       WHERE id = v_escopo_id;
    END LOOP;

    -- 8) Fecha processamento
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

    -- 9) Atualiza avaliação (bypass da trigger de bloqueio via flag)
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
    -- Marca processamento como falhou (não fica ativo)
    BEGIN
      UPDATE public.psico_resultado_processamentos
         SET status = 'falhou', ativo = false,
             erro_codigo = COALESCE(SQLERRM, 'ERRO_INTERNO_PROCESSAMENTO')
       WHERE id = v_proc_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- Limpa possíveis filhos criados
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
$$;

REVOKE ALL ON FUNCTION public.psico_processar_resultados(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_processar_resultados(uuid, text) TO authenticated;

-- =============================================================
-- RPCs DE CONSULTA
-- =============================================================
CREATE OR REPLACE FUNCTION public.psico_obter_resultado_resumo(p_avaliacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proc_id uuid;
  v_res jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT processamento_resultado_ativo_id INTO v_proc_id
    FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF v_proc_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'processamento_id', p.id,
    'versao_motor', p.versao_motor,
    'hash_prefix', substring(p.hash_entrada,1,12),
    'concluido_em', p.concluido_em,
    'total_respondentes', p.total_respondentes,
    'total_itens', p.total_itens,
    'total_escopos', p.total_escopos,
    'escopos_funcao_elegiveis', p.escopos_funcao_elegiveis,
    'escopos_setor_elegiveis', p.escopos_setor_elegiveis,
    'escopos_unidade_elegiveis', p.escopos_unidade_elegiveis,
    'escopos_suprimidos', p.escopos_suprimidos,
    'global', (
      SELECT jsonb_build_object(
        'id', e.id,
        'respondentes', e.respondentes,
        'indice_geral_descritivo', e.indice_geral_descritivo,
        'classificacao_indice_geral', e.classificacao_indice_geral,
        'fatores_significativos', e.fatores_significativos,
        'prioridade_maxima', e.prioridade_maxima,
        'amostra_reduzida', e.amostra_reduzida
      )
      FROM public.psico_resultado_escopos e
      WHERE e.processamento_id = p.id AND e.tipo='global'
    )
  ) INTO v_res
  FROM public.psico_resultado_processamentos p WHERE p.id = v_proc_id;

  RETURN v_res;
END;$$;

CREATE OR REPLACE FUNCTION public.psico_listar_escopos_resultado(p_avaliacao_id uuid)
RETURNS TABLE (
  id uuid, tipo public.psico_resultado_escopo_tipo, chave_normalizada text, rotulo text,
  respondentes int, minimo_aplicado int, total_itens int,
  indice_geral_descritivo numeric, classificacao_indice_geral public.psico_classificacao_risco,
  fatores_significativos int, prioridade_maxima public.psico_prioridade_fator, amostra_reduzida boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_proc uuid;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT processamento_resultado_ativo_id INTO v_proc
    FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF v_proc IS NULL THEN RETURN; END IF;

  RETURN QUERY
    SELECT e.id, e.tipo, e.chave_normalizada, e.rotulo, e.respondentes, e.minimo_aplicado,
           e.total_itens, e.indice_geral_descritivo, e.classificacao_indice_geral,
           e.fatores_significativos, e.prioridade_maxima, e.amostra_reduzida
      FROM public.psico_resultado_escopos e
     WHERE e.processamento_id = v_proc
     ORDER BY CASE e.tipo WHEN 'global' THEN 0 WHEN 'funcao' THEN 1 WHEN 'setor' THEN 2 ELSE 3 END,
              e.rotulo;
END;$$;

CREATE OR REPLACE FUNCTION public.psico_obter_resultados_fatores(
  p_avaliacao_id uuid, p_escopo_id uuid
) RETURNS SETOF public.psico_resultados_fatores
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_proc uuid; v_ok boolean;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT processamento_resultado_ativo_id INTO v_proc
    FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  SELECT EXISTS(SELECT 1 FROM public.psico_resultado_escopos
                 WHERE id = p_escopo_id AND processamento_id = v_proc) INTO v_ok;
  IF NOT v_ok THEN RETURN; END IF;

  RETURN QUERY
    SELECT * FROM public.psico_resultados_fatores WHERE escopo_id = p_escopo_id ORDER BY ordem;
END;$$;

CREATE OR REPLACE FUNCTION public.psico_obter_resultados_perguntas(
  p_avaliacao_id uuid, p_escopo_id uuid, p_fator_id uuid DEFAULT NULL
) RETURNS SETOF public.psico_resultados_perguntas
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_proc uuid; v_ok boolean;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'Não autorizado.' USING ERRCODE='insufficient_privilege';
  END IF;
  SELECT processamento_resultado_ativo_id INTO v_proc
    FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  SELECT EXISTS(SELECT 1 FROM public.psico_resultado_escopos
                 WHERE id = p_escopo_id AND processamento_id = v_proc) INTO v_ok;
  IF NOT v_ok THEN RETURN; END IF;

  RETURN QUERY
    SELECT * FROM public.psico_resultados_perguntas
     WHERE escopo_id = p_escopo_id
       AND (p_fator_id IS NULL OR fator_id = p_fator_id)
     ORDER BY numero;
END;$$;

REVOKE ALL ON FUNCTION public.psico_obter_resultado_resumo(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_listar_escopos_resultado(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_obter_resultados_fatores(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_obter_resultados_perguntas(uuid, uuid, uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.psico_obter_resultado_resumo(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.psico_listar_escopos_resultado(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.psico_obter_resultados_fatores(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.psico_obter_resultados_perguntas(uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.psico_processar_resultados IS 'Motor de cálculo dos resultados. Confirmação exigida: PROCESSAR <codigo_da_avaliacao>.';
