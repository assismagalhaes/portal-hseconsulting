
-- storage avatares: restringir leitura ao próprio dono / admin
DROP POLICY IF EXISTS "avatares read auth" ON storage.objects;
DROP POLICY IF EXISTS "avatares read own" ON storage.objects;
CREATE POLICY "avatares read own" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'avatares'
    AND (
      (auth.uid())::text = (storage.foldername(name))[1]
      OR public.is_admin()
      OR public.can_see_internal(auth.uid())
    )
  );

-- execucao_profissionais: leitura só interna
DROP POLICY IF EXISTS "auth read profissionais" ON public.execucao_profissionais;
DROP POLICY IF EXISTS "internal read profissionais" ON public.execucao_profissionais;
CREATE POLICY "internal read profissionais" ON public.execucao_profissionais FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()) OR auth_user_id = auth.uid());

-- cnpj_consultas_log: insert só interno
DROP POLICY IF EXISTS "Usuários autenticados podem registrar consulta" ON public.cnpj_consultas_log;
DROP POLICY IF EXISTS "internal insert cnpj log" ON public.cnpj_consultas_log;
CREATE POLICY "internal insert cnpj log" ON public.cnpj_consultas_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_see_internal(auth.uid()));

-- valor_hora_tecnica_historico: só interno
DROP POLICY IF EXISTS "vht_select" ON public.valor_hora_tecnica_historico;
DROP POLICY IF EXISTS "vht_insert" ON public.valor_hora_tecnica_historico;
DROP POLICY IF EXISTS "vht internal select" ON public.valor_hora_tecnica_historico;
DROP POLICY IF EXISTS "vht internal insert" ON public.valor_hora_tecnica_historico;
CREATE POLICY "vht internal select" ON public.valor_hora_tecnica_historico FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()) OR public.can_see_financeiro());
CREATE POLICY "vht internal insert" ON public.valor_hora_tecnica_historico FOR INSERT TO authenticated
  WITH CHECK (public.can_see_internal(auth.uid()));

-- execucao_historico: insert só quem tem acesso à execução
DROP POLICY IF EXISTS "auth insert historico" ON public.execucao_historico;
DROP POLICY IF EXISTS "scoped insert historico" ON public.execucao_historico;
CREATE POLICY "scoped insert historico" ON public.execucao_historico FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_execucao(auth.uid(), execucao_id));

-- execucao_timeline: idem
DROP POLICY IF EXISTS "auth insert timeline" ON public.execucao_timeline;
DROP POLICY IF EXISTS "scoped insert timeline" ON public.execucao_timeline;
CREATE POLICY "scoped insert timeline" ON public.execucao_timeline FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_execucao(auth.uid(), execucao_id));

-- documentos_notificacoes: broadcasts só internos, insert só internos
DROP POLICY IF EXISTS "auth read own notifs" ON public.documentos_notificacoes;
DROP POLICY IF EXISTS "auth insert notifs" ON public.documentos_notificacoes;
DROP POLICY IF EXISTS "auth update own notifs" ON public.documentos_notificacoes;
DROP POLICY IF EXISTS "read own or internal broadcast notifs" ON public.documentos_notificacoes;
DROP POLICY IF EXISTS "internal insert notifs" ON public.documentos_notificacoes;
DROP POLICY IF EXISTS "update own or internal broadcast notifs" ON public.documentos_notificacoes;
CREATE POLICY "read own or internal broadcast notifs" ON public.documentos_notificacoes FOR SELECT TO authenticated
  USING (user_id_destino = auth.uid() OR (user_id_destino IS NULL AND public.can_see_internal(auth.uid())));
CREATE POLICY "internal insert notifs" ON public.documentos_notificacoes FOR INSERT TO authenticated
  WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "update own or internal broadcast notifs" ON public.documentos_notificacoes FOR UPDATE TO authenticated
  USING (user_id_destino = auth.uid() OR (user_id_destino IS NULL AND public.can_see_internal(auth.uid())))
  WITH CHECK (user_id_destino = auth.uid() OR (user_id_destino IS NULL AND public.can_see_internal(auth.uid())));
