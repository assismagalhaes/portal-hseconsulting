
-- 1) Vínculo profissional ↔ auth.users
ALTER TABLE public.execucao_profissionais
  ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_execucao_profissionais_auth_user
  ON public.execucao_profissionais(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- 2) Helpers
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_uid uuid, _projeto_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.can_see_internal(_uid)
    OR public.has_role(_uid, 'financeiro')
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = _projeto_id AND (p.gestor_id = _uid OR p.responsavel_comercial_id = _uid))
    OR EXISTS (SELECT 1 FROM public.projeto_servicos ps WHERE ps.projeto_id = _projeto_id AND ps.responsavel_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
       JOIN public.os_equipe oe ON oe.os_id = os.id
       JOIN public.execucao_profissionais ep ON ep.id = oe.profissional_id
       WHERE os.projeto_id = _projeto_id AND ep.auth_user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.ordens_servico os WHERE os.projeto_id = _projeto_id AND os.responsavel_tecnico_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.execucao_servicos es
       JOIN public.execucao_servico_equipe ese ON ese.execucao_id = es.id
       JOIN public.execucao_profissionais ep ON ep.id = ese.profissional_id
       JOIN public.projeto_servicos ps ON ps.proposal_item_id = es.proposal_item_id
       WHERE ps.projeto_id = _projeto_id AND ep.auth_user_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.execucao_servicos es
       JOIN public.projeto_servicos ps ON ps.proposal_item_id = es.proposal_item_id
       WHERE ps.projeto_id = _projeto_id AND es.responsavel_tecnico_id = _uid)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_os(_uid uuid, _os_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.can_see_internal(_uid) OR public.has_role(_uid,'financeiro')
    OR EXISTS (SELECT 1 FROM public.ordens_servico os WHERE os.id = _os_id AND (os.responsavel_tecnico_id = _uid OR public.user_can_access_projeto(_uid, os.projeto_id)))
    OR EXISTS (SELECT 1 FROM public.os_equipe oe JOIN public.execucao_profissionais ep ON ep.id = oe.profissional_id WHERE oe.os_id = _os_id AND ep.auth_user_id = _uid)
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_execucao(_uid uuid, _execucao_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _uid IS NOT NULL AND (
    public.can_see_internal(_uid) OR public.has_role(_uid,'financeiro')
    OR EXISTS (SELECT 1 FROM public.execucao_servicos es WHERE es.id = _execucao_id AND es.responsavel_tecnico_id = _uid)
    OR EXISTS (SELECT 1 FROM public.execucao_servico_equipe ese JOIN public.execucao_profissionais ep ON ep.id = ese.profissional_id WHERE ese.execucao_id = _execucao_id AND ep.auth_user_id = _uid)
  )
$$;

REVOKE EXECUTE ON FUNCTION public.user_can_access_projeto(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_os(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.user_can_access_execucao(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_access_projeto(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_os(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_can_access_execucao(uuid, uuid) TO authenticated, service_role;

-- 3) Policies (SELECT restrito por escopo; escrita segue sendo interna)
DROP POLICY IF EXISTS "projetos_select" ON public.projetos;
CREATE POLICY "projetos_select" ON public.projetos FOR SELECT TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), id));

DROP POLICY IF EXISTS "projeto_servicos_select" ON public.projeto_servicos;
CREATE POLICY "projeto_servicos_select" ON public.projeto_servicos FOR SELECT TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

DROP POLICY IF EXISTS "projeto_timeline_select" ON public.projeto_timeline;
CREATE POLICY "projeto_timeline_select" ON public.projeto_timeline FOR SELECT TO authenticated
  USING (public.user_can_access_projeto(auth.uid(), projeto_id));

DROP POLICY IF EXISTS "auth read os" ON public.ordens_servico;
CREATE POLICY "ordens_servico_select" ON public.ordens_servico FOR SELECT TO authenticated
  USING (public.user_can_access_os(auth.uid(), id));

DROP POLICY IF EXISTS "auth all os_timeline" ON public.os_timeline;
CREATE POLICY "os_timeline_select" ON public.os_timeline FOR SELECT TO authenticated USING (public.user_can_access_os(auth.uid(), os_id));
CREATE POLICY "os_timeline_write" ON public.os_timeline FOR INSERT TO authenticated WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), os_id));

DROP POLICY IF EXISTS "auth all os_equipe" ON public.os_equipe;
CREATE POLICY "os_equipe_select" ON public.os_equipe FOR SELECT TO authenticated USING (public.user_can_access_os(auth.uid(), os_id));
CREATE POLICY "os_equipe_write" ON public.os_equipe FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth all os_visitas" ON public.os_visitas;
CREATE POLICY "os_visitas_select" ON public.os_visitas FOR SELECT TO authenticated USING (public.user_can_access_os(auth.uid(), os_id));
CREATE POLICY "os_visitas_write" ON public.os_visitas FOR ALL TO authenticated USING (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), os_id)) WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), os_id));

DROP POLICY IF EXISTS "auth all os_evidencias" ON public.os_evidencias;
CREATE POLICY "os_evidencias_select" ON public.os_evidencias FOR SELECT TO authenticated USING (public.user_can_access_os(auth.uid(), os_id));
CREATE POLICY "os_evidencias_write" ON public.os_evidencias FOR ALL TO authenticated USING (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), os_id)) WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), os_id));

DROP POLICY IF EXISTS "auth all os_checklist" ON public.os_checklist;
CREATE POLICY "os_checklist_select" ON public.os_checklist FOR SELECT TO authenticated USING (public.user_can_access_os(auth.uid(), os_id));
CREATE POLICY "os_checklist_write" ON public.os_checklist FOR ALL TO authenticated USING (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), os_id)) WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), os_id));

DROP POLICY IF EXISTS "auth all os_documentos" ON public.os_documentos;
CREATE POLICY "os_documentos_select" ON public.os_documentos FOR SELECT TO authenticated USING (public.user_can_access_os(auth.uid(), os_id));
CREATE POLICY "os_documentos_write" ON public.os_documentos FOR ALL TO authenticated USING (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), os_id)) WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), os_id));

DROP POLICY IF EXISTS "auth read execucao" ON public.execucao_servicos;
CREATE POLICY "execucao_servicos_select" ON public.execucao_servicos FOR SELECT TO authenticated
  USING (public.user_can_access_execucao(auth.uid(), id));

DROP POLICY IF EXISTS "auth all anexos" ON public.execucao_anexos;
CREATE POLICY "execucao_anexos_select" ON public.execucao_anexos FOR SELECT TO authenticated USING (public.user_can_access_execucao(auth.uid(), execucao_id));
CREATE POLICY "execucao_anexos_write" ON public.execucao_anexos FOR ALL TO authenticated USING (public.can_see_internal(auth.uid()) OR public.user_can_access_execucao(auth.uid(), execucao_id)) WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_execucao(auth.uid(), execucao_id));

DROP POLICY IF EXISTS "auth all checklists" ON public.execucao_checklists;
CREATE POLICY "execucao_checklists_select" ON public.execucao_checklists FOR SELECT TO authenticated USING (public.user_can_access_execucao(auth.uid(), execucao_id));
CREATE POLICY "execucao_checklists_write" ON public.execucao_checklists FOR ALL TO authenticated USING (public.can_see_internal(auth.uid()) OR public.user_can_access_execucao(auth.uid(), execucao_id)) WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_execucao(auth.uid(), execucao_id));

DROP POLICY IF EXISTS "auth all obs" ON public.execucao_observacoes;
CREATE POLICY "execucao_observacoes_select" ON public.execucao_observacoes FOR SELECT TO authenticated USING (public.user_can_access_execucao(auth.uid(), execucao_id));
CREATE POLICY "execucao_observacoes_write" ON public.execucao_observacoes FOR ALL TO authenticated USING (public.can_see_internal(auth.uid()) OR public.user_can_access_execucao(auth.uid(), execucao_id)) WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_execucao(auth.uid(), execucao_id));

DROP POLICY IF EXISTS "auth read historico" ON public.execucao_historico;
CREATE POLICY "execucao_historico_select" ON public.execucao_historico FOR SELECT TO authenticated USING (public.user_can_access_execucao(auth.uid(), execucao_id));

DROP POLICY IF EXISTS "auth read timeline" ON public.execucao_timeline;
CREATE POLICY "execucao_timeline_select" ON public.execucao_timeline FOR SELECT TO authenticated USING (public.user_can_access_execucao(auth.uid(), execucao_id));

DROP POLICY IF EXISTS "auth all equipe" ON public.execucao_servico_equipe;
CREATE POLICY "execucao_servico_equipe_select" ON public.execucao_servico_equipe FOR SELECT TO authenticated USING (public.user_can_access_execucao(auth.uid(), execucao_id));
CREATE POLICY "execucao_servico_equipe_write" ON public.execucao_servico_equipe FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage documentos" ON public.documentos_tecnicos;
CREATE POLICY "documentos_tecnicos_select" ON public.documentos_tecnicos FOR SELECT TO authenticated
  USING (
    public.can_see_internal(auth.uid())
    OR (projeto_id IS NOT NULL AND public.user_can_access_projeto(auth.uid(), projeto_id))
    OR (os_id IS NOT NULL AND public.user_can_access_os(auth.uid(), os_id))
    OR (execucao_id IS NOT NULL AND public.user_can_access_execucao(auth.uid(), execucao_id))
  );
CREATE POLICY "documentos_tecnicos_write" ON public.documentos_tecnicos FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

-- tarefas: técnico só vê tarefas onde é responsável ou criador
DROP POLICY IF EXISTS "internos veem tarefas" ON public.tarefas;
DROP POLICY IF EXISTS "internos gerenciam tarefas" ON public.tarefas;
CREATE POLICY "tarefas_select" ON public.tarefas FOR SELECT TO authenticated
  USING (
    NOT public.is_client_user() AND (
      public.can_see_internal(auth.uid())
      OR responsavel_id = auth.uid()
      OR created_by = auth.uid()
    )
  );
CREATE POLICY "tarefas_write" ON public.tarefas FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()) OR responsavel_id = auth.uid())
  WITH CHECK (public.can_see_internal(auth.uid()) OR responsavel_id = auth.uid());
