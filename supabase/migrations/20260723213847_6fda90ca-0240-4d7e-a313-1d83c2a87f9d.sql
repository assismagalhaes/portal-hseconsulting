
-- PR 4 — Motor determinístico de conciliação individual (v1.0)

-- 1) Extensões em psico_individual_processamentos
ALTER TABLE public.psico_individual_processamentos
  ADD COLUMN IF NOT EXISTS engine_versao text,
  ADD COLUMN IF NOT EXISTS resultado_hash text,
  ADD COLUMN IF NOT EXISTS snapshot_entradas jsonb,
  ADD COLUMN IF NOT EXISTS instrumento_versao_empregado_id uuid,
  ADD COLUMN IF NOT EXISTS instrumento_versao_empregador_id uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS imutavel boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_psico_ind_proc_avaliacao_hash
  ON public.psico_individual_processamentos(avaliacao_id, resultado_hash);

-- 2) Extensões em psico_individual_achados
ALTER TABLE public.psico_individual_achados
  ADD COLUMN IF NOT EXISTS estado_final text,
  ADD COLUMN IF NOT EXISTS estado_original text,
  ADD COLUMN IF NOT EXISTS necessita_acao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS decisao_tecnica text,
  ADD COLUMN IF NOT EXISTS justificativa_alteracao text;

-- 3) Histórico de decisões técnicas por achado
CREATE TABLE IF NOT EXISTS public.psico_individual_achado_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  achado_id uuid NOT NULL REFERENCES public.psico_individual_achados(id) ON DELETE CASCADE,
  alterado_por uuid,
  estado_anterior text,
  estado_novo text NOT NULL,
  justificativa text NOT NULL,
  regra_codigo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.psico_individual_achado_historico TO authenticated;
GRANT ALL ON public.psico_individual_achado_historico TO service_role;
ALTER TABLE public.psico_individual_achado_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hse le achado historico" ON public.psico_individual_achado_historico;
CREATE POLICY "hse le achado historico"
  ON public.psico_individual_achado_historico FOR SELECT
  USING (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "hse insere achado historico" ON public.psico_individual_achado_historico;
CREATE POLICY "hse insere achado historico"
  ON public.psico_individual_achado_historico FOR INSERT
  WITH CHECK (public.can_see_internal(auth.uid()));

-- 4) RPC — leitor de entradas estruturadas (SEM texto livre) para o motor
CREATE OR REPLACE FUNCTION public.psico_ind_ler_entradas_para_motor(p_avaliacao uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v jsonb;
  v_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF v_role <> 'service_role' AND NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT jsonb_build_object(
    'avaliacao_id', p_avaliacao,
    'formulario_empregado', (
      SELECT jsonb_build_object('id', id, 'instrumento_versao_id', instrumento_versao_id, 'concluido_em', concluido_em)
      FROM psico_individual_formularios
      WHERE avaliacao_id = p_avaliacao AND papel='empregado' AND concluido_em IS NOT NULL
      ORDER BY concluido_em DESC LIMIT 1
    ),
    'formulario_empregador', (
      SELECT jsonb_build_object('id', id, 'instrumento_versao_id', instrumento_versao_id, 'concluido_em', concluido_em)
      FROM psico_individual_formularios
      WHERE avaliacao_id = p_avaliacao AND papel='empregador' AND concluido_em IS NOT NULL
      ORDER BY concluido_em DESC LIMIT 1
    ),
    'respostas_empregado', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'pergunta_id', r.pergunta_id,
        'fator', pg.fator_codigo,
        'chave', pg.chave_pareamento,
        'periodo', pg.periodo_referencia,
        'valor', r.valor_numerico,
        'significa_exposicao', op.significa_exposicao
      ) ORDER BY pg.fator_codigo, pg.ordem)
      FROM psico_individual_respostas r
      JOIN psico_individual_formularios f ON f.id = r.formulario_id
      JOIN psico_individual_perguntas pg ON pg.id = r.pergunta_id
      LEFT JOIN psico_individual_opcoes op ON op.id = r.opcao_id
      WHERE f.avaliacao_id = p_avaliacao AND f.papel = 'empregado' AND f.concluido_em IS NOT NULL
        AND pg.tipo = 'escala'
    ), '[]'::jsonb),
    'respostas_empregador', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'pergunta_id', r.pergunta_id,
        'fator', pg.fator_codigo,
        'chave', pg.chave_pareamento,
        'periodo', pg.periodo_referencia,
        'valor', r.valor_numerico,
        'significa_exposicao', op.significa_exposicao
      ) ORDER BY pg.fator_codigo, pg.ordem)
      FROM psico_individual_respostas r
      JOIN psico_individual_formularios f ON f.id = r.formulario_id
      JOIN psico_individual_perguntas pg ON pg.id = r.pergunta_id
      LEFT JOIN psico_individual_opcoes op ON op.id = r.opcao_id
      WHERE f.avaliacao_id = p_avaliacao AND f.papel = 'empregador' AND f.concluido_em IS NOT NULL
        AND pg.tipo = 'escala'
    ), '[]'::jsonb)
  ) INTO v;
  RETURN v;
END $$;

REVOKE ALL ON FUNCTION public.psico_ind_ler_entradas_para_motor(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_ler_entradas_para_motor(uuid) TO service_role, authenticated;

-- 5) RPC — persistir processamento com achados
CREATE OR REPLACE FUNCTION public.psico_ind_persistir_processamento(
  p_avaliacao uuid,
  p_engine_versao text,
  p_versao_regra text,
  p_hash text,
  p_snapshot jsonb,
  p_achados jsonb,
  p_instrumento_emp uuid,
  p_instrumento_rep uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_proc uuid;
  v_prev uuid;
BEGIN
  IF coalesce(auth.jwt() ->> 'role', '') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- idempotência: mesmo hash e não-imutável → reaproveita
  SELECT id INTO v_prev
    FROM psico_individual_processamentos
   WHERE avaliacao_id = p_avaliacao
     AND resultado_hash = p_hash
     AND imutavel = false
   ORDER BY created_at DESC LIMIT 1;
  IF v_prev IS NOT NULL THEN RETURN v_prev; END IF;

  IF EXISTS (SELECT 1 FROM psico_individual_processamentos
             WHERE avaliacao_id = p_avaliacao AND imutavel = true) THEN
    RAISE EXCEPTION 'processamento_imutavel';
  END IF;

  INSERT INTO psico_individual_processamentos(
    avaliacao_id, engine_versao, versao_regra, resultado_hash,
    snapshot_entradas, status, iniciado_em, concluido_em,
    instrumento_versao_empregado_id, instrumento_versao_empregador_id
  ) VALUES (
    p_avaliacao, p_engine_versao, p_versao_regra, p_hash,
    p_snapshot, 'concluido', now(), now(),
    p_instrumento_emp, p_instrumento_rep
  ) RETURNING id INTO v_proc;

  -- substitui achados dos processamentos anteriores não imutáveis
  DELETE FROM psico_individual_achados a
   USING psico_individual_processamentos p
   WHERE a.processamento_id = p.id
     AND p.avaliacao_id = p_avaliacao
     AND p.imutavel = false
     AND p.id <> v_proc;

  INSERT INTO psico_individual_achados(
    avaliacao_id, processamento_id, fator_codigo, perigo_codigo,
    descricao_organizacional, frequencia_exposicao, intensidade_exigencia,
    controle_existente, eficacia_controle, condicao_preliminar, nivel_evidencia,
    estado_convergencia, fundamentacao_sanitizada, regra_codigo, regra_versao,
    estado_final, estado_original, necessita_acao
  )
  SELECT
    p_avaliacao, v_proc,
    a->>'fator_codigo', a->>'perigo_codigo', a->>'descricao_organizacional',
    a->>'frequencia_exposicao', a->>'intensidade_exigencia',
    a->>'controle_existente', a->>'eficacia_controle',
    a->>'condicao_preliminar', a->>'nivel_evidencia',
    a->>'estado_convergencia', a->>'fundamentacao_sanitizada',
    a->>'regra_codigo', a->>'regra_versao',
    a->>'estado_final', a->>'estado_final',
    coalesce((a->>'necessita_acao')::boolean, false)
  FROM jsonb_array_elements(p_achados) a;

  RETURN v_proc;
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_persistir_processamento(uuid,text,text,text,jsonb,jsonb,uuid,uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_ind_persistir_processamento(uuid,text,text,text,jsonb,jsonb,uuid,uuid) TO service_role;

-- 6) RPC — alterar classificação com justificativa e histórico
CREATE OR REPLACE FUNCTION public.psico_ind_alterar_classificacao(
  p_achado uuid,
  p_novo_estado text,
  p_justificativa text
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_estado_anterior text;
  v_regra text;
  v_imutavel boolean;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  IF coalesce(btrim(p_justificativa), '') = '' THEN RAISE EXCEPTION 'justificativa_obrigatoria'; END IF;
  IF p_novo_estado NOT IN ('controlado','atencao_preventiva','requer_intervencao','prioritario','divergente','evidencia_insuficiente','nao_aplicavel') THEN
    RAISE EXCEPTION 'estado_invalido';
  END IF;

  SELECT a.estado_final, a.regra_codigo, p.imutavel
    INTO v_estado_anterior, v_regra, v_imutavel
    FROM psico_individual_achados a
    JOIN psico_individual_processamentos p ON p.id = a.processamento_id
   WHERE a.id = p_achado;
  IF NOT FOUND THEN RAISE EXCEPTION 'achado_nao_encontrado'; END IF;
  IF v_imutavel THEN RAISE EXCEPTION 'processamento_imutavel'; END IF;

  INSERT INTO psico_individual_achado_historico(
    achado_id, alterado_por, estado_anterior, estado_novo, justificativa, regra_codigo
  ) VALUES (
    p_achado, auth.uid(), v_estado_anterior, p_novo_estado, p_justificativa, v_regra
  );

  UPDATE psico_individual_achados
     SET estado_final = p_novo_estado,
         decisao_tecnica = p_novo_estado,
         justificativa_alteracao = p_justificativa,
         revisado_por = auth.uid(),
         revisado_em = now(),
         updated_at = now()
   WHERE id = p_achado;
END $$;
GRANT EXECUTE ON FUNCTION public.psico_ind_alterar_classificacao(uuid, text, text) TO authenticated;

-- 7) RPC — aprovar e tornar imutável
CREATE OR REPLACE FUNCTION public.psico_ind_aprovar_processamento(p_processamento uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  UPDATE psico_individual_processamentos
     SET imutavel = true,
         aprovado_por = auth.uid(),
         aprovado_em = now(),
         updated_at = now()
   WHERE id = p_processamento AND imutavel = false;
END $$;
GRANT EXECUTE ON FUNCTION public.psico_ind_aprovar_processamento(uuid) TO authenticated;

-- 8) RPC — leitura de achados (visão interna, sem texto livre)
CREATE OR REPLACE FUNCTION public.psico_ind_listar_achados(p_avaliacao uuid)
RETURNS TABLE (
  id uuid, processamento_id uuid, fator_codigo text,
  frequencia_exposicao text, intensidade_exigencia text,
  controle_existente text, eficacia_controle text,
  condicao_preliminar text, nivel_evidencia text,
  estado_convergencia text, fundamentacao_sanitizada text,
  regra_codigo text, regra_versao text,
  estado_final text, estado_original text,
  necessita_acao boolean, justificativa_alteracao text,
  revisado_por uuid, revisado_em timestamptz, imutavel boolean
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.id, a.processamento_id, a.fator_codigo,
         a.frequencia_exposicao, a.intensidade_exigencia,
         a.controle_existente, a.eficacia_controle,
         a.condicao_preliminar, a.nivel_evidencia,
         a.estado_convergencia, a.fundamentacao_sanitizada,
         a.regra_codigo, a.regra_versao,
         a.estado_final, a.estado_original,
         a.necessita_acao, a.justificativa_alteracao,
         a.revisado_por, a.revisado_em, p.imutavel
    FROM psico_individual_achados a
    JOIN psico_individual_processamentos p ON p.id = a.processamento_id
   WHERE a.avaliacao_id = p_avaliacao
     AND public.can_see_internal(auth.uid())
   ORDER BY a.fator_codigo;
$$;
GRANT EXECUTE ON FUNCTION public.psico_ind_listar_achados(uuid) TO authenticated;
