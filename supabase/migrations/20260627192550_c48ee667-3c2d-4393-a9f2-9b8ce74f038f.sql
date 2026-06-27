
-- ENUMs
CREATE TYPE public.app_role AS ENUM ('admin', 'comercial', 'tecnico');
CREATE TYPE public.proposal_status AS ENUM ('rascunho','enviada','negociacao','aprovada','recusada','expirada');
CREATE TYPE public.exec_status AS ENUM ('pendente','em_andamento','concluido','cancelado');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  telefone TEXT,
  cargo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles select auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles update self" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles insert self" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- USER ROLES
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_see_internal(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin') OR public.has_role(_user_id,'comercial')
$$;

CREATE POLICY "user_roles select self or admin" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "user_roles admin manage" ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Trigger to create profile + bootstrap admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE existing_count INT;
BEGIN
  INSERT INTO public.profiles (id, nome, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT count(*) INTO existing_count FROM public.user_roles;
  IF existing_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles(user_id, role) VALUES (NEW.id, 'comercial')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CLIENTES
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  razao_social TEXT NOT NULL,
  nome_fantasia TEXT,
  cnpj_cpf TEXT,
  qtd_funcionarios INT,
  cidade TEXT,
  uf TEXT,
  solicitante TEXT,
  telefone TEXT,
  email TEXT,
  observacoes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_clients_cnpj ON public.clients(cnpj_cpf);
CREATE INDEX idx_clients_razao ON public.clients(lower(razao_social));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT ALL ON public.clients TO service_role;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clients all authenticated" ON public.clients FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- SERVIÇOS
CREATE TABLE public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao_comercial TEXT,
  escopo_tecnico TEXT,
  unidade_padrao TEXT DEFAULT 'serv',
  valor_referencia NUMERIC(14,2),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_services_nome ON public.services(lower(nome));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated;
GRANT ALL ON public.services TO service_role;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "services all authenticated" ON public.services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PARÂMETROS DE PRECIFICAÇÃO (singleton-ish)
CREATE TABLE public.pricing_params (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  custo_fixo_mensal NUMERIC(14,2) NOT NULL DEFAULT 0,
  horas_produtivas_mes NUMERIC(10,2) NOT NULL DEFAULT 160,
  aliquota_imposto NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  margem_minima NUMERIC(6,4) NOT NULL DEFAULT 0.20,
  custo_por_vida NUMERIC(10,2) NOT NULL DEFAULT 0,
  markup_minimo NUMERIC(6,4) NOT NULL DEFAULT 1.5,
  arredondamento NUMERIC(10,2) NOT NULL DEFAULT 10,
  condicoes_pagamento_default TEXT NOT NULL DEFAULT '1ª parcela: 50% no aceite da proposta.
2ª parcela: 50% após a entrega do serviço.
HSE Consulting emitirá nota fiscal de prestação do serviço.
Pagamento via boleto bancário e/ou transferência bancária.',
  outras_condicoes_default TEXT NOT NULL DEFAULT '- Disponibilização de via física e/ou digital do documento, quando aplicável.
- A contratação não engloba treinamentos, campanhas ou outros objetos não descritos no escopo.
- Visita in loco e registro fotográfico, quando aplicável.
- Registros fotográficos serão utilizados exclusivamente para elaboração do documento.
- Equipamentos de medição com certificados de calibração válidos, quando aplicável.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pricing_params TO authenticated;
GRANT ALL ON public.pricing_params TO service_role;
ALTER TABLE public.pricing_params ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pricing_params read internal" ON public.pricing_params FOR SELECT TO authenticated
USING (public.can_see_internal(auth.uid()));
CREATE POLICY "pricing_params write admin/com" ON public.pricing_params FOR ALL TO authenticated
USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_pp_updated BEFORE UPDATE ON public.pricing_params FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.pricing_params DEFAULT VALUES;

-- PROPOSTAS
CREATE SEQUENCE IF NOT EXISTS public.proposal_seq START 1;
CREATE TABLE public.proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE DEFAULT ('HSE-' || to_char(now(),'YYYY') || '-' || lpad(nextval('public.proposal_seq')::text,4,'0')),
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  status public.proposal_status NOT NULL DEFAULT 'rascunho',
  validade DATE,
  data_envio DATE,
  proximo_followup DATE,
  observacoes_internas TEXT,
  observacoes_comerciais TEXT,
  condicoes_pagamento TEXT,
  outras_condicoes TEXT,
  aceite_data DATE,
  assinatura_prestador TEXT,
  assinatura_tomador TEXT,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposals TO authenticated;
GRANT ALL ON public.proposals TO service_role;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposals all authenticated" ON public.proposals FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_proposals_updated BEFORE UPDATE ON public.proposals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ITENS DE PROPOSTA
CREATE TABLE public.proposal_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  numero_item INT NOT NULL DEFAULT 1,
  descricao_comercial TEXT NOT NULL,
  escopo_tecnico TEXT,
  quantidade NUMERIC(12,2) NOT NULL DEFAULT 1,
  unidade TEXT NOT NULL DEFAULT 'serv',
  valor_unitario NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pi_proposal ON public.proposal_items(proposal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_items TO authenticated;
GRANT ALL ON public.proposal_items TO service_role;
ALTER TABLE public.proposal_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "proposal_items all authenticated" ON public.proposal_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_pi_updated BEFORE UPDATE ON public.proposal_items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRECIFICAÇÃO INTERNA DO ITEM
CREATE TABLE public.proposal_item_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_item_id UUID NOT NULL UNIQUE REFERENCES public.proposal_items(id) ON DELETE CASCADE,
  custos JSONB NOT NULL DEFAULT '{}'::jsonb,
  horas JSONB NOT NULL DEFAULT '{}'::jsonb,
  aliquota_imposto NUMERIC(6,4) NOT NULL DEFAULT 0.10,
  margem_desejada NUMERIC(6,4) NOT NULL DEFAULT 0.20,
  lucro_desejado NUMERIC(14,2) NOT NULL DEFAULT 0,
  desconto_comercial NUMERIC(14,2) NOT NULL DEFAULT 0,
  preco_sugerido NUMERIC(14,2) NOT NULL DEFAULT 0,
  preco_arredondado NUMERIC(14,2) NOT NULL DEFAULT 0,
  preco_aprovado NUMERIC(14,2) NOT NULL DEFAULT 0,
  indicadores JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_item_pricing TO authenticated;
GRANT ALL ON public.proposal_item_pricing TO service_role;
ALTER TABLE public.proposal_item_pricing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pip read internal" ON public.proposal_item_pricing FOR SELECT TO authenticated
USING (public.can_see_internal(auth.uid()));
CREATE POLICY "pip write internal" ON public.proposal_item_pricing FOR ALL TO authenticated
USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_pip_updated BEFORE UPDATE ON public.proposal_item_pricing FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- REVISÕES
CREATE TABLE public.proposal_revisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  revisao INT NOT NULL DEFAULT 1,
  descricao TEXT,
  user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_revisions TO authenticated;
GRANT ALL ON public.proposal_revisions TO service_role;
ALTER TABLE public.proposal_revisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rev all authenticated" ON public.proposal_revisions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- SERVIÇOS APROVADOS/EXECUÇÃO
CREATE TABLE public.approved_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id UUID NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  proposal_item_id UUID NOT NULL REFERENCES public.proposal_items(id) ON DELETE CASCADE,
  responsavel_id UUID REFERENCES auth.users(id),
  prazo_previsto DATE,
  status public.exec_status NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approved_services TO authenticated;
GRANT ALL ON public.approved_services TO service_role;
ALTER TABLE public.approved_services ENABLE ROW LEVEL SECURITY;
CREATE POLICY "as all authenticated" ON public.approved_services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_as_updated BEFORE UPDATE ON public.approved_services FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Trigger: ao marcar proposta como aprovada, gerar approved_services para cada item
CREATE OR REPLACE FUNCTION public.on_proposal_status_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    INSERT INTO public.approved_services (proposal_id, proposal_item_id)
    SELECT NEW.id, pi.id FROM public.proposal_items pi
    WHERE pi.proposal_id = NEW.id
    AND NOT EXISTS (SELECT 1 FROM public.approved_services a WHERE a.proposal_item_id = pi.id);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_proposal_status AFTER UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.on_proposal_status_change();
