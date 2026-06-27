
DO $$ BEGIN
  CREATE TYPE public.cliente_perfil AS ENUM ('admin_cliente','gestor_sst','rh','financeiro','visualizador','responsavel_pendencias');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.cliente_user_status AS ENUM ('ativo','inativo','convite_pendente','bloqueado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.cliente_com_status AS ENUM ('aberta','respondida','encerrada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.proposals          ADD COLUMN IF NOT EXISTS visivel_para_cliente boolean NOT NULL DEFAULT false;
ALTER TABLE public.execucao_servicos  ADD COLUMN IF NOT EXISTS visivel_para_cliente boolean NOT NULL DEFAULT false;
ALTER TABLE public.ordens_servico     ADD COLUMN IF NOT EXISTS visivel_para_cliente boolean NOT NULL DEFAULT false;
ALTER TABLE public.documentos_tecnicos ADD COLUMN IF NOT EXISTS visivel_para_cliente boolean NOT NULL DEFAULT false;
ALTER TABLE public.documentos_pendentes ADD COLUMN IF NOT EXISTS visivel_para_cliente boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS public.cliente_usuarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL, cargo text, email text NOT NULL, telefone text, whatsapp text,
  perfil public.cliente_perfil NOT NULL DEFAULT 'visualizador',
  status public.cliente_user_status NOT NULL DEFAULT 'convite_pendente',
  ultimo_acesso timestamptz, convite_token text, convite_enviado_em timestamptz,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, email)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_usuarios TO authenticated;
GRANT ALL ON public.cliente_usuarios TO service_role;
ALTER TABLE public.cliente_usuarios ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_client_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.cliente_usuarios WHERE auth_user_id = auth.uid() AND status = 'ativo' LIMIT 1
$$;
CREATE OR REPLACE FUNCTION public.is_client_user()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.cliente_usuarios WHERE auth_user_id = auth.uid() AND status = 'ativo')
$$;

CREATE POLICY cu_internal_all ON public.cliente_usuarios FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY cu_self_select ON public.cliente_usuarios FOR SELECT TO authenticated
  USING (auth_user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.cliente_permissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_usuario_id uuid NOT NULL UNIQUE REFERENCES public.cliente_usuarios(id) ON DELETE CASCADE,
  ver_propostas boolean NOT NULL DEFAULT true, baixar_propostas boolean NOT NULL DEFAULT true,
  ver_servicos boolean NOT NULL DEFAULT true, ver_os boolean NOT NULL DEFAULT true,
  ver_documentos boolean NOT NULL DEFAULT true, baixar_documentos boolean NOT NULL DEFAULT true,
  enviar_documentos boolean NOT NULL DEFAULT true, responder_pendencias boolean NOT NULL DEFAULT true,
  ver_financeiro boolean NOT NULL DEFAULT false, abrir_comunicacao boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_permissoes TO authenticated;
GRANT ALL ON public.cliente_permissoes TO service_role;
ALTER TABLE public.cliente_permissoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cp_internal_all ON public.cliente_permissoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY cp_self ON public.cliente_permissoes FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.cliente_usuarios u WHERE u.id = cliente_usuario_id AND u.auth_user_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.cliente_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL UNIQUE REFERENCES public.clients(id) ON DELETE CASCADE,
  portal_ativo boolean NOT NULL DEFAULT false,
  mostrar_financeiro boolean NOT NULL DEFAULT false,
  mostrar_propostas boolean NOT NULL DEFAULT true, mostrar_servicos boolean NOT NULL DEFAULT true,
  mostrar_os boolean NOT NULL DEFAULT true, mostrar_documentos boolean NOT NULL DEFAULT true,
  mostrar_pendencias boolean NOT NULL DEFAULT true, mostrar_comunicacoes boolean NOT NULL DEFAULT true,
  mensagem_boas_vindas text,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_configuracoes TO authenticated;
GRANT ALL ON public.cliente_configuracoes TO service_role;
ALTER TABLE public.cliente_configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccfg_internal ON public.cliente_configuracoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY ccfg_client_self ON public.cliente_configuracoes FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());

CREATE TABLE IF NOT EXISTS public.cliente_notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cliente_usuario_id uuid REFERENCES public.cliente_usuarios(id) ON DELETE CASCADE,
  tipo text NOT NULL, titulo text NOT NULL, mensagem text, link text,
  lida boolean NOT NULL DEFAULT false, lida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_notificacoes TO authenticated;
GRANT ALL ON public.cliente_notificacoes TO service_role;
ALTER TABLE public.cliente_notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY cn_internal ON public.cliente_notificacoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY cn_client_select ON public.cliente_notificacoes FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY cn_client_update ON public.cliente_notificacoes FOR UPDATE TO authenticated
  USING (client_id = public.current_client_id()) WITH CHECK (client_id = public.current_client_id());

CREATE TABLE IF NOT EXISTS public.cliente_comunicacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cliente_usuario_id uuid REFERENCES public.cliente_usuarios(id) ON DELETE SET NULL,
  thread_id uuid,
  autor_tipo text NOT NULL CHECK (autor_tipo IN ('cliente','hse')),
  autor_nome text, assunto text, mensagem text NOT NULL,
  anexo_url text, anexo_nome text,
  status public.cliente_com_status NOT NULL DEFAULT 'aberta',
  parent_id uuid REFERENCES public.cliente_comunicacoes(id) ON DELETE SET NULL,
  created_by uuid, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_comunicacoes TO authenticated;
GRANT ALL ON public.cliente_comunicacoes TO service_role;
ALTER TABLE public.cliente_comunicacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY ccom_internal ON public.cliente_comunicacoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY ccom_client_select ON public.cliente_comunicacoes FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY ccom_client_insert ON public.cliente_comunicacoes FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id() AND autor_tipo = 'cliente');

CREATE TABLE IF NOT EXISTS public.cliente_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cliente_usuario_id uuid REFERENCES public.cliente_usuarios(id) ON DELETE SET NULL,
  pendencia_id uuid REFERENCES public.documentos_pendentes(id) ON DELETE SET NULL,
  execucao_id uuid REFERENCES public.execucao_servicos(id) ON DELETE SET NULL,
  arquivo_url text NOT NULL, arquivo_nome text NOT NULL, mime_type text, tamanho_bytes bigint,
  observacao text, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cliente_uploads TO authenticated;
GRANT ALL ON public.cliente_uploads TO service_role;
ALTER TABLE public.cliente_uploads ENABLE ROW LEVEL SECURITY;
CREATE POLICY cup_internal ON public.cliente_uploads FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE POLICY cup_client_select ON public.cliente_uploads FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY cup_client_insert ON public.cliente_uploads FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id());

CREATE TABLE IF NOT EXISTS public.cliente_logs_acesso (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  cliente_usuario_id uuid REFERENCES public.cliente_usuarios(id) ON DELETE SET NULL,
  acao text NOT NULL, detalhe text, ip text, user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.cliente_logs_acesso TO authenticated;
GRANT ALL ON public.cliente_logs_acesso TO service_role;
ALTER TABLE public.cliente_logs_acesso ENABLE ROW LEVEL SECURITY;
CREATE POLICY clog_internal ON public.cliente_logs_acesso FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));
CREATE POLICY clog_client_select ON public.cliente_logs_acesso FOR SELECT TO authenticated
  USING (client_id = public.current_client_id());
CREATE POLICY clog_client_insert ON public.cliente_logs_acesso FOR INSERT TO authenticated
  WITH CHECK (client_id = public.current_client_id());

-- Policies externas (cliente)
CREATE POLICY proposals_cliente_select ON public.proposals FOR SELECT TO authenticated
  USING (visivel_para_cliente = true AND client_id = public.current_client_id());
CREATE POLICY proposal_items_cliente_select ON public.proposal_items FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.proposals p WHERE p.id = proposal_id
    AND p.visivel_para_cliente = true AND p.client_id = public.current_client_id()));
CREATE POLICY execucao_servicos_cliente_select ON public.execucao_servicos FOR SELECT TO authenticated
  USING (visivel_para_cliente = true AND client_id = public.current_client_id());
CREATE POLICY ordens_servico_cliente_select ON public.ordens_servico FOR SELECT TO authenticated
  USING (visivel_para_cliente = true AND client_id = public.current_client_id());
CREATE POLICY documentos_tecnicos_cliente_select ON public.documentos_tecnicos FOR SELECT TO authenticated
  USING (visivel_para_cliente = true AND status IN ('aprovado','emitido','entregue')
    AND client_id = public.current_client_id());
CREATE POLICY documentos_pendentes_cliente_select ON public.documentos_pendentes FOR SELECT TO authenticated
  USING (visivel_para_cliente = true AND client_id = public.current_client_id());
CREATE POLICY documentos_pendentes_cliente_update ON public.documentos_pendentes FOR UPDATE TO authenticated
  USING (visivel_para_cliente = true AND client_id = public.current_client_id())
  WITH CHECK (client_id = public.current_client_id());
CREATE POLICY clients_self_select ON public.clients FOR SELECT TO authenticated
  USING (id = public.current_client_id());

CREATE TRIGGER trg_cu_updated BEFORE UPDATE ON public.cliente_usuarios FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_cp_updated BEFORE UPDATE ON public.cliente_permissoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ccfg_updated BEFORE UPDATE ON public.cliente_configuracoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_ccom_updated BEFORE UPDATE ON public.cliente_comunicacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE OR REPLACE FUNCTION public.cliente_usuario_after_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.cliente_permissoes(cliente_usuario_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  INSERT INTO public.cliente_configuracoes(client_id, portal_ativo) VALUES (NEW.client_id, true)
  ON CONFLICT (client_id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_cu_ai AFTER INSERT ON public.cliente_usuarios
  FOR EACH ROW EXECUTE FUNCTION public.cliente_usuario_after_insert();

CREATE OR REPLACE FUNCTION public.cliente_log(_acao text, _detalhe text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_user record;
BEGIN
  SELECT id, client_id INTO v_user FROM public.cliente_usuarios WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_user.client_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.cliente_logs_acesso(client_id, cliente_usuario_id, acao, detalhe)
  VALUES (v_user.client_id, v_user.id, _acao, _detalhe);
  UPDATE public.cliente_usuarios SET ultimo_acesso = now() WHERE id = v_user.id;
END $$;

REVOKE EXECUTE ON FUNCTION public.current_client_id() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_client_user() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.cliente_log(text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_client_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_client_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cliente_log(text,text) TO authenticated;
