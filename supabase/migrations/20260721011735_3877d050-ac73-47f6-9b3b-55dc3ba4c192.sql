CREATE OR REPLACE FUNCTION public.psico_resumo_coleta(p_avaliacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av record;
  v_part_ativos integer;
  v_convites_ativos integer;
  v_convites_distr integer;
  v_acessaram integer;
  v_resp integer;
  v_pendentes integer;
  v_anon integer;
  v_publicas integer := 0;
  v_perc numeric;
  v_prazo_exp boolean;
  v_integridade boolean;
  v_denominador integer;
BEGIN
  IF v_uid IS NULL OR NOT can_see_internal(v_uid) THEN RAISE EXCEPTION 'Sem permissão.'; END IF;
  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Avaliação não encontrada.'; END IF;

  SELECT count(*) INTO v_part_ativos FROM public.psico_participantes WHERE avaliacao_id = p_avaliacao_id AND ativo = true;
  SELECT count(*) INTO v_convites_ativos FROM public.psico_convites WHERE avaliacao_id = p_avaliacao_id AND status = 'ativo';
  SELECT count(*) INTO v_convites_distr FROM public.psico_convites WHERE avaliacao_id = p_avaliacao_id AND distribuido_em IS NOT NULL;
  SELECT count(*) INTO v_acessaram FROM public.psico_convites WHERE avaliacao_id = p_avaliacao_id AND primeiro_acesso_em IS NOT NULL;
  SELECT count(*) INTO v_resp FROM public.psico_convites WHERE avaliacao_id = p_avaliacao_id AND status = 'respondido';
  SELECT count(*) INTO v_anon FROM public.psico_respostas WHERE avaliacao_id = p_avaliacao_id;
  SELECT count(*) INTO v_publicas FROM public.psico_respostas_publicas WHERE avaliacao_id = p_avaliacao_id;

  IF v_av.modo_coleta = 'publico_anonimo' THEN
    -- Enquanto a coleta está aberta, as respostas ficam em psico_respostas_publicas.
    -- Após o encerramento, elas são materializadas em psico_respostas.
    v_resp := GREATEST(v_publicas, v_anon);
    v_anon := v_resp;
    v_denominador := COALESCE(NULLIF(v_av.quantidade_participantes_prevista, 0), NULLIF(v_av.quantidade_participantes_abertura, 0), 0);
    v_perc := CASE WHEN v_denominador > 0 THEN round((v_resp::numeric / v_denominador::numeric) * 100, 1) ELSE 0 END;
    v_pendentes := GREATEST(v_denominador - v_resp, 0);
    v_integridade := true;
  ELSE
    v_pendentes := GREATEST(v_part_ativos - v_resp, 0);
    v_perc := CASE WHEN v_part_ativos > 0 THEN round((v_resp::numeric / v_part_ativos::numeric) * 100, 1) ELSE 0 END;
    v_integridade := (v_anon = v_resp);
  END IF;

  v_prazo_exp := v_av.coleta_expira_em IS NOT NULL AND now() > v_av.coleta_expira_em;

  RETURN jsonb_build_object(
    'status', v_av.status,
    'prazo', v_av.data_fim_prevista,
    'coleta_expira_em', v_av.coleta_expira_em,
    'prazo_expirado', v_prazo_exp,
    'participantes_previstos', v_av.quantidade_participantes_prevista,
    'participantes_na_abertura', v_av.quantidade_participantes_abertura,
    'participantes_ativos_atuais', v_part_ativos,
    'convites_ativos', v_convites_ativos,
    'convites_distribuidos', v_convites_distr,
    'acessaram', v_acessaram,
    'respondidos', v_resp,
    'pendentes', v_pendentes,
    'respostas_anonimas', v_anon,
    'percentual_participacao', v_perc,
    'integridade_ok', v_integridade,
    'quantidade_minima_global', 2,
    'amostra_suficiente_global', v_anon >= 2,
    'coleta_aberta_em', v_av.coleta_aberta_em,
    'coleta_encerrada_em', v_av.coleta_encerrada_em,
    'modo_coleta', v_av.modo_coleta
  );
END
$$;

REVOKE ALL ON FUNCTION public.psico_resumo_coleta(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_resumo_coleta(uuid) TO authenticated, service_role;