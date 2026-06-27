
-- ========================================
-- ENUMS
-- ========================================
CREATE TYPE public.execucao_status AS ENUM (
  'aguardando_inicio','planejamento','aguardando_documentacao','agendado',
  'em_execucao','em_revisao_tecnica','aguardando_aprovacao_cliente',
  'concluido','suspenso','cancelado'
);

CREATE TYPE public.execucao_prioridade AS ENUM ('baixa','normal','alta','urgente');

CREATE TYPE public.checklist_situacao AS ENUM ('pendente','em_andamento','concluido');

CREATE TYPE public.profissional_situacao AS ENUM ('ativo','inativo','ferias','afastado');

-- ========================================
-- PROFISSIONAIS
-- ========================================
CREATE TABLE public.execucao_profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  cargo text,
  area text,
  especialidade text,
  registro_profissional text,
  email text,
  telefone text,
  situacao profissional_situacao NOT NULL DEFAULT 'ativo',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execucao_profissionais TO authenticated;
GRANT ALL ON public.execucao_profissionais TO service_role;
ALTER TABLE public.execucao_profissionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read profissionais" ON public.execucao_profissionais
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "comercial admin write profissionais" ON public.execucao_profissionais
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial'));
CREATE TRIGGER set_updated_at_profissionais
  BEFORE UPDATE ON public.execucao_profissionais
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ========================================
-- EXECUCAO_SERVICOS
-- ========================================
CREATE SEQUENCE IF NOT EXISTS public.execucao_numero_seq START 1000;

CREATE TABLE public.execucao_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_interno text NOT NULL UNIQUE DEFAULT ('OS-' || lpad(nextval('public.execucao_numero_seq')::text, 5, '0')),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  proposal_item_id uuid NOT NULL REFERENCES public.proposal_items(id) ON DELETE CASCADE,
  proposal_revision_id uuid REFERENCES public.proposal_revisions(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  responsavel_comercial uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_tecnico_id uuid REFERENCES public.execucao_profissionais(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  descricao text,
  escopo_tecnico text,
  categoria text,
  unidade text,
  quantidade numeric(14,2) NOT NULL DEFAULT 1,
  valor_contratado numeric(14,2) NOT NULL DEFAULT 0,
  cidade text,
  prioridade execucao_prioridade NOT NULL DEFAULT 'normal',
  status execucao_status NOT NULL DEFAULT 'aguardando_inicio',
  data_aprovacao date,
  data_prevista_inicio date,
  data_prevista_conclusao date,
  data_real_inicio date,
  data_real_conclusao date,
  observacoes_internas text,
  -- preparação Portal do Cliente
  visivel_cliente boolean NOT NULL DEFAULT false,
  resumo_cliente text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  UNIQUE (proposal_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execucao_servicos TO authenticated;
GRANT ALL ON public.execucao_servicos TO service_role;
ALTER TABLE public.execucao_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read execucao" ON public.execucao_servicos
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert execucao" ON public.execucao_servicos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth update execucao" ON public.execucao_servicos
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "admin comercial delete execucao" ON public.execucao_servicos
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'comercial'));
CREATE TRIGGER set_updated_at_execucao
  BEFORE UPDATE ON public.execucao_servicos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_execucao_proposal ON public.execucao_servicos(proposal_id);
CREATE INDEX idx_execucao_client ON public.execucao_servicos(client_id);
CREATE INDEX idx_execucao_status ON public.execucao_servicos(status);
CREATE INDEX idx_execucao_resp_tecnico ON public.execucao_servicos(responsavel_tecnico_id);

-- ========================================
-- EQUIPE DE APOIO
-- ========================================
CREATE TABLE public.execucao_servico_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.execucao_servicos(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES public.execucao_profissionais(id) ON DELETE CASCADE,
  papel text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(execucao_id, profissional_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execucao_servico_equipe TO authenticated;
GRANT ALL ON public.execucao_servico_equipe TO service_role;
ALTER TABLE public.execucao_servico_equipe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all equipe" ON public.execucao_servico_equipe
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ========================================
-- CHECKLISTS
-- ========================================
CREATE TABLE public.execucao_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.execucao_servicos(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  descricao text NOT NULL,
  responsavel_id uuid REFERENCES public.execucao_profissionais(id) ON DELETE SET NULL,
  data_prevista date,
  data_realizada date,
  situacao checklist_situacao NOT NULL DEFAULT 'pendente',
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execucao_checklists TO authenticated;
GRANT ALL ON public.execucao_checklists TO service_role;
ALTER TABLE public.execucao_checklists ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all checklists" ON public.execucao_checklists
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER set_updated_at_checklists
  BEFORE UPDATE ON public.execucao_checklists
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_checklists_exec ON public.execucao_checklists(execucao_id);

-- ========================================
-- OBSERVAÇÕES TÉCNICAS (internas)
-- ========================================
CREATE TABLE public.execucao_observacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.execucao_servicos(id) ON DELETE CASCADE,
  texto text NOT NULL,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execucao_observacoes TO authenticated;
GRANT ALL ON public.execucao_observacoes TO service_role;
ALTER TABLE public.execucao_observacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all obs" ON public.execucao_observacoes
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_obs_exec ON public.execucao_observacoes(execucao_id);

-- ========================================
-- TIMELINE
-- ========================================
CREATE TABLE public.execucao_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.execucao_servicos(id) ON DELETE CASCADE,
  evento text NOT NULL,
  detalhe text,
  metadata jsonb,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.execucao_timeline TO authenticated;
GRANT ALL ON public.execucao_timeline TO service_role;
ALTER TABLE public.execucao_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read timeline" ON public.execucao_timeline
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert timeline" ON public.execucao_timeline
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_timeline_exec ON public.execucao_timeline(execucao_id, created_at DESC);

-- ========================================
-- ANEXOS
-- ========================================
CREATE TABLE public.execucao_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.execucao_servicos(id) ON DELETE CASCADE,
  nome_arquivo text NOT NULL,
  bucket text NOT NULL DEFAULT 'execucao-anexos',
  storage_path text NOT NULL,
  mime_type text,
  tamanho_bytes bigint,
  descricao text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.execucao_anexos TO authenticated;
GRANT ALL ON public.execucao_anexos TO service_role;
ALTER TABLE public.execucao_anexos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all anexos" ON public.execucao_anexos
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_anexos_exec ON public.execucao_anexos(execucao_id);

-- ========================================
-- HISTÓRICO (auditoria)
-- ========================================
CREATE TABLE public.execucao_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  execucao_id uuid NOT NULL REFERENCES public.execucao_servicos(id) ON DELETE CASCADE,
  acao text NOT NULL,
  campo text,
  valor_anterior text,
  valor_novo text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.execucao_historico TO authenticated;
GRANT ALL ON public.execucao_historico TO service_role;
ALTER TABLE public.execucao_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read historico" ON public.execucao_historico
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth insert historico" ON public.execucao_historico
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_hist_exec ON public.execucao_historico(execucao_id, created_at DESC);

-- ========================================
-- FUNÇÃO: criar execuções a partir de proposta aprovada
-- ========================================
CREATE OR REPLACE FUNCTION public.criar_execucoes_da_proposta(_proposal_id uuid)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  prop record;
  item record;
  ultima_rev uuid;
  criadas int := 0;
BEGIN
  SELECT * INTO prop FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  SELECT id INTO ultima_rev FROM public.proposal_revisions
   WHERE proposal_id = _proposal_id ORDER BY revisao DESC LIMIT 1;

  FOR item IN
    SELECT * FROM public.proposal_items WHERE proposal_id = _proposal_id
  LOOP
    BEGIN
      INSERT INTO public.execucao_servicos (
        proposal_id, proposal_item_id, proposal_revision_id, client_id, service_id,
        responsavel_comercial, titulo, descricao, escopo_tecnico, categoria, unidade,
        quantidade, valor_contratado, data_aprovacao, created_by
      ) VALUES (
        prop.id, item.id, ultima_rev, prop.client_id, item.service_id,
        prop.created_by,
        COALESCE(item.nome, 'Serviço'),
        item.descricao_comercial,
        item.escopo_tecnico,
        item.categoria,
        item.unidade,
        COALESCE(item.quantidade,1),
        COALESCE(item.valor_total, item.valor_unitario * COALESCE(item.quantidade,1), 0),
        CURRENT_DATE,
        auth.uid()
      );
      criadas := criadas + 1;
    EXCEPTION WHEN unique_violation THEN
      -- já existe execução para este item, ignora
      NULL;
    END;
  END LOOP;

  RETURN criadas;
END $$;

REVOKE EXECUTE ON FUNCTION public.criar_execucoes_da_proposta(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.criar_execucoes_da_proposta(uuid) TO authenticated, service_role;

-- ========================================
-- ATUALIZA o trigger on_proposal_status_change para também criar execuções
-- ========================================
CREATE OR REPLACE FUNCTION public.on_proposal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE next_rev int;
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    INSERT INTO public.approved_services (proposal_id, proposal_item_id)
    SELECT NEW.id, pi.id FROM public.proposal_items pi
    WHERE pi.proposal_id = NEW.id
    AND NOT EXISTS (SELECT 1 FROM public.approved_services a WHERE a.proposal_item_id = pi.id);

    PERFORM public.criar_execucoes_da_proposta(NEW.id);
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COALESCE(MAX(revisao),0)+1 INTO next_rev FROM public.proposal_revisions WHERE proposal_id = NEW.id;
    INSERT INTO public.proposal_revisions (proposal_id, revisao, titulo, descricao, user_id)
    VALUES (NEW.id, next_rev, 'Status alterado', 'De "' || OLD.status || '" para "' || NEW.status || '"', auth.uid());
  END IF;

  RETURN NEW;
END $$;

-- ========================================
-- TRIGGER timeline + histórico em execucao_servicos
-- ========================================
CREATE OR REPLACE FUNCTION public.execucao_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.execucao_timeline(execucao_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Serviço criado', 'Status inicial: ' || NEW.status::text, auth.uid());
    INSERT INTO public.execucao_historico(execucao_id, acao, user_id)
    VALUES (NEW.id, 'criado', auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.execucao_timeline(execucao_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Mudança de status', OLD.status::text || ' → ' || NEW.status::text, auth.uid());
    INSERT INTO public.execucao_historico(execucao_id, acao, campo, valor_anterior, valor_novo, user_id)
    VALUES (NEW.id, 'alterado', 'status', OLD.status::text, NEW.status::text, auth.uid());
    IF NEW.status = 'concluido' AND NEW.data_real_conclusao IS NULL THEN
      NEW.data_real_conclusao := CURRENT_DATE;
    END IF;
    IF NEW.status = 'em_execucao' AND NEW.data_real_inicio IS NULL THEN
      NEW.data_real_inicio := CURRENT_DATE;
    END IF;
  END IF;

  IF NEW.responsavel_tecnico_id IS DISTINCT FROM OLD.responsavel_tecnico_id THEN
    INSERT INTO public.execucao_timeline(execucao_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Responsável técnico alterado', NULL, auth.uid());
    INSERT INTO public.execucao_historico(execucao_id, acao, campo, valor_anterior, valor_novo, user_id)
    VALUES (NEW.id, 'alterado', 'responsavel_tecnico_id', OLD.responsavel_tecnico_id::text, NEW.responsavel_tecnico_id::text, auth.uid());
  END IF;

  IF NEW.data_prevista_conclusao IS DISTINCT FROM OLD.data_prevista_conclusao THEN
    INSERT INTO public.execucao_timeline(execucao_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Prazo alterado', 'Nova previsão: ' || COALESCE(NEW.data_prevista_conclusao::text,'—'), auth.uid());
  END IF;

  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    INSERT INTO public.execucao_timeline(execucao_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Prioridade alterada', OLD.prioridade::text || ' → ' || NEW.prioridade::text, auth.uid());
  END IF;

  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;

CREATE TRIGGER trg_execucao_insert
  AFTER INSERT ON public.execucao_servicos
  FOR EACH ROW EXECUTE FUNCTION public.execucao_audit();

CREATE TRIGGER trg_execucao_update
  BEFORE UPDATE ON public.execucao_servicos
  FOR EACH ROW EXECUTE FUNCTION public.execucao_audit();

-- ========================================
-- Backfill: cria execuções para propostas já aprovadas
-- ========================================
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.proposals WHERE status = 'aprovada' LOOP
    PERFORM public.criar_execucoes_da_proposta(p.id);
  END LOOP;
END $$;
