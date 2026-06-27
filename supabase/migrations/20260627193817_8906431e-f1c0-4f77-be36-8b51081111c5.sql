
-- Replace permissive "true" policies with authenticated-only access
DROP POLICY IF EXISTS "clients all authenticated" ON public.clients;
CREATE POLICY "clients all authenticated" ON public.clients
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "services all authenticated" ON public.services;
CREATE POLICY "services all authenticated" ON public.services
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposals all authenticated" ON public.proposals;
CREATE POLICY "proposals all authenticated" ON public.proposals
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "proposal_items all authenticated" ON public.proposal_items;
CREATE POLICY "proposal_items all authenticated" ON public.proposal_items
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "rev all authenticated" ON public.proposal_revisions;
CREATE POLICY "rev all authenticated" ON public.proposal_revisions
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "as all authenticated" ON public.approved_services;
CREATE POLICY "as all authenticated" ON public.approved_services
  AS PERMISSIVE FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Lock down SECURITY DEFINER functions: trigger funcs not callable via API; helpers only by authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_proposal_status_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.can_see_internal(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_internal(uuid) TO authenticated;
