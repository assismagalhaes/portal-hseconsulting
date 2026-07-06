
-- 1) Funções utilitárias
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(auth.uid(), 'admin') $$;

CREATE OR REPLACE FUNCTION public.is_tecnico()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(),'tecnico')
    AND NOT public.has_role(auth.uid(),'admin')
    AND NOT public.has_role(auth.uid(),'comercial')
$$;

-- 2) Novos usuários passam a nascer como "tecnico"
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE existing_count INT;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO existing_count FROM public.user_roles;
  IF existing_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role)
    VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'tecnico'))
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

-- 3) Colunas de perfil
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS area text,
  ADD COLUMN IF NOT EXISTS registro_profissional text,
  ADD COLUMN IF NOT EXISTS foto_url text,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'ativo';

DROP POLICY IF EXISTS "profiles admin manage" ON public.profiles;
CREATE POLICY "profiles admin manage" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- 4) Bloqueio comercial
DROP POLICY IF EXISTS "proposals all authenticated" ON public.proposals;
CREATE POLICY "proposals internal all" ON public.proposals FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "proposal_items all authenticated" ON public.proposal_items;
CREATE POLICY "proposal_items internal all" ON public.proposal_items FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "rev all authenticated" ON public.proposal_revisions;
CREATE POLICY "proposal_revisions internal all" ON public.proposal_revisions FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "services all authenticated" ON public.services;
CREATE POLICY "services internal all" ON public.services FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "as all authenticated" ON public.approved_services;
CREATE POLICY "approved_services internal all" ON public.approved_services FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage hist prec" ON public.historico_precificacao;
CREATE POLICY "historico_precificacao internal" ON public.historico_precificacao FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage simulacoes" ON public.simulacoes_precificacao;
CREATE POLICY "simulacoes internal" ON public.simulacoes_precificacao FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage sim itens" ON public.simulacao_itens;
CREATE POLICY "simulacao_itens internal" ON public.simulacao_itens FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

DROP POLICY IF EXISTS "auth manage sim custos" ON public.simulacao_custos_compartilhados;
CREATE POLICY "simulacao_custos internal" ON public.simulacao_custos_compartilhados FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- CRM
DO $$
DECLARE t text; pname text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['crm_leads','crm_oportunidades','crm_followups','crm_agenda','crm_alertas','crm_historico']) LOOP
    FOR pname IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "%s_internal" ON public.%I FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()))', t, t);
  END LOOP;
END $$;

-- Financeiro
DO $$
DECLARE t text; pname text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['financeiro_contratos','financeiro_parcelas','financeiro_recebimentos','financeiro_custos','financeiro_alertas','financeiro_centros_custo','financeiro_configuracoes','financeiro_comprovantes','financeiro_rateios']) LOOP
    FOR pname IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY "%s_internal" ON public.%I FOR ALL TO authenticated USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()))', t, t);
  END LOOP;
END $$;

-- Automações
DROP POLICY IF EXISTS "internos gerenciam automacoes" ON public.automacoes;
DROP POLICY IF EXISTS "internos veem automacoes" ON public.automacoes;
CREATE POLICY "automacoes_internal_all" ON public.automacoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- 5) Projetos: técnicos leem, apenas interno modifica
DROP POLICY IF EXISTS "projetos_select" ON public.projetos;
DROP POLICY IF EXISTS "projetos_modify" ON public.projetos;
CREATE POLICY "projetos_select" ON public.projetos
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "projetos_insert" ON public.projetos
  FOR INSERT TO authenticated WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "projetos_update" ON public.projetos
  FOR UPDATE TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY "projetos_delete" ON public.projetos
  FOR DELETE TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "projeto_servicos_all" ON public.projeto_servicos;
CREATE POLICY "projeto_servicos_select" ON public.projeto_servicos
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "projeto_servicos_write" ON public.projeto_servicos
  FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()))
  WITH CHECK (public.can_see_internal(auth.uid()));

-- 6) Políticas do bucket avatares (bucket criado pela tool storage)
DROP POLICY IF EXISTS "avatares read auth" ON storage.objects;
CREATE POLICY "avatares read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatares');
DROP POLICY IF EXISTS "avatares user insert" ON storage.objects;
CREATE POLICY "avatares user insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatares' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "avatares user update" ON storage.objects;
CREATE POLICY "avatares user update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatares' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "avatares user delete" ON storage.objects;
CREATE POLICY "avatares user delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatares' AND auth.uid()::text = (storage.foldername(name))[1]);
DROP POLICY IF EXISTS "avatares admin manage" ON storage.objects;
CREATE POLICY "avatares admin manage" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'avatares' AND public.is_admin())
  WITH CHECK (bucket_id = 'avatares' AND public.is_admin());
