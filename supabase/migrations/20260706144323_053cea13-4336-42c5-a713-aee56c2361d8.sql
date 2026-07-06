
-- clients
DROP POLICY IF EXISTS "clients all authenticated" ON public.clients;
DROP POLICY IF EXISTS "clients internal write" ON public.clients;
CREATE POLICY "clients internal write" ON public.clients FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- crm_motivos_perda
DROP POLICY IF EXISTS "auth_read_motivos" ON public.crm_motivos_perda;
DROP POLICY IF EXISTS "internal read motivos" ON public.crm_motivos_perda;
CREATE POLICY "internal read motivos" ON public.crm_motivos_perda FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));

-- documentos_permissoes
DROP POLICY IF EXISTS "auth read permissoes" ON public.documentos_permissoes;
DROP POLICY IF EXISTS "internal read permissoes" ON public.documentos_permissoes;
CREATE POLICY "internal read permissoes" ON public.documentos_permissoes FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));

-- documentos_campos_variaveis
DROP POLICY IF EXISTS "auth read campos" ON public.documentos_campos_variaveis;
DROP POLICY IF EXISTS "internal read campos" ON public.documentos_campos_variaveis;
CREATE POLICY "internal read campos" ON public.documentos_campos_variaveis FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));

-- documentos_timeline
DROP POLICY IF EXISTS "auth read timeline" ON public.documentos_timeline;
DROP POLICY IF EXISTS "auth insert timeline" ON public.documentos_timeline;
DROP POLICY IF EXISTS "internal read timeline" ON public.documentos_timeline;
DROP POLICY IF EXISTS "internal insert timeline" ON public.documentos_timeline;
CREATE POLICY "internal read timeline" ON public.documentos_timeline FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));
CREATE POLICY "internal insert timeline" ON public.documentos_timeline FOR INSERT TO authenticated
  WITH CHECK (public.can_see_internal(auth.uid()));

-- documentos gestão interna
DROP POLICY IF EXISTS "auth manage anexos" ON public.documentos_anexos;
DROP POLICY IF EXISTS "internal manage anexos" ON public.documentos_anexos;
CREATE POLICY "internal manage anexos" ON public.documentos_anexos FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage aprovacoes" ON public.documentos_aprovacoes;
DROP POLICY IF EXISTS "internal manage aprovacoes" ON public.documentos_aprovacoes;
CREATE POLICY "internal manage aprovacoes" ON public.documentos_aprovacoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage modelos" ON public.documentos_modelos;
DROP POLICY IF EXISTS "internal manage modelos" ON public.documentos_modelos;
CREATE POLICY "internal manage modelos" ON public.documentos_modelos FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage recebidos" ON public.documentos_recebidos;
DROP POLICY IF EXISTS "internal manage recebidos" ON public.documentos_recebidos;
CREATE POLICY "internal manage recebidos" ON public.documentos_recebidos FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage revisoes" ON public.documentos_revisoes;
DROP POLICY IF EXISTS "internal manage revisoes" ON public.documentos_revisoes;
CREATE POLICY "internal manage revisoes" ON public.documentos_revisoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage secoes" ON public.documentos_secoes;
DROP POLICY IF EXISTS "internal manage secoes" ON public.documentos_secoes;
CREATE POLICY "internal manage secoes" ON public.documentos_secoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage pendentes" ON public.documentos_pendentes;
DROP POLICY IF EXISTS "internal manage pendentes" ON public.documentos_pendentes;
CREATE POLICY "internal manage pendentes" ON public.documentos_pendentes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- execucao_servicos
DROP POLICY IF EXISTS "auth insert execucao" ON public.execucao_servicos;
DROP POLICY IF EXISTS "auth update execucao" ON public.execucao_servicos;
DROP POLICY IF EXISTS "internal insert execucao" ON public.execucao_servicos;
DROP POLICY IF EXISTS "internal update execucao" ON public.execucao_servicos;
CREATE POLICY "internal insert execucao" ON public.execucao_servicos FOR INSERT TO authenticated
  WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "internal update execucao" ON public.execucao_servicos FOR UPDATE TO authenticated
  USING (public.can_see_internal(auth.uid()) OR public.user_can_access_execucao(auth.uid(), id))
  WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_execucao(auth.uid(), id));

-- ordens_servico
DROP POLICY IF EXISTS "auth write os" ON public.ordens_servico;
DROP POLICY IF EXISTS "internal write os" ON public.ordens_servico;
DROP POLICY IF EXISTS "internal update os" ON public.ordens_servico;
DROP POLICY IF EXISTS "internal delete os" ON public.ordens_servico;
CREATE POLICY "internal write os" ON public.ordens_servico FOR INSERT TO authenticated
  WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "internal update os" ON public.ordens_servico FOR UPDATE TO authenticated
  USING (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), id))
  WITH CHECK (public.can_see_internal(auth.uid()) OR public.user_can_access_os(auth.uid(), id));
CREATE POLICY "internal delete os" ON public.ordens_servico FOR DELETE TO authenticated
  USING (public.is_admin());

-- os_* auxiliares
DROP POLICY IF EXISTS "auth all os_logistica" ON public.os_logistica;
DROP POLICY IF EXISTS "internal os_logistica" ON public.os_logistica;
CREATE POLICY "internal os_logistica" ON public.os_logistica FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth all os_recursos" ON public.os_recursos;
DROP POLICY IF EXISTS "internal os_recursos" ON public.os_recursos;
CREATE POLICY "internal os_recursos" ON public.os_recursos FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth all os_eventos" ON public.os_eventos_agenda;
DROP POLICY IF EXISTS "internal os_eventos" ON public.os_eventos_agenda;
CREATE POLICY "internal os_eventos" ON public.os_eventos_agenda FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth all os_visita_checklist" ON public.os_visita_checklist;
DROP POLICY IF EXISTS "internal os_visita_checklist" ON public.os_visita_checklist;
CREATE POLICY "internal os_visita_checklist" ON public.os_visita_checklist FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- profiles
DROP POLICY IF EXISTS "profiles select auth" ON public.profiles;
DROP POLICY IF EXISTS "profiles self or internal" ON public.profiles;
CREATE POLICY "profiles self or internal" ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.can_see_internal(auth.uid()) OR public.has_role(auth.uid(), 'financeiro'));

-- service_categories
DROP POLICY IF EXISTS "auth insert categories" ON public.service_categories;
DROP POLICY IF EXISTS "auth update categories" ON public.service_categories;
DROP POLICY IF EXISTS "auth delete categories" ON public.service_categories;
DROP POLICY IF EXISTS "admin write categories" ON public.service_categories;
DROP POLICY IF EXISTS "admin update categories" ON public.service_categories;
DROP POLICY IF EXISTS "admin delete categories" ON public.service_categories;
CREATE POLICY "admin write categories" ON public.service_categories FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "admin update categories" ON public.service_categories FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "admin delete categories" ON public.service_categories FOR DELETE TO authenticated
  USING (public.is_admin());

-- STORAGE
DROP POLICY IF EXISTS "auth read os-documentos" ON storage.objects;
DROP POLICY IF EXISTS "auth write os-documentos" ON storage.objects;
DROP POLICY IF EXISTS "os-documentos internal all" ON storage.objects;
CREATE POLICY "os-documentos internal all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'os-documentos' AND public.can_see_internal(auth.uid()))
  WITH CHECK (bucket_id = 'os-documentos' AND public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth read os-evidencias" ON storage.objects;
DROP POLICY IF EXISTS "auth write os-evidencias" ON storage.objects;
DROP POLICY IF EXISTS "os-evidencias internal all" ON storage.objects;
CREATE POLICY "os-evidencias internal all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'os-evidencias' AND public.can_see_internal(auth.uid()))
  WITH CHECK (bucket_id = 'os-evidencias' AND public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth read documentos-tecnicos" ON storage.objects;
DROP POLICY IF EXISTS "auth upload documentos-tecnicos" ON storage.objects;
DROP POLICY IF EXISTS "auth update documentos-tecnicos" ON storage.objects;
DROP POLICY IF EXISTS "auth delete documentos-tecnicos" ON storage.objects;
DROP POLICY IF EXISTS "documentos-tecnicos internal all" ON storage.objects;
CREATE POLICY "documentos-tecnicos internal all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'documentos-tecnicos' AND public.can_see_internal(auth.uid()))
  WITH CHECK (bucket_id = 'documentos-tecnicos' AND public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth read execucao anexos" ON storage.objects;
DROP POLICY IF EXISTS "auth upload execucao anexos" ON storage.objects;
DROP POLICY IF EXISTS "auth update execucao anexos" ON storage.objects;
DROP POLICY IF EXISTS "auth delete execucao anexos" ON storage.objects;
DROP POLICY IF EXISTS "execucao-anexos internal all" ON storage.objects;
CREATE POLICY "execucao-anexos internal all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'execucao-anexos' AND public.can_see_internal(auth.uid()))
  WITH CHECK (bucket_id = 'execucao-anexos' AND public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "fin compr select" ON storage.objects;
DROP POLICY IF EXISTS "fin compr insert" ON storage.objects;
DROP POLICY IF EXISTS "fin compr update" ON storage.objects;
DROP POLICY IF EXISTS "fin compr delete" ON storage.objects;
DROP POLICY IF EXISTS "financeiro-comprovantes fin all" ON storage.objects;
CREATE POLICY "financeiro-comprovantes fin all" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'financeiro-comprovantes' AND public.can_see_financeiro())
  WITH CHECK (bucket_id = 'financeiro-comprovantes' AND public.can_see_financeiro());
