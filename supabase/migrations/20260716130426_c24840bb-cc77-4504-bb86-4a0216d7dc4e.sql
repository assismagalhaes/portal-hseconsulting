
-- 1) proposal_aceites: remover SELECT anon aberto (leitura pública é via RPC get_proposta_para_aceite)
DROP POLICY IF EXISTS "aceites_anon_select" ON public.proposal_aceites;

-- 2) proposal_clients: restringir gestão/leitura autenticada a usuários internos
DROP POLICY IF EXISTS "Autenticados gerenciam proposal_clients" ON public.proposal_clients;
DROP POLICY IF EXISTS "Autenticados leem proposal_clients" ON public.proposal_clients;
CREATE POLICY "proposal_clients internos manage"
  ON public.proposal_clients FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

-- 3) proposal_condicao_pagamento / _parcelas: restringir a internos
DROP POLICY IF EXISTS "prop cond pag auth" ON public.proposal_condicao_pagamento;
CREATE POLICY "prop cond pag internos"
  ON public.proposal_condicao_pagamento FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "prop cond parc auth" ON public.proposal_condicao_parcelas;
CREATE POLICY "prop cond parc internos"
  ON public.proposal_condicao_parcelas FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

-- 4) os_checklist_sugestoes: leitura/edição só para internos (não expor a client portal)
DROP POLICY IF EXISTS "Authenticated users can view suggestions" ON public.os_checklist_sugestoes;
DROP POLICY IF EXISTS "Authenticated users can update suggestions" ON public.os_checklist_sugestoes;
DROP POLICY IF EXISTS "Authenticated users can insert suggestions" ON public.os_checklist_sugestoes;
CREATE POLICY "os_checklist_sugestoes internos select"
  ON public.os_checklist_sugestoes FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));
CREATE POLICY "os_checklist_sugestoes internos insert"
  ON public.os_checklist_sugestoes FOR INSERT TO authenticated
  WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "os_checklist_sugestoes internos update"
  ON public.os_checklist_sugestoes FOR UPDATE TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

-- 5) condicoes_pagamento_parcelas: leitura restrita a internos
DROP POLICY IF EXISTS "cond pag parc select autenticado" ON public.condicoes_pagamento_parcelas;
CREATE POLICY "cond pag parc select internos"
  ON public.condicoes_pagamento_parcelas FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));
