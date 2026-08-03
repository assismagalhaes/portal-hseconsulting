-- Corrige a validação de emissão para usar a coluna real de status do processamento.
-- A função permanece SECURITY DEFINER porque consolida dados internos protegidos por RLS;
-- o controle de acesso explícito por auth.uid()/can_see_internal é preservado.
CREATE OR REPLACE FUNCTION public.psico_validar_emissao_relatorio(p_avaliacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_av record; v_rev record; v_proc record; v_plano record;
  erros text[] := ARRAY[]::text[]; avisos text[] := ARRAY[]::text[];
  v_proxima text := 'R00';
  v_processamento_valido boolean := false;
  v_revisao_aprovada boolean := false;
  v_plano_aprovado boolean := false;
  v_responsavel_valido boolean := false;
BEGIN
  IF v_uid IS NULL OR NOT public.can_see_internal(v_uid) THEN
    RETURN jsonb_build_object('valido', false, 'pode_emitir', false,
      'erros', jsonb_build_array('nao_autorizado'), 'avisos', '[]'::jsonb);
  END IF;

  SELECT * INTO v_av FROM public.psico_avaliacoes WHERE id = p_avaliacao_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valido', false, 'pode_emitir', false,
      'erros', jsonb_build_array('avaliacao_inexistente'), 'avisos', '[]'::jsonb);
  END IF;

  IF v_av.status NOT IN ('resultado_pronto','relatorio_emitido') THEN
    erros := erros || 'status_avaliacao_incompativel';
  END IF;

  IF v_av.processamento_resultado_ativo_id IS NULL THEN
    erros := erros || 'sem_processamento_ativo';
  ELSE
    SELECT * INTO v_proc
      FROM public.psico_resultado_processamentos
     WHERE id = v_av.processamento_resultado_ativo_id;
    IF NOT FOUND OR v_proc.status IS DISTINCT FROM 'concluido' THEN
      erros := erros || 'processamento_invalido';
    ELSE
      v_processamento_valido := true;
    END IF;
  END IF;

  SELECT * INTO v_rev
    FROM public.psico_revisoes_tecnicas
   WHERE avaliacao_id = p_avaliacao_id AND ativa = true
   ORDER BY versao DESC
   LIMIT 1;
  IF NOT FOUND THEN
    erros := erros || 'sem_revisao_tecnica';
  ELSE
    v_revisao_aprovada := v_rev.status = 'aprovada';
    IF NOT v_revisao_aprovada THEN erros := erros || 'revisao_nao_aprovada'; END IF;
    IF coalesce(trim(v_rev.conclusao_tecnica),'') = '' THEN erros := erros || 'conclusao_vazia'; END IF;
    IF coalesce(trim(v_rev.limitacoes),'') = '' THEN erros := erros || 'limitacoes_vazias'; END IF;
    v_responsavel_valido := v_rev.responsavel_snapshot IS NOT NULL
      AND v_rev.responsavel_snapshot <> '{}'::jsonb;
    IF NOT v_responsavel_valido THEN
      erros := erros || 'responsavel_tecnico_ausente';
    END IF;
    SELECT * INTO v_plano FROM public.psico_planos_acao WHERE revisao_id = v_rev.id;
    IF NOT FOUND THEN
      erros := erros || 'sem_plano_acao';
    ELSE
      v_plano_aprovado := v_plano.status = 'aprovado';
      IF NOT v_plano_aprovado THEN erros := erros || 'plano_nao_aprovado'; END IF;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
      FROM public.psico_relatorios r
      JOIN public.psico_relatorios_versoes v ON v.relatorio_id = r.id
     WHERE r.avaliacao_id = p_avaliacao_id
       AND v.status IN ('preparando','gerando')
  ) THEN
    erros := erros || 'emissao_em_andamento';
  END IF;

  SELECT 'R' || lpad((coalesce(max(v.numero_revisao), -1) + 1)::text, 2, '0')
    INTO v_proxima
    FROM public.psico_relatorios r
    JOIN public.psico_relatorios_versoes v ON v.relatorio_id = r.id
   WHERE r.avaliacao_id = p_avaliacao_id
     AND v.status IN ('emitido','substituido');

  RETURN jsonb_build_object(
    'valido', array_length(erros,1) IS NULL,
    'pode_emitir', array_length(erros,1) IS NULL,
    'avaliacao_codigo', v_av.codigo,
    'revisao_tecnica_aprovada', v_revisao_aprovada,
    'processamento_valido', v_processamento_valido,
    'plano_aprovado', v_plano_aprovado,
    'responsavel_tecnico_valido', v_responsavel_valido,
    'modelo', 'HSE-PSICO-REL-1.0',
    'proxima_revisao', coalesce(v_proxima, 'R00'),
    'erros', to_jsonb(erros),
    'avisos', to_jsonb(avisos)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.psico_validar_emissao_relatorio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_validar_emissao_relatorio(uuid) TO authenticated, service_role;
