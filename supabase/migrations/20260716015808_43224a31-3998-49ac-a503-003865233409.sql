
-- ============================================================================
-- FASE 9 — BLOCO 4: Modo Agregado
-- ============================================================================

-- 1. Commit da importação agregada
CREATE OR REPLACE FUNCTION public.psico_importacao_commit_agregada(
  p_importacao_id uuid,
  p_avaliacao jsonb,      -- {titulo, unidade, data_inicio, data_fim, observacao_origem, avaliacao_id?}
  p_linhas jsonb          -- [{numero, quantidade_nunca, quantidade_raramente, quantidade_as_vezes, quantidade_frequentemente, quantidade_sempre}]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imp record;
  v_aval_id uuid;
  v_linha jsonb;
  v_num int;
  v_pergunta_id uuid;
  v_qn int; v_qr int; v_qv int; v_qf int; v_qs int; v_total int;
  v_perguntas_gravadas int := 0;
BEGIN
  PERFORM public._psico_require_admin_tec();

  SELECT * INTO v_imp FROM public.psico_importacoes_avaliacoes WHERE id=p_importacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'importacao_nao_encontrada'; END IF;
  IF v_imp.tipo <> 'agregada_perguntas' THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF v_imp.status NOT IN ('mapeamento','validando','pronto_para_importar','arquivo_recebido') THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE='55000';
  END IF;

  UPDATE public.psico_importacoes_avaliacoes SET status='importando', updated_at=now() WHERE id=p_importacao_id;

  -- Cria ou reutiliza avaliação
  IF (p_avaliacao ? 'avaliacao_id') AND NULLIF(p_avaliacao->>'avaliacao_id','') IS NOT NULL THEN
    v_aval_id := (p_avaliacao->>'avaliacao_id')::uuid;
    UPDATE public.psico_avaliacoes
       SET origem_coleta='importacao_agregada'::psico_origem_coleta,
           importacao_avaliacao_id=p_importacao_id,
           importado_em=COALESCE(importado_em, now()),
           importado_por=COALESCE(importado_por, auth.uid()),
           participacao_calculavel=false,
           segmentacao_disponivel=false,
           observacao_origem=COALESCE(p_avaliacao->>'observacao_origem', observacao_origem),
           updated_at=now()
     WHERE id=v_aval_id AND cliente_id=v_imp.cliente_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'avaliacao_incompativel' USING ERRCODE='23514'; END IF;
  ELSE
    INSERT INTO public.psico_avaliacoes (
      codigo, cliente_id, metodologia_versao_id, questionario_versao_id,
      titulo, unidade, data_inicio_prevista, data_fim_prevista, status,
      origem_coleta, importacao_avaliacao_id, importado_em, importado_por,
      observacao_origem, participacao_calculavel, segmentacao_disponivel,
      criado_por, atualizado_por, coleta_encerrada_em, motivo_encerramento
    ) VALUES (
      'IMPAGG-' || substr(encode(gen_random_bytes(6),'hex'),1,10),
      v_imp.cliente_id, v_imp.metodologia_versao_id, v_imp.questionario_versao_id,
      COALESCE(p_avaliacao->>'titulo','Avaliação histórica (agregada)'),
      NULLIF(p_avaliacao->>'unidade',''),
      NULLIF(p_avaliacao->>'data_inicio','')::date,
      NULLIF(p_avaliacao->>'data_fim','')::date,
      'coleta_encerrada'::psico_avaliacao_status,
      'importacao_agregada'::psico_origem_coleta,
      p_importacao_id, now(), auth.uid(),
      NULLIF(p_avaliacao->>'observacao_origem',''),
      false, false,
      auth.uid(), auth.uid(),
      now(), 'Importação histórica (agregada)'
    ) RETURNING id INTO v_aval_id;
  END IF;

  UPDATE public.psico_importacoes_avaliacoes SET avaliacao_id=v_aval_id, updated_at=now() WHERE id=p_importacao_id;

  -- Limpa agregados anteriores desta avaliação (idempotência do commit)
  DELETE FROM public.psico_dados_agregados_perguntas WHERE avaliacao_id=v_aval_id;

  FOR v_linha IN SELECT * FROM jsonb_array_elements(COALESCE(p_linhas,'[]'::jsonb))
  LOOP
    v_num := NULLIF(v_linha->>'numero','')::int;
    IF v_num IS NULL THEN CONTINUE; END IF;
    SELECT id INTO v_pergunta_id
      FROM public.psico_perguntas
     WHERE questionario_versao_id=v_imp.questionario_versao_id AND numero=v_num;
    IF v_pergunta_id IS NULL THEN CONTINUE; END IF;

    v_qn := COALESCE(NULLIF(v_linha->>'quantidade_nunca','')::int, 0);
    v_qr := COALESCE(NULLIF(v_linha->>'quantidade_raramente','')::int, 0);
    v_qv := COALESCE(NULLIF(v_linha->>'quantidade_as_vezes','')::int, 0);
    v_qf := COALESCE(NULLIF(v_linha->>'quantidade_frequentemente','')::int, 0);
    v_qs := COALESCE(NULLIF(v_linha->>'quantidade_sempre','')::int, 0);
    v_total := v_qn + v_qr + v_qv + v_qf + v_qs;
    IF v_total = 0 THEN CONTINUE; END IF;

    INSERT INTO public.psico_dados_agregados_perguntas (
      importacao_id, avaliacao_id, questionario_versao_id, metodologia_versao_id,
      pergunta_id, numero,
      quantidade_nunca, quantidade_raramente, quantidade_as_vezes,
      quantidade_frequentemente, quantidade_sempre, total_respostas
    ) VALUES (
      p_importacao_id, v_aval_id, v_imp.questionario_versao_id, v_imp.metodologia_versao_id,
      v_pergunta_id, v_num,
      v_qn, v_qr, v_qv, v_qf, v_qs, v_total
    );
    v_perguntas_gravadas := v_perguntas_gravadas + 1;
  END LOOP;

  UPDATE public.psico_importacoes_avaliacoes
     SET status='concluida', respondentes_importados=0,
         total_itens_importados=v_perguntas_gravadas,
         concluido_em=now(), updated_at=now()
   WHERE id=p_importacao_id;

  RETURN jsonb_build_object(
    'avaliacao_id', v_aval_id,
    'perguntas_gravadas', v_perguntas_gravadas
  );
END;
$$;

REVOKE ALL ON FUNCTION public.psico_importacao_commit_agregada(uuid,jsonb,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_importacao_commit_agregada(uuid,jsonb,jsonb) TO authenticated, service_role;

-- ============================================================================
-- 2. Motor de cálculo AGREGADO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_processar_resultados_agregada(
  p_avaliacao_id uuid,
  p_confirmacao text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av public.psico_avaliacoes%ROWTYPE;
  v_mv public.psico_metodologias_versoes%ROWTYPE;
  v_proc_id uuid;
  v_versao_motor text := 'HSE-PSICO-CALC-1.0-AGG';
  v_escopo_id uuid;
  v_hash text;
  v_total_respondentes int;
  v_total_itens int;
  v_p record;
  v_score numeric; v_class public.psico_classificacao_risco;
  v_p_id_max_by_fator uuid;
  v_c_principal numeric; v_c_agravamento numeric; v_c_critico numeric;
  v_indice_geral numeric; v_class_geral public.psico_classificacao_risco;
  v_fatores_signif int := 0;
  v_prio_max public.psico_prioridade_fator := 'Monitoramento';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'nao_autenticado' USING ERRCODE='insufficient_privilege'; END IF;
  IF NOT (public.has_role(v_uid,'admin'::app_role) OR public.has_role(v_uid,'tecnico'::app_role)) THEN
    RAISE EXCEPTION 'nao_autorizado' USING ERRCODE='insufficient_privilege';
  END IF;

  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id=p_avaliacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'avaliacao_nao_encontrada'; END IF;
  IF v_av.origem_coleta <> 'importacao_agregada' THEN
    RAISE EXCEPTION 'origem_incompativel — use psico_processar_resultados';
  END IF;
  IF p_confirmacao IS DISTINCT FROM ('PROCESSAR ' || v_av.codigo) THEN
    RAISE EXCEPTION 'Confirmação inválida. Digite: PROCESSAR %', v_av.codigo USING ERRCODE='check_violation';
  END IF;
  IF v_av.status NOT IN ('coleta_encerrada','resultado_pronto') THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE='check_violation';
  END IF;

  SELECT * INTO v_mv FROM public.psico_metodologias_versoes WHERE id=v_av.metodologia_versao_id;
  v_c_principal := COALESCE(v_mv.criterio_principal_percentual, 50);
  v_c_agravamento := COALESCE(v_mv.criterio_agravamento_percentual, 30);
  v_c_critico := COALESCE(v_mv.criterio_critico_percentual, 10);

  SELECT COALESCE(SUM(total_respostas),0)::int, COALESCE(SUM(total_respostas),0)::int
    INTO v_total_itens, v_total_respondentes
    FROM public.psico_dados_agregados_perguntas WHERE avaliacao_id=p_avaliacao_id;
  IF v_total_itens = 0 THEN RAISE EXCEPTION 'sem_dados_agregados'; END IF;

  v_hash := encode(digest(v_av.id::text || '|AGG|' || v_total_itens::text || '|' || v_versao_motor, 'sha256'), 'hex');

  -- Substitui processamento ativo anterior
  UPDATE public.psico_resultado_processamentos
     SET ativo=false, substituido_em=now(), status='substituido'
   WHERE avaliacao_id=p_avaliacao_id AND ativo=true AND status='concluido';

  INSERT INTO public.psico_resultado_processamentos (
    avaliacao_id, questionario_versao_id, metodologia_versao_id,
    versao_motor, status, hash_entrada, total_respondentes, total_itens,
    total_escopos, escopos_funcao_elegiveis, escopos_setor_elegiveis,
    escopos_unidade_elegiveis, escopos_suprimidos, iniciado_por, iniciado_em, ativo
  ) VALUES (
    p_avaliacao_id, v_av.questionario_versao_id, v_av.metodologia_versao_id,
    v_versao_motor, 'processando', v_hash, v_total_respondentes, v_total_itens,
    1, 0, 0, 0, 0, v_uid, now(), false
  ) RETURNING id INTO v_proc_id;

  -- Escopo GERAL único
  INSERT INTO public.psico_resultado_escopos (
    processamento_id, tipo, chave_normalizada, rotulo,
    respondentes, participantes_elegiveis, percentual_participacao,
    minimo_aplicado, total_itens,
    indice_geral_descritivo, classificacao_indice_geral,
    fatores_significativos, prioridade_maxima, amostra_reduzida
  ) VALUES (
    v_proc_id, 'global', NULL, 'Geral',
    v_total_respondentes, NULL, NULL,
    COALESCE(v_mv.minimo_respondentes_global, 2), v_total_itens,
    0, 'Risco Irrelevante', 0, 'Monitoramento', false
  ) RETURNING id INTO v_escopo_id;

  -- Grava resultado por pergunta a partir dos agregados
  INSERT INTO public.psico_resultados_perguntas (
    escopo_id, pergunta_id, fator_id, numero,
    total_respostas_validas, soma_pesos, score_medio, classificacao_media,
    quantidade_nunca, quantidade_raramente, quantidade_as_vezes,
    quantidade_frequentemente, quantidade_sempre,
    percentual_nunca, percentual_raramente, percentual_as_vezes,
    percentual_frequentemente, percentual_sempre,
    quantidade_peso_0, quantidade_peso_1, quantidade_peso_2, quantidade_peso_3, quantidade_peso_4,
    percentual_peso_0, percentual_peso_1, percentual_peso_2, percentual_peso_3, percentual_peso_4,
    percentual_desfavoravel, percentual_alto_critico, percentual_critico
  )
  SELECT
    v_escopo_id, p.id, p.fator_id, p.numero,
    a.total_respostas,
    -- soma_pesos por sentido
    CASE WHEN p.sentido_pontuacao='invertida'
      THEN a.quantidade_nunca*4 + a.quantidade_raramente*3 + a.quantidade_as_vezes*2 + a.quantidade_frequentemente*1 + a.quantidade_sempre*0
      ELSE a.quantidade_nunca*0 + a.quantidade_raramente*1 + a.quantidade_as_vezes*2 + a.quantidade_frequentemente*3 + a.quantidade_sempre*4
    END::numeric AS soma_pesos,
    ROUND(
      (CASE WHEN p.sentido_pontuacao='invertida'
        THEN a.quantidade_nunca*4 + a.quantidade_raramente*3 + a.quantidade_as_vezes*2 + a.quantidade_frequentemente*1 + a.quantidade_sempre*0
        ELSE a.quantidade_nunca*0 + a.quantidade_raramente*1 + a.quantidade_as_vezes*2 + a.quantidade_frequentemente*3 + a.quantidade_sempre*4
      END)::numeric / NULLIF(a.total_respostas,0)
    , 4) AS score_medio,
    public._psico_classificar(
      (CASE WHEN p.sentido_pontuacao='invertida'
        THEN a.quantidade_nunca*4 + a.quantidade_raramente*3 + a.quantidade_as_vezes*2 + a.quantidade_frequentemente*1 + a.quantidade_sempre*0
        ELSE a.quantidade_nunca*0 + a.quantidade_raramente*1 + a.quantidade_as_vezes*2 + a.quantidade_frequentemente*3 + a.quantidade_sempre*4
      END)::numeric / NULLIF(a.total_respostas,0),
      v_mv.faixa_irrelevante_max, v_mv.faixa_baixo_max, v_mv.faixa_medio_max, v_mv.faixa_alto_max
    ),
    a.quantidade_nunca, a.quantidade_raramente, a.quantidade_as_vezes,
    a.quantidade_frequentemente, a.quantidade_sempre,
    ROUND(a.quantidade_nunca*100.0/a.total_respostas,2),
    ROUND(a.quantidade_raramente*100.0/a.total_respostas,2),
    ROUND(a.quantidade_as_vezes*100.0/a.total_respostas,2),
    ROUND(a.quantidade_frequentemente*100.0/a.total_respostas,2),
    ROUND(a.quantidade_sempre*100.0/a.total_respostas,2),
    -- quantidades por peso (0..4) considerando sentido
    CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_sempre ELSE a.quantidade_nunca END,
    CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_frequentemente ELSE a.quantidade_raramente END,
    a.quantidade_as_vezes,
    CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_raramente ELSE a.quantidade_frequentemente END,
    CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_nunca ELSE a.quantidade_sempre END,
    -- percentuais por peso
    ROUND((CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_sempre ELSE a.quantidade_nunca END)*100.0/a.total_respostas,2),
    ROUND((CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_frequentemente ELSE a.quantidade_raramente END)*100.0/a.total_respostas,2),
    ROUND(a.quantidade_as_vezes*100.0/a.total_respostas,2),
    ROUND((CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_raramente ELSE a.quantidade_frequentemente END)*100.0/a.total_respostas,2),
    ROUND((CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_nunca ELSE a.quantidade_sempre END)*100.0/a.total_respostas,2),
    -- percentual desfavoravel = pesos 3+4
    ROUND(((CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_raramente ELSE a.quantidade_frequentemente END)
         + (CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_nunca ELSE a.quantidade_sempre END))*100.0/a.total_respostas,2),
    -- percentual alto_critico = pesos 3+4
    ROUND(((CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_raramente ELSE a.quantidade_frequentemente END)
         + (CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_nunca ELSE a.quantidade_sempre END))*100.0/a.total_respostas,2),
    -- percentual critico = peso 4
    ROUND((CASE WHEN p.sentido_pontuacao='invertida' THEN a.quantidade_nunca ELSE a.quantidade_sempre END)*100.0/a.total_respostas,2)
  FROM public.psico_dados_agregados_perguntas a
  JOIN public.psico_perguntas p ON p.id=a.pergunta_id
  WHERE a.avaliacao_id=p_avaliacao_id;

  -- Agrega por fator
  INSERT INTO public.psico_resultados_fatores (
    escopo_id, fator_id, ordem, quantidade_perguntas, total_respostas_validas, soma_pesos,
    score_medio, classificacao_media,
    quantidade_irrelevante, quantidade_baixo, quantidade_medio, quantidade_alto, quantidade_critico,
    percentual_irrelevante, percentual_baixo, percentual_medio, percentual_alto, percentual_critico,
    percentual_medio_alto_critico, percentual_alto_critico,
    criterio_principal, criterio_agravamento, criterio_critico_automatico,
    criterios_acionados, significativo, prioridade
  )
  SELECT
    v_escopo_id, f.id, f.ordem,
    COUNT(rp.id)::int AS qtd_perguntas,
    SUM(rp.total_respostas_validas)::int,
    SUM(rp.soma_pesos)::numeric,
    ROUND(SUM(rp.soma_pesos)::numeric / NULLIF(SUM(rp.total_respostas_validas),0), 4),
    public._psico_classificar(
      SUM(rp.soma_pesos)::numeric / NULLIF(SUM(rp.total_respostas_validas),0),
      v_mv.faixa_irrelevante_max, v_mv.faixa_baixo_max, v_mv.faixa_medio_max, v_mv.faixa_alto_max
    ),
    SUM(CASE WHEN rp.classificacao_media='Risco Irrelevante' THEN 1 ELSE 0 END)::int,
    SUM(CASE WHEN rp.classificacao_media='Risco Baixo' THEN 1 ELSE 0 END)::int,
    SUM(CASE WHEN rp.classificacao_media='Risco Médio' THEN 1 ELSE 0 END)::int,
    SUM(CASE WHEN rp.classificacao_media='Risco Alto' THEN 1 ELSE 0 END)::int,
    SUM(CASE WHEN rp.classificacao_media='Risco Crítico' THEN 1 ELSE 0 END)::int,
    ROUND(SUM(CASE WHEN rp.classificacao_media='Risco Irrelevante' THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0),2),
    ROUND(SUM(CASE WHEN rp.classificacao_media='Risco Baixo' THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0),2),
    ROUND(SUM(CASE WHEN rp.classificacao_media='Risco Médio' THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0),2),
    ROUND(SUM(CASE WHEN rp.classificacao_media='Risco Alto' THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0),2),
    ROUND(SUM(CASE WHEN rp.classificacao_media='Risco Crítico' THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0),2),
    ROUND(SUM(CASE WHEN rp.classificacao_media IN ('Risco Médio','Risco Alto','Risco Crítico') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0),2),
    ROUND(SUM(CASE WHEN rp.classificacao_media IN ('Risco Alto','Risco Crítico') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0),2),
    (SUM(CASE WHEN rp.classificacao_media IN ('Risco Médio','Risco Alto','Risco Crítico') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0)) >= v_c_principal,
    (SUM(CASE WHEN rp.classificacao_media IN ('Risco Alto','Risco Crítico') THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0)) >= v_c_agravamento,
    (SUM(CASE WHEN rp.classificacao_media='Risco Crítico' THEN 1 ELSE 0 END)*100.0/NULLIF(COUNT(rp.id),0)) >= v_c_critico,
    ARRAY[]::text[],
    false,
    'Monitoramento'::psico_prioridade_fator
  FROM public.psico_fatores f
  LEFT JOIN public.psico_perguntas p ON p.fator_id=f.id AND p.questionario_versao_id=v_av.questionario_versao_id
  LEFT JOIN public.psico_resultados_perguntas rp ON rp.pergunta_id=p.id AND rp.escopo_id=v_escopo_id
  WHERE f.questionario_versao_id=v_av.questionario_versao_id AND f.ativo=true
  GROUP BY f.id, f.ordem
  HAVING COUNT(rp.id) > 0;

  -- Marca critérios acionados e prioridade
  UPDATE public.psico_resultados_fatores rf
     SET criterios_acionados = ARRAY(
           SELECT c FROM (VALUES
             ('principal', rf.criterio_principal),
             ('agravamento', rf.criterio_agravamento),
             ('critico_automatico', rf.criterio_critico_automatico)
           ) AS t(c, ativo) WHERE ativo = true
         ),
         significativo = (rf.criterio_principal OR rf.criterio_agravamento OR rf.criterio_critico_automatico),
         prioridade = CASE
           WHEN rf.criterio_critico_automatico THEN 'Crítica'::psico_prioridade_fator
           WHEN rf.criterio_agravamento THEN 'Alta'::psico_prioridade_fator
           WHEN rf.criterio_principal THEN 'Média'::psico_prioridade_fator
           ELSE 'Monitoramento'::psico_prioridade_fator
         END
   WHERE rf.escopo_id=v_escopo_id;

  -- Índice geral = média dos scores dos fatores
  SELECT ROUND(AVG(score_medio)::numeric, 4),
         COUNT(*) FILTER (WHERE significativo),
         MAX(CASE prioridade
               WHEN 'Crítica' THEN 4 WHEN 'Alta' THEN 3 WHEN 'Média' THEN 2 ELSE 1 END)
    INTO v_indice_geral, v_fatores_signif, v_prio_max
    FROM public.psico_resultados_fatores WHERE escopo_id=v_escopo_id;

  v_class_geral := public._psico_classificar(v_indice_geral,
    v_mv.faixa_irrelevante_max, v_mv.faixa_baixo_max, v_mv.faixa_medio_max, v_mv.faixa_alto_max);

  UPDATE public.psico_resultado_escopos
     SET indice_geral_descritivo = COALESCE(v_indice_geral, 0),
         classificacao_indice_geral = v_class_geral,
         fatores_significativos = COALESCE(v_fatores_signif, 0),
         prioridade_maxima = CASE v_prio_max::int
           WHEN 4 THEN 'Crítica'::psico_prioridade_fator
           WHEN 3 THEN 'Alta'::psico_prioridade_fator
           WHEN 2 THEN 'Média'::psico_prioridade_fator
           ELSE 'Monitoramento'::psico_prioridade_fator
         END
   WHERE id=v_escopo_id;

  UPDATE public.psico_resultado_processamentos
     SET status='concluido', ativo=true, concluido_em=now()
   WHERE id=v_proc_id;

  UPDATE public.psico_avaliacoes
     SET status='resultado_pronto'::psico_avaliacao_status,
         processamento_resultado_ativo_id=v_proc_id,
         resultado_processado_em=now(),
         resultado_processado_por=v_uid,
         versao_motor_resultado=v_versao_motor,
         updated_at=now()
   WHERE id=p_avaliacao_id;

  RETURN jsonb_build_object(
    'ok', true,
    'processamento_id', v_proc_id,
    'versao_motor', v_versao_motor,
    'escopo_id', v_escopo_id,
    'indice_geral', v_indice_geral,
    'classificacao_geral', v_class_geral,
    'fatores_significativos', v_fatores_signif
  );
END;
$$;

-- Helper de classificação (idempotente)
CREATE OR REPLACE FUNCTION public._psico_classificar(
  p_score numeric,
  p_irrel numeric, p_baixo numeric, p_medio numeric, p_alto numeric
)
RETURNS public.psico_classificacao_risco
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_score IS NULL THEN 'Risco Irrelevante'::psico_classificacao_risco
    WHEN p_score <= COALESCE(p_irrel, 0.5) THEN 'Risco Irrelevante'::psico_classificacao_risco
    WHEN p_score <= COALESCE(p_baixo, 1.5) THEN 'Risco Baixo'::psico_classificacao_risco
    WHEN p_score <= COALESCE(p_medio, 2.5) THEN 'Risco Médio'::psico_classificacao_risco
    WHEN p_score <= COALESCE(p_alto, 3.5) THEN 'Risco Alto'::psico_classificacao_risco
    ELSE 'Risco Crítico'::psico_classificacao_risco
  END;
$$;

REVOKE ALL ON FUNCTION public.psico_processar_resultados_agregada(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_processar_resultados_agregada(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public._psico_classificar(numeric,numeric,numeric,numeric,numeric) TO authenticated, service_role;
