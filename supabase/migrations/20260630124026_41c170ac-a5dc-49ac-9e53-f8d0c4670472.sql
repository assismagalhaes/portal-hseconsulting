
-- ============ AJUSTE OS execucao_id opcional ============
ALTER TABLE public.ordens_servico ALTER COLUMN execucao_id DROP NOT NULL;

-- ============ FIX BUG os_audit: BEFORE (defaults) + AFTER (timeline) ============
CREATE OR REPLACE FUNCTION public.os_audit_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.cliente_nome IS NULL AND NEW.client_id IS NOT NULL THEN
      SELECT COALESCE(nome_fantasia, razao_social) INTO NEW.cliente_nome FROM public.clients WHERE id = NEW.client_id;
    END IF;
    IF NEW.servico_nome IS NULL AND NEW.service_id IS NOT NULL THEN
      SELECT nome INTO NEW.servico_nome FROM public.services WHERE id = NEW.service_id;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'em_campo' AND NEW.data_real_inicio IS NULL THEN NEW.data_real_inicio := CURRENT_DATE; END IF;
    IF NEW.status = 'finalizada' AND NEW.data_real_conclusao IS NULL THEN
      NEW.data_real_conclusao := CURRENT_DATE; NEW.percentual_executado := 100;
    END IF;
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.os_audit_after()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.os_timeline(os_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'OS criada', 'Status inicial: ' || NEW.status::text, auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.os_timeline(os_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Mudança de status', OLD.status::text || ' → ' || NEW.status::text, auth.uid());
  END IF;
  IF NEW.prioridade IS DISTINCT FROM OLD.prioridade THEN
    INSERT INTO public.os_timeline(os_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Prioridade alterada', OLD.prioridade::text || ' → ' || NEW.prioridade::text, auth.uid());
  END IF;
  IF NEW.responsavel_tecnico_id IS DISTINCT FROM OLD.responsavel_tecnico_id THEN
    INSERT INTO public.os_timeline(os_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Responsável técnico alterado', NULL, auth.uid());
  END IF;
  IF NEW.data_prevista_conclusao IS DISTINCT FROM OLD.data_prevista_conclusao THEN
    INSERT INTO public.os_timeline(os_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Prazo alterado', 'Nova previsão: ' || COALESCE(NEW.data_prevista_conclusao::text,'—'), auth.uid());
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_os_audit_ins ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_os_audit_upd ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_os_audit_before ON public.ordens_servico;
DROP TRIGGER IF EXISTS trg_os_audit_after ON public.ordens_servico;
CREATE TRIGGER trg_os_audit_before BEFORE INSERT OR UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_audit_before();
CREATE TRIGGER trg_os_audit_after AFTER INSERT OR UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_audit_after();

-- ============ SEQUENCE + ENUMS ============
CREATE SEQUENCE IF NOT EXISTS public.projeto_numero_seq START 1;
DO $$ BEGIN
  CREATE TYPE public.projeto_status AS ENUM ('planejamento','em_execucao','em_revisao','concluido','atrasado','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE public.projeto_servico_status AS ENUM ('pendente','em_andamento','concluido','cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ TABELAS ============
CREATE TABLE IF NOT EXISTS public.projetos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE,
  titulo text NOT NULL,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  financeiro_contrato_id uuid REFERENCES public.financeiro_contratos(id) ON DELETE SET NULL,
  status public.projeto_status NOT NULL DEFAULT 'planejamento',
  gestor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  responsavel_comercial_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  valor_contratado numeric(14,2) DEFAULT 0,
  data_inicio date, data_fim_prevista date, data_fim_real date,
  percentual_progresso int NOT NULL DEFAULT 0,
  observacoes text,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO authenticated;
GRANT ALL ON public.projetos TO service_role;
ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projetos_select" ON public.projetos FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()) OR gestor_id = auth.uid() OR responsavel_comercial_id = auth.uid());
CREATE POLICY "projetos_modify" ON public.projetos FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid()) OR gestor_id = auth.uid())
  WITH CHECK (public.can_see_internal(auth.uid()) OR gestor_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_projetos_client ON public.projetos(client_id);
CREATE INDEX IF NOT EXISTS idx_projetos_proposal ON public.projetos(proposal_id);
CREATE INDEX IF NOT EXISTS idx_projetos_status ON public.projetos(status);

CREATE TABLE IF NOT EXISTS public.projeto_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  proposal_item_id uuid REFERENCES public.proposal_items(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  nome text NOT NULL,
  categoria text,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.projeto_servico_status NOT NULL DEFAULT 'pendente',
  percentual_progresso int NOT NULL DEFAULT 0,
  valor numeric(14,2) DEFAULT 0,
  quantidade numeric(12,3) DEFAULT 1,
  unidade text,
  validade_meses int, data_validade date,
  data_inicio date, data_conclusao date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_servicos TO authenticated;
GRANT ALL ON public.projeto_servicos TO service_role;
ALTER TABLE public.projeto_servicos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projeto_servicos_all" ON public.projeto_servicos FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND
    (public.can_see_internal(auth.uid()) OR p.gestor_id = auth.uid() OR p.responsavel_comercial_id = auth.uid() OR projeto_servicos.responsavel_id = auth.uid())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND
    (public.can_see_internal(auth.uid()) OR p.gestor_id = auth.uid())));
CREATE INDEX IF NOT EXISTS idx_projeto_servicos_projeto ON public.projeto_servicos(projeto_id);
CREATE INDEX IF NOT EXISTS idx_projeto_servicos_validade ON public.projeto_servicos(data_validade);

CREATE TABLE IF NOT EXISTS public.projeto_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  evento text NOT NULL, detalhe text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.projeto_timeline TO authenticated;
GRANT ALL ON public.projeto_timeline TO service_role;
ALTER TABLE public.projeto_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projeto_timeline_select" ON public.projeto_timeline FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = projeto_id AND
    (public.can_see_internal(auth.uid()) OR p.gestor_id = auth.uid() OR p.responsavel_comercial_id = auth.uid())));
CREATE POLICY "projeto_timeline_insert" ON public.projeto_timeline FOR INSERT TO authenticated WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_projeto_timeline_projeto ON public.projeto_timeline(projeto_id);

CREATE TABLE IF NOT EXISTS public.projeto_renovacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  projeto_id uuid NOT NULL REFERENCES public.projetos(id) ON DELETE CASCADE,
  projeto_servico_id uuid REFERENCES public.projeto_servicos(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  data_validade date NOT NULL,
  status text NOT NULL DEFAULT 'pendente',
  oportunidade_id uuid REFERENCES public.crm_oportunidades(id) ON DELETE SET NULL,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (projeto_servico_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projeto_renovacoes TO authenticated;
GRANT ALL ON public.projeto_renovacoes TO service_role;
ALTER TABLE public.projeto_renovacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "projeto_renovacoes_all" ON public.projeto_renovacoes FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- ============ AJUSTES EM TABELAS EXISTENTES ============
ALTER TABLE public.ordens_servico ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_os_projeto ON public.ordens_servico(projeto_id);
ALTER TABLE public.documentos_tecnicos ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_doc_projeto ON public.documentos_tecnicos(projeto_id);
ALTER TABLE public.financeiro_contratos ADD COLUMN IF NOT EXISTS projeto_id uuid REFERENCES public.projetos(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_fin_contrato_projeto ON public.financeiro_contratos(projeto_id);
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS validade_padrao_meses int;

-- ============ TRIGGERS updated_at ============
DROP TRIGGER IF EXISTS trg_projetos_updated ON public.projetos;
CREATE TRIGGER trg_projetos_updated BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_projeto_servicos_updated ON public.projeto_servicos;
CREATE TRIGGER trg_projeto_servicos_updated BEFORE UPDATE ON public.projeto_servicos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
DROP TRIGGER IF EXISTS trg_projeto_renovacoes_updated ON public.projeto_renovacoes;
CREATE TRIGGER trg_projeto_renovacoes_updated BEFORE UPDATE ON public.projeto_renovacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ FUNÇÕES ============
CREATE OR REPLACE FUNCTION public.gerar_numero_projeto()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE n bigint; BEGIN
  n := nextval('public.projeto_numero_seq');
  RETURN 'PRJ-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 5, '0');
END $$;

CREATE OR REPLACE FUNCTION public.projeto_recalcular_progresso(_projeto_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_avg int; v_total int; v_concluidos int; v_em_andamento int;
        v_novo_status public.projeto_status; v_atual public.projeto_status; v_data_fim date;
BEGIN
  SELECT COALESCE(AVG(percentual_progresso)::int, 0), COUNT(*),
         COUNT(*) FILTER (WHERE status = 'concluido'),
         COUNT(*) FILTER (WHERE status = 'em_andamento')
    INTO v_avg, v_total, v_concluidos, v_em_andamento
    FROM public.projeto_servicos WHERE projeto_id = _projeto_id;
  SELECT status, data_fim_prevista INTO v_atual, v_data_fim FROM public.projetos WHERE id = _projeto_id;
  IF v_atual = 'cancelado' THEN v_novo_status := v_atual;
  ELSIF v_total > 0 AND v_concluidos = v_total THEN v_novo_status := 'concluido';
  ELSIF v_em_andamento > 0 OR v_avg > 0 THEN v_novo_status := 'em_execucao';
  ELSE v_novo_status := 'planejamento'; END IF;
  IF v_novo_status <> 'concluido' AND v_data_fim IS NOT NULL AND v_data_fim < CURRENT_DATE THEN v_novo_status := 'atrasado'; END IF;
  UPDATE public.projetos
    SET percentual_progresso = v_avg, status = v_novo_status,
        data_fim_real = CASE WHEN v_novo_status = 'concluido' AND data_fim_real IS NULL THEN CURRENT_DATE ELSE data_fim_real END,
        updated_at = now()
    WHERE id = _projeto_id;
END $$;

CREATE OR REPLACE FUNCTION public.projeto_servicos_after_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN PERFORM public.projeto_recalcular_progresso(OLD.projeto_id); RETURN OLD; END IF;
  PERFORM public.projeto_recalcular_progresso(NEW.projeto_id);
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_projeto_servicos_recalc ON public.projeto_servicos;
CREATE TRIGGER trg_projeto_servicos_recalc AFTER INSERT OR UPDATE OR DELETE ON public.projeto_servicos
  FOR EACH ROW EXECUTE FUNCTION public.projeto_servicos_after_change();

CREATE OR REPLACE FUNCTION public.projeto_servicos_before()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'concluido' AND NEW.data_conclusao IS NULL THEN
    NEW.data_conclusao := CURRENT_DATE; NEW.percentual_progresso := 100;
  END IF;
  IF NEW.validade_meses IS NOT NULL AND NEW.data_conclusao IS NOT NULL AND NEW.data_validade IS NULL THEN
    NEW.data_validade := NEW.data_conclusao + (NEW.validade_meses || ' months')::interval;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_projeto_servicos_before ON public.projeto_servicos;
CREATE TRIGGER trg_projeto_servicos_before BEFORE INSERT OR UPDATE ON public.projeto_servicos
  FOR EACH ROW EXECUTE FUNCTION public.projeto_servicos_before();

CREATE OR REPLACE FUNCTION public.criar_projeto_da_proposta(_proposal_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prop record; item record;
        v_projeto_id uuid; v_os_id uuid; v_contrato_id uuid;
        v_numero text; v_os_numero text; v_validade int;
BEGIN
  SELECT id INTO v_projeto_id FROM public.projetos WHERE proposal_id = _proposal_id;
  IF v_projeto_id IS NOT NULL THEN RETURN v_projeto_id; END IF;
  SELECT * INTO prop FROM public.proposals WHERE id = _proposal_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  v_numero := public.gerar_numero_projeto();
  SELECT id INTO v_contrato_id FROM public.financeiro_contratos WHERE proposal_id = _proposal_id LIMIT 1;

  INSERT INTO public.projetos(numero, titulo, proposal_id, client_id, financeiro_contrato_id,
    status, responsavel_comercial_id, valor_contratado, data_inicio, created_by)
  VALUES (v_numero, 'Projeto ' || COALESCE(prop.numero,''),
    _proposal_id, prop.client_id, v_contrato_id,
    'planejamento', prop.created_by, COALESCE(prop.valor_total,0),
    CURRENT_DATE, prop.created_by) RETURNING id INTO v_projeto_id;

  IF v_contrato_id IS NOT NULL THEN
    UPDATE public.financeiro_contratos SET projeto_id = v_projeto_id WHERE id = v_contrato_id;
  END IF;

  FOR item IN SELECT pi.*, s.validade_padrao_meses FROM public.proposal_items pi
              LEFT JOIN public.services s ON s.id = pi.service_id
              WHERE pi.proposal_id = _proposal_id LOOP
    v_validade := item.validade_padrao_meses;
    INSERT INTO public.projeto_servicos(projeto_id, proposal_item_id, service_id, nome, categoria,
      valor, quantidade, unidade, validade_meses)
    VALUES (v_projeto_id, item.id, item.service_id,
      COALESCE(item.nome,'Serviço'), item.categoria,
      COALESCE(item.valor_total, item.valor_unitario * COALESCE(item.quantidade,1), 0),
      COALESCE(item.quantidade,1), item.unidade, v_validade);
  END LOOP;

  v_os_numero := public.gerar_numero_os();
  INSERT INTO public.ordens_servico(numero, titulo, projeto_id, client_id, status, prioridade, objetivo, created_by)
  VALUES (v_os_numero, 'OS ' || v_numero, v_projeto_id, prop.client_id, 'aberta', 'media',
    'Execução dos serviços contratados conforme proposta ' || COALESCE(prop.numero,''),
    prop.created_by) RETURNING id INTO v_os_id;

  INSERT INTO public.projeto_timeline(projeto_id, evento, detalhe, user_id)
  VALUES (v_projeto_id, 'Projeto criado', 'Originado da proposta ' || COALESCE(prop.numero,''), auth.uid());
  RETURN v_projeto_id;
END $$;

CREATE OR REPLACE FUNCTION public.on_proposal_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE next_rev int;
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    INSERT INTO public.approved_services (proposal_id, proposal_item_id)
    SELECT NEW.id, pi.id FROM public.proposal_items pi
    WHERE pi.proposal_id = NEW.id
    AND NOT EXISTS (SELECT 1 FROM public.approved_services a WHERE a.proposal_item_id = pi.id);
    PERFORM public.criar_projeto_da_proposta(NEW.id);
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COALESCE(MAX(revisao),0)+1 INTO next_rev FROM public.proposal_revisions WHERE proposal_id = NEW.id;
    INSERT INTO public.proposal_revisions (proposal_id, revisao, titulo, descricao, user_id)
    VALUES (NEW.id, next_rev, 'Status alterado', 'De "' || OLD.status || '" para "' || NEW.status || '"', auth.uid());
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.projetos_gerar_renovacoes()
RETURNS int LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r record; v_op_id uuid; v_count int := 0;
BEGIN
  FOR r IN
    SELECT ps.id AS servico_id, ps.projeto_id, ps.nome, ps.data_validade, ps.valor,
           p.client_id, p.responsavel_comercial_id, c.nome_fantasia, c.razao_social
    FROM public.projeto_servicos ps
    JOIN public.projetos p ON p.id = ps.projeto_id
    JOIN public.clients c ON c.id = p.client_id
    WHERE ps.data_validade IS NOT NULL
      AND ps.data_validade <= CURRENT_DATE + interval '60 days'
      AND ps.data_validade >= CURRENT_DATE
      AND NOT EXISTS (SELECT 1 FROM public.projeto_renovacoes pr WHERE pr.projeto_servico_id = ps.id)
  LOOP
    INSERT INTO public.crm_oportunidades(titulo, client_id, valor_estimado, etapa, responsavel_id, created_by, probabilidade)
    VALUES ('Renovação - ' || r.nome || ' - ' || COALESCE(r.nome_fantasia, r.razao_social),
      r.client_id, COALESCE(r.valor,0), 'qualificacao', r.responsavel_comercial_id, r.responsavel_comercial_id, 60)
    RETURNING id INTO v_op_id;
    INSERT INTO public.projeto_renovacoes(projeto_id, projeto_servico_id, client_id, data_validade, oportunidade_id)
    VALUES (r.projeto_id, r.servico_id, r.client_id, r.data_validade, v_op_id);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END $$;

-- ============ MIGRAÇÃO RETROATIVA ============
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT id FROM public.proposals WHERE status = 'aprovada'
           AND NOT EXISTS (SELECT 1 FROM public.projetos pr WHERE pr.proposal_id = proposals.id) LOOP
    PERFORM public.criar_projeto_da_proposta(p.id);
  END LOOP;
END $$;
