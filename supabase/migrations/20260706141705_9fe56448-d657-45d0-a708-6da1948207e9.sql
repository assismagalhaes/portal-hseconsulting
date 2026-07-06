
-- Helpers
CREATE OR REPLACE FUNCTION public.is_comercial()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'comercial') $$;

CREATE OR REPLACE FUNCTION public.is_financeiro()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'financeiro') $$;

CREATE OR REPLACE FUNCTION public.can_see_financeiro()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_admin() OR public.has_role(auth.uid(), 'financeiro') $$;

CREATE OR REPLACE FUNCTION public.can_see_comercial()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.is_admin() OR public.has_role(auth.uid(), 'comercial') $$;

REVOKE EXECUTE ON FUNCTION public.is_comercial() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_financeiro() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_see_financeiro() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_see_comercial() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_comercial() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_financeiro() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_financeiro() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_see_comercial() TO authenticated, service_role;

-- Substituir policies dos financeiro_* para permitir admin + financeiro
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'financeiro_alertas','financeiro_centros_custo','financeiro_comprovantes',
    'financeiro_configuracoes','financeiro_contratos','financeiro_custos',
    'financeiro_parcelas','financeiro_rateios','financeiro_recebimentos'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_internal', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_see_financeiro()) WITH CHECK (public.can_see_financeiro())',
      t||'_financeiro', t
    );
  END LOOP;
END $$;

-- Comprovantes storage bucket precisa refletir também
DROP POLICY IF EXISTS "financeiro-comprovantes internal read" ON storage.objects;
DROP POLICY IF EXISTS "financeiro-comprovantes internal write" ON storage.objects;

-- Contexto para financeiro (somente leitura)
DROP POLICY IF EXISTS "clients_financeiro_read" ON public.clients;
CREATE POLICY "clients_financeiro_read"
  ON public.clients FOR SELECT TO authenticated
  USING (public.is_financeiro());

DROP POLICY IF EXISTS "proposals_financeiro_read" ON public.proposals;
CREATE POLICY "proposals_financeiro_read"
  ON public.proposals FOR SELECT TO authenticated
  USING (public.is_financeiro());

DROP POLICY IF EXISTS "proposal_items_financeiro_read" ON public.proposal_items;
CREATE POLICY "proposal_items_financeiro_read"
  ON public.proposal_items FOR SELECT TO authenticated
  USING (public.is_financeiro());
