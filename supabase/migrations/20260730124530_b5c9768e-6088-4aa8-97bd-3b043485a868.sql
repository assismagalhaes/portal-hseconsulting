-- AQI 2.1: revisão segura de divergências, rastreabilidade e reabertura
-- controlada antes da existência de plano ou relatório emitido.

CREATE OR REPLACE FUNCTION public.psico_ind_alterar_classificacao(
  p_achado uuid,
  p_novo_estado text,
  p_justificativa text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_estado_anterior text;
  v_regra text;
  v_imutavel boolean;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tecnico'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF length(btrim(coalesce(p_justificativa, ''))) < 10 THEN
    RAISE EXCEPTION 'justificativa_obrigatoria_min_10';
  END IF;
  IF p_novo_estado NOT IN (
    'controlado','atencao_preventiva','requer_intervencao','prioritario',
    'divergente','evidencia_insuficiente','nao_aplicavel'
  ) THEN
    RAISE EXCEPTION 'estado_invalido';
  END IF;

  SELECT a.estado_final, a.regra_codigo, p.imutavel
    INTO v_estado_anterior, v_regra, v_imutavel
    FROM public.psico_individual_achados a
    JOIN public.psico_individual_processamentos p ON p.id = a.processamento_id
   WHERE a.id = p_achado
   FOR UPDATE OF a;

  IF NOT FOUND THEN RAISE EXCEPTION 'achado_nao_encontrado'; END IF;
  IF v_imutavel THEN RAISE EXCEPTION 'processamento_imutavel'; END IF;

  INSERT INTO public.psico_individual_achado_historico(
    achado_id, alterado_por, estado_anterior, estado_novo, justificativa, regra_codigo
  ) VALUES (
    p_achado, auth.uid(), v_estado_anterior, p_novo_estado, btrim(p_justificativa), v_regra
  );

  UPDATE public.psico_individual_achados
     SET estado_final = p_novo_estado,
         decisao_tecnica = p_novo_estado,
         necessita_acao = p_novo_estado IN (
           'atencao_preventiva','requer_intervencao','prioritario','divergente'
         ),
         justificativa_alteracao = btrim(p_justificativa),
         revisado_por = auth.uid(),
         revisado_em = now(),
         updated_at = now()
   WHERE id = p_achado;
END
$$;

REVOKE ALL ON FUNCTION public.psico_ind_alterar_classificacao(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_alterar_classificacao(uuid,text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_ind_aprovar_processamento(p_processamento uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avaliacao uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tecnico'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT avaliacao_id INTO v_avaliacao
    FROM public.psico_individual_processamentos
   WHERE id = p_processamento AND imutavel = false
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'processamento_nao_encontrado_ou_imutavel'; END IF;

  IF EXISTS (
    SELECT 1
      FROM public.psico_individual_achados
     WHERE processamento_id = p_processamento
       AND estado_final IN ('divergente','evidencia_insuficiente')
       AND revisado_em IS NULL
  ) THEN
    RAISE EXCEPTION 'divergencias_sem_validacao_tecnica';
  END IF;

  UPDATE public.psico_individual_processamentos
     SET imutavel = true,
         aprovado_por = auth.uid(),
         aprovado_em = now(),
         updated_at = now()
   WHERE id = p_processamento;

  INSERT INTO public.psico_auditoria(
    entidade, entidade_id, acao, usuario_id, metadados
  ) VALUES (
    'avaliacao', v_avaliacao, 'conciliacao_individual_aprovada', auth.uid(),
    jsonb_build_object(
      'resumo', 'Conciliação individual aprovada e tornada imutável',
      'processamento_id', p_processamento
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.psico_ind_aprovar_processamento(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_aprovar_processamento(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.psico_ind_reabrir_processamento(
  p_processamento uuid,
  p_motivo text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avaliacao uuid;
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'tecnico'::public.app_role)
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF length(btrim(coalesce(p_motivo, ''))) < 10 THEN
    RAISE EXCEPTION 'motivo_obrigatorio_min_10';
  END IF;

  SELECT avaliacao_id INTO v_avaliacao
    FROM public.psico_individual_processamentos
   WHERE id = p_processamento AND imutavel = true
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'processamento_nao_encontrado_ou_aberto'; END IF;

  IF EXISTS (
    SELECT 1 FROM public.psico_ind_plano_itens WHERE avaliacao_id = v_avaliacao
  ) THEN
    RAISE EXCEPTION 'reabertura_bloqueada_plano_existente';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.psico_ind_relatorios
     WHERE avaliacao_id = v_avaliacao AND status = 'emitido'
  ) THEN
    RAISE EXCEPTION 'reabertura_bloqueada_relatorio_emitido';
  END IF;

  UPDATE public.psico_individual_processamentos
     SET imutavel = false,
         aprovado_por = NULL,
         aprovado_em = NULL,
         updated_at = now()
   WHERE id = p_processamento;

  INSERT INTO public.psico_auditoria(
    entidade, entidade_id, acao, usuario_id, metadados
  ) VALUES (
    'avaliacao', v_avaliacao, 'conciliacao_individual_reaberta', auth.uid(),
    jsonb_build_object(
      'resumo', 'Conciliação individual reaberta para nova análise',
      'processamento_id', p_processamento,
      'motivo', btrim(p_motivo)
    )
  );
END
$$;

REVOKE ALL ON FUNCTION public.psico_ind_reabrir_processamento(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_reabrir_processamento(uuid,text) TO authenticated;

DROP FUNCTION IF EXISTS public.psico_ind_listar_achados(uuid);
CREATE FUNCTION public.psico_ind_listar_achados(p_avaliacao uuid)
RETURNS TABLE (
  id uuid, processamento_id uuid, fator_codigo text,
  perigo_codigo text, descricao_organizacional text,
  frequencia_exposicao text, intensidade_exigencia text,
  controle_existente text, eficacia_controle text,
  condicao_preliminar text, nivel_evidencia text,
  estado_convergencia text, fundamentacao_sanitizada text,
  regra_codigo text, regra_versao text,
  estado_final text, estado_original text,
  necessita_acao boolean, justificativa_alteracao text,
  revisado_por uuid, revisado_em timestamptz, imutavel boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.id, a.processamento_id, a.fator_codigo,
         a.perigo_codigo, a.descricao_organizacional,
         a.frequencia_exposicao, a.intensidade_exigencia,
         a.controle_existente, a.eficacia_controle,
         a.condicao_preliminar, a.nivel_evidencia,
         a.estado_convergencia, a.fundamentacao_sanitizada,
         a.regra_codigo, a.regra_versao,
         a.estado_final, a.estado_original,
         a.necessita_acao, a.justificativa_alteracao,
         a.revisado_por, a.revisado_em, p.imutavel
    FROM public.psico_individual_achados a
    JOIN public.psico_individual_processamentos p ON p.id = a.processamento_id
   WHERE a.avaliacao_id = p_avaliacao
     AND (
       public.has_role(auth.uid(), 'admin'::public.app_role)
       OR public.has_role(auth.uid(), 'tecnico'::public.app_role)
     )
   ORDER BY a.fator_codigo, a.perigo_codigo;
$$;

REVOKE ALL ON FUNCTION public.psico_ind_listar_achados(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_ind_listar_achados(uuid) TO authenticated;