
-- =====================================================================
-- PR 5 — Plano de ação individual + auditoria de sugestões de IA
-- =====================================================================

-- 1) Plano de ação individual (itens vinculados a achados individuais)
CREATE TABLE IF NOT EXISTS public.psico_ind_plano_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  achado_id uuid NOT NULL REFERENCES public.psico_individual_achados(id) ON DELETE CASCADE,
  perigo_codigo text,
  fator_codigo text NOT NULL,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','catalogo','ia')),
  medida_modelo_id uuid REFERENCES public.psico_medidas_modelos(id),
  titulo text NOT NULL,
  objetivo text NOT NULL,
  acao_recomendada text NOT NULL,
  responsavel_sugerido text,
  responsavel_definido text,
  prazo_sugerido_dias integer,
  prazo_definido date,
  evidencia_recomendada text,
  evidencia_definida text,
  indicador_eficacia text,
  justificativa text,
  nivel_recomendacao text,
  ordem integer NOT NULL DEFAULT 100,
  aprovado boolean NOT NULL DEFAULT false,
  aprovado_em timestamptz,
  aprovado_por uuid,
  imutavel boolean NOT NULL DEFAULT false,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.psico_ind_plano_itens TO authenticated;
GRANT ALL ON public.psico_ind_plano_itens TO service_role;
ALTER TABLE public.psico_ind_plano_itens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ind_plano_itens_interno_leitura"
  ON public.psico_ind_plano_itens FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));

CREATE POLICY "ind_plano_itens_interno_escrita"
  ON public.psico_ind_plano_itens FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()) AND imutavel = false)
  WITH CHECK (public.can_see_internal(auth.uid()));

CREATE INDEX IF NOT EXISTS idx_ind_plano_itens_aval ON public.psico_ind_plano_itens(avaliacao_id);
CREATE INDEX IF NOT EXISTS idx_ind_plano_itens_achado ON public.psico_ind_plano_itens(achado_id);

CREATE OR REPLACE FUNCTION public.psico_ind_plano_itens_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ind_plano_itens_touch
  BEFORE UPDATE ON public.psico_ind_plano_itens
  FOR EACH ROW EXECUTE FUNCTION public.psico_ind_plano_itens_touch();

-- Trava alterações depois de aprovado (imutabilidade)
CREATE OR REPLACE FUNCTION public.psico_ind_plano_itens_bloq_imut()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.imutavel = true THEN
    RAISE EXCEPTION 'item_plano_imutavel';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ind_plano_itens_bloq_imut
  BEFORE UPDATE OR DELETE ON public.psico_ind_plano_itens
  FOR EACH ROW EXECUTE FUNCTION public.psico_ind_plano_itens_bloq_imut();

-- 2) Auditoria de sugestões de IA
CREATE TABLE IF NOT EXISTS public.psico_ind_sugestoes_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  avaliacao_id uuid NOT NULL REFERENCES public.psico_avaliacoes(id) ON DELETE CASCADE,
  processamento_id uuid REFERENCES public.psico_individual_processamentos(id) ON DELETE SET NULL,
  modelo text NOT NULL,
  prompt_versao text NOT NULL,
  prompt_sistema text NOT NULL,
  prompt_usuario text NOT NULL,
  resposta_bruta jsonb,
  sugestoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  rejeitadas jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL CHECK (status IN ('ok','falha_ia','falha_schema','falha_gate')),
  erro text,
  criado_por uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.psico_ind_sugestoes_ia TO authenticated;
GRANT ALL ON public.psico_ind_sugestoes_ia TO service_role;
ALTER TABLE public.psico_ind_sugestoes_ia ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ind_sug_ia_interno_leitura"
  ON public.psico_ind_sugestoes_ia FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));

-- Insert só via service_role (edge function), então não criamos policy de INSERT para authenticated.
CREATE INDEX IF NOT EXISTS idx_ind_sug_ia_aval ON public.psico_ind_sugestoes_ia(avaliacao_id, created_at DESC);

-- 3) RPC: listar plano individual completo
CREATE OR REPLACE FUNCTION public.psico_ind_plano_listar(p_avaliacao uuid)
RETURNS TABLE (
  id uuid, avaliacao_id uuid, achado_id uuid,
  perigo_codigo text, fator_codigo text, origem text,
  medida_modelo_id uuid, titulo text, objetivo text, acao_recomendada text,
  responsavel_sugerido text, responsavel_definido text,
  prazo_sugerido_dias integer, prazo_definido date,
  evidencia_recomendada text, evidencia_definida text,
  indicador_eficacia text, justificativa text,
  nivel_recomendacao text, ordem integer,
  aprovado boolean, aprovado_em timestamptz, aprovado_por uuid,
  imutavel boolean, created_at timestamptz, updated_at timestamptz,
  achado_estado text, achado_necessita_acao boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    i.id, i.avaliacao_id, i.achado_id,
    i.perigo_codigo, i.fator_codigo, i.origem,
    i.medida_modelo_id, i.titulo, i.objetivo, i.acao_recomendada,
    i.responsavel_sugerido, i.responsavel_definido,
    i.prazo_sugerido_dias, i.prazo_definido,
    i.evidencia_recomendada, i.evidencia_definida,
    i.indicador_eficacia, i.justificativa,
    i.nivel_recomendacao, i.ordem,
    i.aprovado, i.aprovado_em, i.aprovado_por,
    i.imutavel, i.created_at, i.updated_at,
    a.estado_final, a.necessita_acao
  FROM public.psico_ind_plano_itens i
  JOIN public.psico_individual_achados a ON a.id = i.achado_id
  WHERE i.avaliacao_id = p_avaliacao
    AND public.can_see_internal(auth.uid())
  ORDER BY i.fator_codigo, i.ordem, i.created_at;
$$;
REVOKE ALL ON FUNCTION public.psico_ind_plano_listar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_plano_listar(uuid) TO authenticated, service_role;

-- 4) RPC: verificar gates de aprovação (todo achado com necessita_acao=true precisa de ao menos 1 item)
CREATE OR REPLACE FUNCTION public.psico_ind_plano_gates(p_avaliacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pendentes jsonb;
  v_prio jsonb;
  v_faltando_campos jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'achado_id', a.id, 'fator_codigo', a.fator_codigo, 'estado_final', a.estado_final)), '[]'::jsonb)
    INTO v_pendentes
    FROM public.psico_individual_achados a
   WHERE a.avaliacao_id = p_avaliacao
     AND a.necessita_acao = true
     AND NOT EXISTS (
       SELECT 1 FROM public.psico_ind_plano_itens i
        WHERE i.avaliacao_id = p_avaliacao AND i.achado_id = a.id
     );

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'achado_id', a.id, 'fator_codigo', a.fator_codigo)), '[]'::jsonb)
    INTO v_prio
    FROM public.psico_individual_achados a
   WHERE a.avaliacao_id = p_avaliacao
     AND a.estado_final = 'prioritario'
     AND NOT EXISTS (
       SELECT 1 FROM public.psico_ind_plano_itens i
        WHERE i.avaliacao_id = p_avaliacao AND i.achado_id = a.id
     );

  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'item_id', i.id, 'titulo', i.titulo,
           'faltando', ARRAY_REMOVE(ARRAY[
             CASE WHEN coalesce(btrim(coalesce(i.responsavel_definido, i.responsavel_sugerido, '')), '') = '' THEN 'responsavel' END,
             CASE WHEN i.prazo_definido IS NULL AND coalesce(i.prazo_sugerido_dias, 0) <= 0 THEN 'prazo' END,
             CASE WHEN coalesce(btrim(coalesce(i.evidencia_definida, i.evidencia_recomendada, '')), '') = '' THEN 'evidencia' END
           ], NULL))), '[]'::jsonb)
    INTO v_faltando_campos
    FROM public.psico_ind_plano_itens i
   WHERE i.avaliacao_id = p_avaliacao
     AND (
       coalesce(btrim(coalesce(i.responsavel_definido, i.responsavel_sugerido, '')), '') = ''
       OR (i.prazo_definido IS NULL AND coalesce(i.prazo_sugerido_dias, 0) <= 0)
       OR coalesce(btrim(coalesce(i.evidencia_definida, i.evidencia_recomendada, '')), '') = ''
     );

  RETURN jsonb_build_object(
    'achados_sem_acao', v_pendentes,
    'prioritarios_sem_acao', v_prio,
    'itens_incompletos', v_faltando_campos,
    'pronto_para_aprovacao',
      (jsonb_array_length(v_pendentes) = 0
       AND jsonb_array_length(v_prio) = 0
       AND jsonb_array_length(v_faltando_campos) = 0)
  );
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_plano_gates(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_plano_gates(uuid) TO authenticated, service_role;

-- 5) RPC: aprovar plano (torna todos os itens imutáveis)
CREATE OR REPLACE FUNCTION public.psico_ind_plano_aprovar(p_avaliacao uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_gates jsonb;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN RAISE EXCEPTION 'forbidden'; END IF;
  v_gates := public.psico_ind_plano_gates(p_avaliacao);
  IF NOT coalesce((v_gates->>'pronto_para_aprovacao')::boolean, false) THEN
    RAISE EXCEPTION 'gates_nao_atendidos: %', v_gates::text;
  END IF;
  UPDATE public.psico_ind_plano_itens
     SET aprovado = true,
         aprovado_em = coalesce(aprovado_em, now()),
         aprovado_por = coalesce(aprovado_por, auth.uid())
   WHERE avaliacao_id = p_avaliacao;
  -- somente após aprovar tudo, aplicamos imutabilidade
  UPDATE public.psico_ind_plano_itens
     SET imutavel = true
   WHERE avaliacao_id = p_avaliacao;
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_plano_aprovar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_plano_aprovar(uuid) TO authenticated, service_role;

-- 6) RPC: contexto sanitizado para IA (chamada apenas pelo service_role)
CREATE OR REPLACE FUNCTION public.psico_ind_contexto_para_ia(p_avaliacao uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_out jsonb;
BEGIN
  IF coalesce(auth.jwt() ->> 'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  SELECT jsonb_build_object(
    'avaliacao', jsonb_build_object(
      'id', av.id, 'codigo', av.codigo, 'titulo', av.titulo,
      'modalidade', av.modalidade, 'unidade', av.unidade
    ),
    'empresa', jsonb_build_object(
      'porte', c.porte,
      'atividade', coalesce(c.atividade_principal, c.ramo_atividade)
    ),
    'processamento', jsonb_build_object(
      'id', p.id, 'engine_versao', p.engine_versao,
      'regras_versao', p.versao_regra, 'imutavel', p.imutavel
    ),
    'achados', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'fator_codigo', a.fator_codigo, 'perigo_codigo', a.perigo_codigo,
        'condicao_preliminar', a.condicao_preliminar, 'nivel_evidencia', a.nivel_evidencia,
        'estado_convergencia', a.estado_convergencia, 'estado_final', a.estado_final,
        'frequencia_exposicao', a.frequencia_exposicao, 'intensidade_exigencia', a.intensidade_exigencia,
        'controle_existente', a.controle_existente, 'eficacia_controle', a.eficacia_controle,
        'necessita_acao', a.necessita_acao,
        'fundamentacao_sanitizada', a.fundamentacao_sanitizada,
        'regra_codigo', a.regra_codigo
      ) ORDER BY a.fator_codigo)
      FROM public.psico_individual_achados a
      WHERE a.avaliacao_id = p_avaliacao AND a.processamento_id = p.id
    ), '[]'::jsonb),
    'catalogo', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'codigo', m.codigo, 'titulo', m.titulo,
        'fator_codigo', m.fator_codigo,
        'nivel_recomendacao', m.nivel_recomendacao,
        'o_que_significa', m.o_que_significa,
        'responsaveis_sugeridos', m.responsaveis_sugeridos,
        'evidencias_recomendadas', m.evidencias_recomendadas,
        'indicadores_sugeridos', m.indicadores_sugeridos,
        'prazo_sugerido_dias', m.prazo_sugerido_dias
      ) ORDER BY m.fator_codigo, m.ordem)
      FROM public.psico_medidas_modelos m
      WHERE m.ativo = true
        AND m.fator_codigo IN (
          SELECT DISTINCT a.fator_codigo FROM public.psico_individual_achados a
           WHERE a.avaliacao_id = p_avaliacao AND a.processamento_id = p.id
        )
    ), '[]'::jsonb)
  ) INTO v_out
  FROM public.psico_avaliacoes av
  JOIN public.clients c ON c.id = av.client_id
  LEFT JOIN LATERAL (
    SELECT * FROM public.psico_individual_processamentos pp
     WHERE pp.avaliacao_id = av.id AND pp.imutavel = true
     ORDER BY pp.aprovado_em DESC NULLS LAST LIMIT 1
  ) p ON true
  WHERE av.id = p_avaliacao;

  IF v_out IS NULL THEN RAISE EXCEPTION 'avaliacao_nao_encontrada'; END IF;
  RETURN v_out;
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_contexto_para_ia(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_contexto_para_ia(uuid) TO service_role;

-- 7) RPC: registrar log de sugestão IA (service_role)
CREATE OR REPLACE FUNCTION public.psico_ind_log_sugestao_ia(
  p_avaliacao uuid, p_processamento uuid,
  p_modelo text, p_prompt_versao text,
  p_prompt_sistema text, p_prompt_usuario text,
  p_resposta jsonb, p_sugestoes jsonb, p_rejeitadas jsonb,
  p_status text, p_erro text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF coalesce(auth.jwt() ->> 'role','') <> 'service_role' THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  INSERT INTO public.psico_ind_sugestoes_ia(
    avaliacao_id, processamento_id, modelo, prompt_versao,
    prompt_sistema, prompt_usuario, resposta_bruta, sugestoes, rejeitadas, status, erro
  ) VALUES (
    p_avaliacao, p_processamento, p_modelo, p_prompt_versao,
    p_prompt_sistema, p_prompt_usuario, p_resposta, p_sugestoes, p_rejeitadas, p_status, p_erro
  ) RETURNING id INTO v_id;
  RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.psico_ind_log_sugestao_ia(uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_log_sugestao_ia(uuid,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,text) TO service_role;
