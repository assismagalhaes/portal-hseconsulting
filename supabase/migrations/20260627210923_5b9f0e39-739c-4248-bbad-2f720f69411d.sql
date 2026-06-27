
-- ============ ENUMs ============
DO $$ BEGIN
  CREATE TYPE public.crm_lead_status AS ENUM ('novo','em_qualificacao','qualificado','nao_qualificado','convertido','perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_lead_origem AS ENUM ('indicacao','cliente_antigo','google','instagram','linkedin','whatsapp','ligacao_ativa','email','evento','parceiro','site','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_etapa AS ENUM ('novo_lead','qualificacao','diagnostico','proposta_elaborar','proposta_enviada','followup','negociacao','fechamento_provavel','ganho','perdido');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_temperatura AS ENUM ('frio','morno','quente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_prioridade AS ENUM ('baixa','normal','alta','urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_followup_tipo AS ENUM ('whatsapp','ligacao','email','reuniao_presencial','reuniao_online','visita_comercial','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_followup_status AS ENUM ('pendente','realizado','reagendado','cancelado','sem_resposta');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_score AS ENUM ('baixo','medio','alto');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.crm_alerta_tipo AS ENUM ('followup_vencido','proposta_sem_retorno','oportunidade_parada','proposta_vencendo','lead_sem_responsavel','quente_sem_acao');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ LEADS ============
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa text NOT NULL,
  cnpj_cpf text,
  contato_nome text,
  contato_cargo text,
  telefone text,
  whatsapp text,
  email text,
  cidade text,
  estado text,
  segmento text,
  qtd_funcionarios int,
  origem public.crm_lead_origem,
  responsavel_id uuid REFERENCES auth.users(id),
  status public.crm_lead_status NOT NULL DEFAULT 'novo',
  observacoes text,
  -- Qualificação BANT
  necessidade text,
  urgencia text,
  orcamento_disponivel text,
  autoridade_decisao text,
  prazo_contratacao text,
  servicos_interesse text[],
  concorrentes text,
  score public.crm_score,
  -- Conversão
  cliente_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  convertido_em timestamptz,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_leads TO authenticated;
GRANT ALL ON public.crm_leads TO service_role;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_leads" ON public.crm_leads FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ OPORTUNIDADES ============
CREATE TABLE public.crm_oportunidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  servico_interesse text,
  valor_estimado numeric(14,2) NOT NULL DEFAULT 0,
  probabilidade int NOT NULL DEFAULT 50 CHECK (probabilidade BETWEEN 0 AND 100),
  data_prevista_fechamento date,
  responsavel_id uuid REFERENCES auth.users(id),
  etapa public.crm_etapa NOT NULL DEFAULT 'novo_lead',
  prioridade public.crm_prioridade NOT NULL DEFAULT 'normal',
  temperatura public.crm_temperatura NOT NULL DEFAULT 'morno',
  observacoes text,
  motivo_perda text,
  motivo_perda_obs text,
  data_ganho timestamptz,
  data_perda timestamptz,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_oportunidades TO authenticated;
GRANT ALL ON public.crm_oportunidades TO service_role;
ALTER TABLE public.crm_oportunidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_oport" ON public.crm_oportunidades FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_oport_etapa ON public.crm_oportunidades(etapa);
CREATE INDEX idx_oport_resp ON public.crm_oportunidades(responsavel_id);
CREATE INDEX idx_oport_client ON public.crm_oportunidades(client_id);
CREATE INDEX idx_oport_lead ON public.crm_oportunidades(lead_id);

-- ============ FOLLOWUPS ============
CREATE TABLE public.crm_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  oportunidade_id uuid REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  tipo public.crm_followup_tipo NOT NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  hora time,
  responsavel_id uuid REFERENCES auth.users(id),
  resumo text,
  proxima_acao text,
  proximo_followup_data date,
  proximo_followup_hora time,
  status public.crm_followup_status NOT NULL DEFAULT 'pendente',
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_followups TO authenticated;
GRANT ALL ON public.crm_followups TO service_role;
ALTER TABLE public.crm_followups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_fup" ON public.crm_followups FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_fup_data ON public.crm_followups(data);
CREATE INDEX idx_fup_status ON public.crm_followups(status);

-- ============ HISTÓRICO ============
CREATE TABLE public.crm_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE,
  oportunidade_id uuid REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  detalhe text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_historico TO authenticated;
GRANT ALL ON public.crm_historico TO service_role;
ALTER TABLE public.crm_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_hist" ON public.crm_historico FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_hist_lead ON public.crm_historico(lead_id);
CREATE INDEX idx_hist_oport ON public.crm_historico(oportunidade_id);
CREATE INDEX idx_hist_client ON public.crm_historico(client_id);

-- ============ ALERTAS ============
CREATE TABLE public.crm_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.crm_alerta_tipo NOT NULL,
  titulo text NOT NULL,
  mensagem text,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  oportunidade_id uuid REFERENCES public.crm_oportunidades(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE CASCADE,
  followup_id uuid REFERENCES public.crm_followups(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES auth.users(id),
  lido boolean NOT NULL DEFAULT false,
  resolvido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_alertas TO authenticated;
GRANT ALL ON public.crm_alertas TO service_role;
ALTER TABLE public.crm_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_alertas" ON public.crm_alertas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ AGENDA COMERCIAL ============
CREATE TABLE public.crm_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'reuniao',
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  local text,
  link text,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  oportunidade_id uuid REFERENCES public.crm_oportunidades(id) ON DELETE SET NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  followup_id uuid REFERENCES public.crm_followups(id) ON DELETE CASCADE,
  responsavel_id uuid REFERENCES auth.users(id),
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_agenda TO authenticated;
GRANT ALL ON public.crm_agenda TO service_role;
ALTER TABLE public.crm_agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_agenda" ON public.crm_agenda FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ MOTIVOS DE PERDA ============
CREATE TABLE public.crm_motivos_perda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_motivos_perda TO authenticated;
GRANT ALL ON public.crm_motivos_perda TO service_role;
ALTER TABLE public.crm_motivos_perda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_read_motivos" ON public.crm_motivos_perda FOR SELECT TO authenticated USING (true);
CREATE POLICY "admin_write_motivos" ON public.crm_motivos_perda FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.crm_motivos_perda(nome, ordem) VALUES
  ('Preço',1),('Prazo',2),('Cliente não respondeu',3),('Fechou com concorrente',4),
  ('Serviço não aprovado internamente',5),('Sem orçamento',6),('Escopo alterado',7),
  ('Decisão adiada',8),('Não era o público-alvo',9),('Outro',10)
ON CONFLICT DO NOTHING;

-- ============ TRIGGERS DE UPDATED_AT ============
CREATE TRIGGER trg_leads_upd BEFORE UPDATE ON public.crm_leads FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_oport_upd BEFORE UPDATE ON public.crm_oportunidades FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_fup_upd BEFORE UPDATE ON public.crm_followups FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_agenda_upd BEFORE UPDATE ON public.crm_agenda FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ AUDIT OPORTUNIDADE ============
CREATE OR REPLACE FUNCTION public.crm_oport_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crm_historico(oportunidade_id, lead_id, client_id, proposal_id, tipo, titulo, detalhe, user_id)
    VALUES (NEW.id, NEW.lead_id, NEW.client_id, NEW.proposal_id, 'oportunidade_criada', 'Oportunidade criada', 'Etapa inicial: '||NEW.etapa::text, auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.crm_historico(oportunidade_id, lead_id, client_id, proposal_id, tipo, titulo, detalhe, user_id)
    VALUES (NEW.id, NEW.lead_id, NEW.client_id, NEW.proposal_id, 'etapa_alterada', 'Mudança de etapa', OLD.etapa::text||' → '||NEW.etapa::text, auth.uid());
    IF NEW.etapa = 'ganho' AND NEW.data_ganho IS NULL THEN NEW.data_ganho := now(); END IF;
    IF NEW.etapa = 'perdido' AND NEW.data_perda IS NULL THEN NEW.data_perda := now(); END IF;
  END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO public.crm_historico(oportunidade_id, lead_id, client_id, tipo, titulo, user_id)
    VALUES (NEW.id, NEW.lead_id, NEW.client_id, 'responsavel_alterado', 'Responsável alterado', auth.uid());
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_oport_audit BEFORE INSERT OR UPDATE ON public.crm_oportunidades
FOR EACH ROW EXECUTE FUNCTION public.crm_oport_audit();

-- ============ AUDIT LEAD ============
CREATE OR REPLACE FUNCTION public.crm_lead_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crm_historico(lead_id, tipo, titulo, detalhe, user_id)
    VALUES (NEW.id, 'lead_criado', 'Lead criado', 'Origem: '||COALESCE(NEW.origem::text,'—'), auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.crm_historico(lead_id, client_id, tipo, titulo, detalhe, user_id)
    VALUES (NEW.id, NEW.cliente_id, 'lead_status', 'Status do lead alterado', OLD.status::text||' → '||NEW.status::text, auth.uid());
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_lead_audit BEFORE INSERT OR UPDATE ON public.crm_leads
FOR EACH ROW EXECUTE FUNCTION public.crm_lead_audit();

-- ============ AUDIT FOLLOWUP ============
CREATE OR REPLACE FUNCTION public.crm_fup_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crm_historico(lead_id, client_id, oportunidade_id, proposal_id, tipo, titulo, detalhe, user_id)
    VALUES (NEW.lead_id, NEW.client_id, NEW.oportunidade_id, NEW.proposal_id, 'followup_registrado',
            'Follow-up '||NEW.tipo::text, COALESCE(NEW.resumo,''), auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_fup_audit AFTER INSERT ON public.crm_followups
FOR EACH ROW EXECUTE FUNCTION public.crm_fup_audit();

-- ============ SINCRONIZAR PROPOSTA → OPORTUNIDADE ============
CREATE OR REPLACE FUNCTION public.crm_sync_proposta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_op_id uuid;
  v_nova_etapa public.crm_etapa;
BEGIN
  -- Mapeia status da proposta para etapa
  v_nova_etapa := CASE NEW.status
    WHEN 'enviada' THEN 'proposta_enviada'::public.crm_etapa
    WHEN 'em_negociacao' THEN 'negociacao'::public.crm_etapa
    WHEN 'aprovada' THEN 'ganho'::public.crm_etapa
    WHEN 'recusada' THEN 'perdido'::public.crm_etapa
    WHEN 'cancelada' THEN 'perdido'::public.crm_etapa
    ELSE NULL
  END;

  IF v_nova_etapa IS NULL THEN RETURN NEW; END IF;

  SELECT id INTO v_op_id FROM public.crm_oportunidades WHERE proposal_id = NEW.id LIMIT 1;

  IF v_op_id IS NULL THEN
    -- Cria oportunidade automaticamente
    INSERT INTO public.crm_oportunidades(titulo, client_id, proposal_id, valor_estimado, etapa, responsavel_id, created_by)
    VALUES (
      COALESCE(NEW.titulo, 'Proposta '||COALESCE(NEW.numero,'')),
      NEW.client_id, NEW.id,
      COALESCE(NEW.valor_total, 0),
      v_nova_etapa,
      NEW.created_by, NEW.created_by
    );
  ELSE
    UPDATE public.crm_oportunidades
      SET etapa = v_nova_etapa,
          valor_estimado = COALESCE(NEW.valor_total, valor_estimado),
          updated_at = now()
      WHERE id = v_op_id AND etapa IS DISTINCT FROM v_nova_etapa;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_crm_sync_proposta AFTER INSERT OR UPDATE OF status, valor_total ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.crm_sync_proposta();

-- ============ CONVERSÃO LEAD → CLIENTE ============
CREATE OR REPLACE FUNCTION public.crm_converter_lead(_lead_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  l record;
  v_client_id uuid;
BEGIN
  SELECT * INTO l FROM public.crm_leads WHERE id = _lead_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Lead não encontrado'; END IF;

  IF l.cliente_id IS NOT NULL THEN RETURN l.cliente_id; END IF;

  -- Busca cliente existente por CNPJ/CPF
  IF l.cnpj_cpf IS NOT NULL THEN
    SELECT id INTO v_client_id FROM public.clients WHERE cnpj_cpf = l.cnpj_cpf LIMIT 1;
  END IF;

  IF v_client_id IS NULL THEN
    INSERT INTO public.clients(razao_social, nome_fantasia, cnpj_cpf, contato_nome, contato_cargo,
      contato_email, contato_telefone, cidade, estado, segmento)
    VALUES (l.empresa, l.empresa, l.cnpj_cpf, l.contato_nome, l.contato_cargo,
      l.email, COALESCE(l.whatsapp, l.telefone), l.cidade, l.estado, l.segmento)
    RETURNING id INTO v_client_id;
  END IF;

  UPDATE public.crm_leads
    SET cliente_id = v_client_id, status = 'convertido', convertido_em = now()
    WHERE id = _lead_id;

  -- Atualiza oportunidades vinculadas
  UPDATE public.crm_oportunidades SET client_id = v_client_id WHERE lead_id = _lead_id AND client_id IS NULL;

  INSERT INTO public.crm_historico(lead_id, client_id, tipo, titulo, detalhe, user_id)
  VALUES (_lead_id, v_client_id, 'lead_convertido', 'Lead convertido em cliente', NULL, auth.uid());

  RETURN v_client_id;
END $$;
