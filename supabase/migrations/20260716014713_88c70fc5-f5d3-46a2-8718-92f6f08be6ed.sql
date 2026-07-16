
-- ============================================================================
-- FASE 9 — BLOCO 2: RPCs de Backend do Modo Bruto
-- ============================================================================

-- Helper: exige admin ou técnico
CREATE OR REPLACE FUNCTION public._psico_require_admin_tec()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'tecnico'::app_role)) THEN
    RAISE EXCEPTION 'forbidden' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ============================================================================
-- 1. INICIAR IMPORTAÇÃO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_importacao_iniciar(
  p_cliente_id uuid,
  p_tipo public.psico_importacao_tipo,
  p_formato public.psico_importacao_formato,
  p_nome_arquivo text,
  p_hash_sha256 text,
  p_tamanho_bytes bigint,
  p_questionario_versao_id uuid,
  p_metodologia_versao_id uuid,
  p_arquivo_path text,
  p_idempotency_key text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_existing uuid;
BEGIN
  PERFORM public._psico_require_admin_tec();

  IF p_hash_sha256 IS NULL OR length(p_hash_sha256) <> 64 THEN
    RAISE EXCEPTION 'hash_invalido' USING ERRCODE = '22023';
  END IF;
  IF p_tamanho_bytes IS NULL OR p_tamanho_bytes <= 0 OR p_tamanho_bytes > 25 * 1024 * 1024 THEN
    RAISE EXCEPTION 'tamanho_invalido' USING ERRCODE = '22023';
  END IF;

  -- Idempotência: se a mesma chave já existir, retorna o id
  SELECT id INTO v_existing
    FROM public.psico_importacoes_avaliacoes
   WHERE idempotency_key = p_idempotency_key;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  -- Bloqueia reimportação idêntica já concluída
  SELECT id INTO v_existing
    FROM public.psico_importacoes_avaliacoes
   WHERE cliente_id = p_cliente_id
     AND tipo = p_tipo
     AND questionario_versao_id = p_questionario_versao_id
     AND hash_arquivo_sha256 = p_hash_sha256
     AND status IN ('concluida','concluida_com_avisos');
  IF v_existing IS NOT NULL THEN
    RAISE EXCEPTION 'arquivo_ja_importado' USING ERRCODE = '23505';
  END IF;

  INSERT INTO public.psico_importacoes_avaliacoes (
    cliente_id, tipo, formato, status, nome_arquivo, hash_arquivo_sha256,
    tamanho_bytes, questionario_versao_id, metodologia_versao_id,
    arquivo_temporario_path, idempotency_key, iniciado_por
  ) VALUES (
    p_cliente_id, p_tipo, p_formato, 'arquivo_recebido', p_nome_arquivo, p_hash_sha256,
    p_tamanho_bytes, p_questionario_versao_id, p_metodologia_versao_id,
    p_arquivo_path, p_idempotency_key, auth.uid()
  ) RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ============================================================================
-- 2. SALVAR MAPEAMENTO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_importacao_salvar_mapeamento(
  p_importacao_id uuid,
  p_mapeamento jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._psico_require_admin_tec();
  UPDATE public.psico_importacoes_avaliacoes
     SET mapeamento_colunas = COALESCE(p_mapeamento, '{}'::jsonb),
         status = CASE WHEN status IN ('arquivo_recebido','mapeamento') THEN 'mapeamento'::psico_importacao_status ELSE status END,
         updated_at = now()
   WHERE id = p_importacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'importacao_nao_encontrada' USING ERRCODE='P0002'; END IF;
END;
$$;

-- ============================================================================
-- 3. INGERIR LOTE DE STAGING (chamado pela edge function após parse+sanitização)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_importacao_ingerir_staging_bruta(
  p_importacao_id uuid,
  p_linhas jsonb  -- array [{data_resposta, funcao, setor, unidade, respostas: {numero: 'opcao'} }, ...]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer := 0;
  v_imp record;
BEGIN
  PERFORM public._psico_require_admin_tec();
  SELECT * INTO v_imp FROM public.psico_importacoes_avaliacoes WHERE id = p_importacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'importacao_nao_encontrada'; END IF;
  IF v_imp.tipo <> 'bruta_respondentes' THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF v_imp.status NOT IN ('mapeamento','validando') THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE='55000';
  END IF;

  UPDATE public.psico_importacoes_avaliacoes
     SET status='validando', updated_at=now()
   WHERE id=p_importacao_id AND status='mapeamento';

  INSERT INTO public.psico_importacao_staging_respostas
    (importacao_id, data_resposta, funcao, setor, unidade,
     funcao_normalizada, setor_normalizado, unidade_normalizada, respostas_normalizadas)
  SELECT
    p_importacao_id,
    NULLIF(x->>'data_resposta','')::date,
    NULLIF(x->>'funcao',''),
    NULLIF(x->>'setor',''),
    NULLIF(x->>'unidade',''),
    NULLIF(x->>'funcao_normalizada',''),
    NULLIF(x->>'setor_normalizado',''),
    NULLIF(x->>'unidade_normalizada',''),
    COALESCE(x->'respostas', '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p_linhas,'[]'::jsonb)) x;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 4. REGISTRAR ERROS / AVISOS
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_importacao_registrar_erros(
  p_importacao_id uuid,
  p_erros jsonb  -- [{numero_linha, codigo, campo, severidade, mensagem}]
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_count integer := 0;
BEGIN
  PERFORM public._psico_require_admin_tec();
  INSERT INTO public.psico_importacoes_erros
    (importacao_id, numero_linha, codigo, campo, severidade, mensagem)
  SELECT
    p_importacao_id,
    NULLIF(x->>'numero_linha','')::int,
    COALESCE(x->>'codigo','desconhecido'),
    NULLIF(x->>'campo',''),
    COALESCE((x->>'severidade')::psico_importacao_severidade, 'erro'),
    NULLIF(x->>'mensagem','')
  FROM jsonb_array_elements(COALESCE(p_erros,'[]'::jsonb)) x;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- ============================================================================
-- 5. FINALIZAR VALIDAÇÃO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_importacao_finalizar_validacao(
  p_importacao_id uuid,
  p_total_linhas integer,
  p_linhas_validas integer,
  p_linhas_invalidas integer,
  p_linhas_ignoradas integer,
  p_data_min date,
  p_data_max date,
  p_resumo jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_novo_status public.psico_importacao_status;
BEGIN
  PERFORM public._psico_require_admin_tec();
  v_novo_status := CASE WHEN p_linhas_validas > 0 THEN 'pronto_para_importar' ELSE 'falhou' END;
  UPDATE public.psico_importacoes_avaliacoes
     SET total_linhas=p_total_linhas,
         linhas_validas=p_linhas_validas,
         linhas_invalidas=p_linhas_invalidas,
         linhas_ignoradas=p_linhas_ignoradas,
         data_resposta_minima=p_data_min,
         data_resposta_maxima=p_data_max,
         resumo_validacao=COALESCE(p_resumo,'{}'::jsonb),
         status=v_novo_status,
         updated_at=now()
   WHERE id=p_importacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'importacao_nao_encontrada'; END IF;
END;
$$;

-- ============================================================================
-- 6. COMMIT — Modo Bruto
-- Cria (ou reutiliza) a avaliação histórica marcada como importada e
-- transfere staging → psico_respostas + psico_respostas_itens.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_importacao_commit_bruta(
  p_importacao_id uuid,
  p_avaliacao jsonb  -- {avaliacao_id?, titulo, unidade, data_inicio, data_fim, observacao_origem, cancelar_staging}
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_imp record;
  v_aval_id uuid;
  v_stg record;
  v_resposta_id uuid;
  v_num integer;
  v_opcao text;
  v_pergunta_id uuid;
  v_opcao_id uuid;
  v_qtd_itens integer;
  v_respondentes integer := 0;
  v_total_itens integer := 0;
  v_avisos jsonb := '[]'::jsonb;
BEGIN
  PERFORM public._psico_require_admin_tec();

  SELECT * INTO v_imp FROM public.psico_importacoes_avaliacoes WHERE id=p_importacao_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'importacao_nao_encontrada'; END IF;
  IF v_imp.tipo <> 'bruta_respondentes' THEN RAISE EXCEPTION 'tipo_invalido'; END IF;
  IF v_imp.status <> 'pronto_para_importar' THEN
    RAISE EXCEPTION 'status_invalido' USING ERRCODE='55000';
  END IF;

  UPDATE public.psico_importacoes_avaliacoes SET status='importando', updated_at=now() WHERE id=p_importacao_id;

  -- Cria ou reutiliza avaliação
  IF (p_avaliacao ? 'avaliacao_id') AND NULLIF(p_avaliacao->>'avaliacao_id','') IS NOT NULL THEN
    v_aval_id := (p_avaliacao->>'avaliacao_id')::uuid;
    UPDATE public.psico_avaliacoes
       SET origem_coleta = CASE WHEN origem_coleta='portal' THEN 'importacao_bruta'::psico_origem_coleta ELSE origem_coleta END,
           importacao_avaliacao_id = p_importacao_id,
           importado_em = COALESCE(importado_em, now()),
           importado_por = COALESCE(importado_por, auth.uid()),
           observacao_origem = COALESCE(p_avaliacao->>'observacao_origem', observacao_origem),
           updated_at = now()
     WHERE id = v_aval_id AND cliente_id = v_imp.cliente_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'avaliacao_incompativel' USING ERRCODE='23514'; END IF;
  ELSE
    INSERT INTO public.psico_avaliacoes (
      codigo, cliente_id, metodologia_versao_id, questionario_versao_id,
      titulo, unidade, data_inicio_prevista, data_fim_prevista, status,
      origem_coleta, importacao_avaliacao_id, importado_em, importado_por,
      observacao_origem, criado_por, atualizado_por,
      coleta_encerrada_em, motivo_encerramento
    ) VALUES (
      'IMP-' || substr(encode(gen_random_bytes(6),'hex'),1,10),
      v_imp.cliente_id, v_imp.metodologia_versao_id, v_imp.questionario_versao_id,
      COALESCE(p_avaliacao->>'titulo','Avaliação histórica importada'),
      NULLIF(p_avaliacao->>'unidade',''),
      NULLIF(p_avaliacao->>'data_inicio','')::date,
      NULLIF(p_avaliacao->>'data_fim','')::date,
      'coleta_encerrada'::psico_avaliacao_status,
      'importacao_bruta'::psico_origem_coleta,
      p_importacao_id, now(), auth.uid(),
      NULLIF(p_avaliacao->>'observacao_origem',''),
      auth.uid(), auth.uid(),
      now(), 'Importação histórica'
    ) RETURNING id INTO v_aval_id;
  END IF;

  UPDATE public.psico_importacoes_avaliacoes SET avaliacao_id=v_aval_id, updated_at=now() WHERE id=p_importacao_id;

  -- Percorre staging e cria respostas
  FOR v_stg IN
    SELECT * FROM public.psico_importacao_staging_respostas WHERE importacao_id=p_importacao_id ORDER BY criado_em
  LOOP
    v_qtd_itens := 0;

    INSERT INTO public.psico_respostas (
      avaliacao_id, questionario_versao_id, metodologia_versao_id,
      funcao, setor, unidade, funcao_normalizada, setor_normalizado, unidade_normalizada,
      data_resposta, quantidade_itens, origem_registro, importacao_id
    ) VALUES (
      v_aval_id, v_imp.questionario_versao_id, v_imp.metodologia_versao_id,
      v_stg.funcao, v_stg.setor, v_stg.unidade,
      v_stg.funcao_normalizada, v_stg.setor_normalizado, v_stg.unidade_normalizada,
      COALESCE(v_stg.data_resposta, CURRENT_DATE),
      0, 'importacao_bruta'::psico_resposta_origem, p_importacao_id
    ) RETURNING id INTO v_resposta_id;

    -- Itera respostas {numero: opcao}
    FOR v_num, v_opcao IN
      SELECT (key)::int, (value #>> '{}')::text
        FROM jsonb_each(v_stg.respostas_normalizadas)
    LOOP
      SELECT id INTO v_pergunta_id
        FROM public.psico_perguntas
       WHERE questionario_versao_id = v_imp.questionario_versao_id
         AND numero = v_num
       LIMIT 1;
      IF v_pergunta_id IS NULL THEN CONTINUE; END IF;

      SELECT id INTO v_opcao_id
        FROM public.psico_opcoes_resposta
       WHERE metodologia_versao_id = v_imp.metodologia_versao_id
         AND chave = v_opcao
       LIMIT 1;
      IF v_opcao_id IS NULL THEN CONTINUE; END IF;

      INSERT INTO public.psico_respostas_itens (resposta_id, pergunta_id, opcao_resposta_id)
      VALUES (v_resposta_id, v_pergunta_id, v_opcao_id);
      v_qtd_itens := v_qtd_itens + 1;
    END LOOP;

    UPDATE public.psico_respostas SET quantidade_itens=v_qtd_itens WHERE id=v_resposta_id;
    v_respondentes := v_respondentes + 1;
    v_total_itens := v_total_itens + v_qtd_itens;
  END LOOP;

  -- Limpa staging (nunca persistir dados sensíveis além do necessário)
  DELETE FROM public.psico_importacao_staging_respostas WHERE importacao_id=p_importacao_id;

  UPDATE public.psico_importacoes_avaliacoes
     SET status = CASE WHEN v_respondentes > 0 THEN 'concluida'::psico_importacao_status ELSE 'falhou'::psico_importacao_status END,
         respondentes_importados = v_respondentes,
         total_itens_importados = v_total_itens,
         concluido_em = now(),
         updated_at = now()
   WHERE id = p_importacao_id;

  RETURN jsonb_build_object(
    'avaliacao_id', v_aval_id,
    'respondentes_importados', v_respondentes,
    'total_itens_importados', v_total_itens
  );
END;
$$;

-- ============================================================================
-- 7. CANCELAR IMPORTAÇÃO (limpa staging)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_importacao_cancelar(
  p_importacao_id uuid,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._psico_require_admin_tec();
  UPDATE public.psico_importacoes_avaliacoes
     SET status='cancelada', cancelado_em=now(), erro_codigo=NULLIF(p_motivo,''), updated_at=now()
   WHERE id=p_importacao_id
     AND status NOT IN ('concluida','concluida_com_avisos');
  DELETE FROM public.psico_importacao_staging_respostas WHERE importacao_id=p_importacao_id;
END;
$$;

-- ============================================================================
-- 8. MARCAR ARQUIVO PURGADO
-- ============================================================================
CREATE OR REPLACE FUNCTION public.psico_importacao_purgar_arquivo(
  p_importacao_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._psico_require_admin_tec();
  UPDATE public.psico_importacoes_avaliacoes
     SET arquivo_excluido_em=now(), arquivo_temporario_path=NULL, updated_at=now()
   WHERE id=p_importacao_id;
END;
$$;

-- ============================================================================
-- GRANTS de execução
-- ============================================================================
REVOKE ALL ON FUNCTION public.psico_importacao_iniciar(uuid,psico_importacao_tipo,psico_importacao_formato,text,text,bigint,uuid,uuid,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_importacao_salvar_mapeamento(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_importacao_ingerir_staging_bruta(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_importacao_registrar_erros(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_importacao_finalizar_validacao(uuid,integer,integer,integer,integer,date,date,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_importacao_commit_bruta(uuid,jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_importacao_cancelar(uuid,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_importacao_purgar_arquivo(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.psico_importacao_iniciar(uuid,psico_importacao_tipo,psico_importacao_formato,text,text,bigint,uuid,uuid,text,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.psico_importacao_salvar_mapeamento(uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.psico_importacao_ingerir_staging_bruta(uuid,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.psico_importacao_registrar_erros(uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.psico_importacao_finalizar_validacao(uuid,integer,integer,integer,integer,date,date,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.psico_importacao_commit_bruta(uuid,jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.psico_importacao_cancelar(uuid,text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.psico_importacao_purgar_arquivo(uuid) TO authenticated, service_role;
