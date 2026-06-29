
-- 1) Replace permissive policies (USING/WITH CHECK = true) with auth.uid() IS NOT NULL
DO $$
DECLARE
  rec RECORD;
  new_qual TEXT;
  new_check TEXT;
  cmd_clause TEXT;
BEGIN
  FOR rec IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check, roles
    FROM pg_policies
    WHERE schemaname='public'
      AND cmd <> 'SELECT'
      AND (qual = 'true' OR with_check = 'true')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', rec.policyname, rec.tablename);

    cmd_clause := CASE rec.cmd
      WHEN 'ALL' THEN 'ALL'
      WHEN 'INSERT' THEN 'INSERT'
      WHEN 'UPDATE' THEN 'UPDATE'
      WHEN 'DELETE' THEN 'DELETE'
      ELSE rec.cmd
    END;

    IF rec.cmd = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL)',
        rec.policyname, rec.tablename
      );
    ELSIF rec.cmd = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL)',
        rec.policyname, rec.tablename
      );
    ELSIF rec.cmd = 'UPDATE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
        rec.policyname, rec.tablename
      );
    ELSE -- ALL
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)',
        rec.policyname, rec.tablename
      );
    END IF;
  END LOOP;
END$$;

-- 2) Revoke EXECUTE from anon and PUBLIC on all SECURITY DEFINER trigger/internal functions
-- Trigger functions (no args)
REVOKE EXECUTE ON FUNCTION public.cliente_usuario_after_insert() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_fup_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_lead_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_oport_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.crm_sync_proposta() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documentos_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.execucao_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.os_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tarefa_audit() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.financeiro_on_proposal_aprovada() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_documento() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_numero_os() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_proposal_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_visita_agenda() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- 3) Helper functions used inside policies — keep authenticated, revoke anon/PUBLIC
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_client_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_client_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_see_internal(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cliente_log(text, text) FROM PUBLIC, anon;

-- 4) RPC functions called by the app — keep authenticated, revoke anon/PUBLIC
REVOKE EXECUTE ON FUNCTION public.add_proposal_revision(uuid, text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.criar_execucoes_da_proposta(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.criar_revisao_documento(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.crm_converter_lead(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.financeiro_atualizar_vencidas() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.financeiro_gerar_contrato(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.financeiro_registrar_recebimento(uuid, numeric, date, fin_forma_pagamento, text, text, text) FROM PUBLIC, anon;
