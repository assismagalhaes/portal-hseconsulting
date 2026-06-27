
-- ============================================================
-- ETAPA 5 — Ordens de Serviço (OS), Planejamento e Agenda
-- ============================================================

-- ENUMS -------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.os_status AS ENUM (
    'aberta','planejamento','agendada','em_campo','em_elaboracao',
    'em_revisao','aguardando_cliente','finalizada','cancelada'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.os_prioridade AS ENUM ('baixa','media','alta','urgente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.os_recurso_tipo AS ENUM ('equipamento','veiculo','documento','epi','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.os_visita_situacao AS ENUM ('planejada','em_andamento','realizada','cancelada','remarcada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.os_documento_categoria AS ENUM ('recebido','gerado','pendente');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.os_evidencia_tipo AS ENUM ('foto','video','pdf','audio','documento','outro');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SEQUENCE ANUAL PARA NUMERAÇÃO ------------------------------
CREATE SEQUENCE IF NOT EXISTS public.os_numero_seq START 1;

CREATE OR REPLACE FUNCTION public.gerar_numero_os()
RETURNS text LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE n bigint; BEGIN
  n := nextval('public.os_numero_seq');
  RETURN 'OS-' || to_char(now(),'YYYY') || '-' || lpad(n::text, 6, '0');
END $$;

-- TABLE: ordens_servico --------------------------------------
CREATE TABLE IF NOT EXISTS public.ordens_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE DEFAULT public.gerar_numero_os(),
  execucao_id uuid NOT NULL REFERENCES public.execucao_servicos(id) ON DELETE CASCADE,
  proposal_id uuid REFERENCES public.proposals(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  responsavel_comercial uuid,
  responsavel_tecnico_id uuid REFERENCES public.execucao_profissionais(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  objetivo text,
  descricao text,
  escopo_contratado text,
  observacoes_tecnicas text,
  status public.os_status NOT NULL DEFAULT 'aberta',
  prioridade public.os_prioridade NOT NULL DEFAULT 'media',
  data_abertura date NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_inicio date,
  data_prevista_conclusao date,
  data_real_inicio date,
  data_real_conclusao date,
  percentual_executado int NOT NULL DEFAULT 0 CHECK (percentual_executado BETWEEN 0 AND 100),
  cidade text,
  endereco text,
  qr_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  -- desnormalização para sincronização offline futura
  cliente_nome text,
  servico_nome text,
  -- prep mobile
  synced_at timestamptz,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  updated_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ordens_servico TO authenticated;
GRANT ALL ON public.ordens_servico TO service_role;
ALTER TABLE public.ordens_servico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read os" ON public.ordens_servico FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write os" ON public.ordens_servico FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_os_execucao ON public.ordens_servico(execucao_id);
CREATE INDEX IF NOT EXISTS idx_os_status ON public.ordens_servico(status);
CREATE INDEX IF NOT EXISTS idx_os_responsavel ON public.ordens_servico(responsavel_tecnico_id);
CREATE INDEX IF NOT EXISTS idx_os_prevista ON public.ordens_servico(data_prevista_conclusao);

-- TABLE: os_equipe -------------------------------------------
CREATE TABLE IF NOT EXISTS public.os_equipe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  profissional_id uuid NOT NULL REFERENCES public.execucao_profissionais(id) ON DELETE CASCADE,
  papel text NOT NULL DEFAULT 'apoio',
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (os_id, profissional_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_equipe TO authenticated;
GRANT ALL ON public.os_equipe TO service_role;
ALTER TABLE public.os_equipe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_equipe" ON public.os_equipe FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: os_recursos -----------------------------------------
CREATE TABLE IF NOT EXISTS public.os_recursos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  tipo public.os_recurso_tipo NOT NULL,
  descricao text NOT NULL,
  quantidade numeric(10,2) DEFAULT 1,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_recursos TO authenticated;
GRANT ALL ON public.os_recursos TO service_role;
ALTER TABLE public.os_recursos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_recursos" ON public.os_recursos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: os_checklist ----------------------------------------
CREATE TABLE IF NOT EXISTS public.os_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  descricao text NOT NULL,
  obrigatorio boolean NOT NULL DEFAULT true,
  concluido boolean NOT NULL DEFAULT false,
  concluido_em timestamptz,
  concluido_por uuid,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_checklist TO authenticated;
GRANT ALL ON public.os_checklist TO service_role;
ALTER TABLE public.os_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_checklist" ON public.os_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: os_visitas ------------------------------------------
CREATE TABLE IF NOT EXISTS public.os_visitas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora_inicio time,
  hora_fim time,
  local text,
  responsavel_id uuid REFERENCES public.execucao_profissionais(id) ON DELETE SET NULL,
  objetivo text,
  situacao public.os_visita_situacao NOT NULL DEFAULT 'planejada',
  observacoes text,
  cliente_acompanhou boolean DEFAULT false,
  concluida_em timestamptz,
  concluida_por uuid,
  synced_at timestamptz,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_visitas TO authenticated;
GRANT ALL ON public.os_visitas TO service_role;
ALTER TABLE public.os_visitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_visitas" ON public.os_visitas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_os_visitas_os ON public.os_visitas(os_id);
CREATE INDEX IF NOT EXISTS idx_os_visitas_data ON public.os_visitas(data);

-- TABLE: os_visita_checklist ---------------------------------
CREATE TABLE IF NOT EXISTS public.os_visita_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visita_id uuid NOT NULL REFERENCES public.os_visitas(id) ON DELETE CASCADE,
  ordem int NOT NULL DEFAULT 0,
  descricao text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_visita_checklist TO authenticated;
GRANT ALL ON public.os_visita_checklist TO service_role;
ALTER TABLE public.os_visita_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_visita_checklist" ON public.os_visita_checklist FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: os_logistica ----------------------------------------
CREATE TABLE IF NOT EXISTS public.os_logistica (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL UNIQUE REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  cidade text,
  endereco text,
  distancia_km numeric(10,2),
  tempo_estimado_min int,
  veiculo text,
  motorista text,
  hospedagem text,
  alimentacao text,
  pedagios numeric(10,2),
  combustivel numeric(10,2),
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_logistica TO authenticated;
GRANT ALL ON public.os_logistica TO service_role;
ALTER TABLE public.os_logistica ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_logistica" ON public.os_logistica FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: os_documentos ---------------------------------------
CREATE TABLE IF NOT EXISTS public.os_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  categoria public.os_documento_categoria NOT NULL,
  nome text NOT NULL,
  descricao text,
  status text DEFAULT 'pendente',
  anexo_path text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_documentos TO authenticated;
GRANT ALL ON public.os_documentos TO service_role;
ALTER TABLE public.os_documentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_documentos" ON public.os_documentos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: os_evidencias ---------------------------------------
CREATE TABLE IF NOT EXISTS public.os_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  visita_id uuid REFERENCES public.os_visitas(id) ON DELETE SET NULL,
  tipo public.os_evidencia_tipo NOT NULL DEFAULT 'foto',
  arquivo_path text NOT NULL,
  legenda text,
  tamanho_bytes bigint,
  synced_at timestamptz,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_evidencias TO authenticated;
GRANT ALL ON public.os_evidencias TO service_role;
ALTER TABLE public.os_evidencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_evidencias" ON public.os_evidencias FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- TABLE: os_eventos_agenda -----------------------------------
CREATE TABLE IF NOT EXISTS public.os_eventos_agenda (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  visita_id uuid REFERENCES public.os_visitas(id) ON DELETE CASCADE,
  profissional_id uuid REFERENCES public.execucao_profissionais(id) ON DELETE SET NULL,
  titulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'visita',
  start_at timestamptz NOT NULL,
  end_at timestamptz NOT NULL,
  cidade text,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_eventos_agenda TO authenticated;
GRANT ALL ON public.os_eventos_agenda TO service_role;
ALTER TABLE public.os_eventos_agenda ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_eventos" ON public.os_eventos_agenda FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_os_eventos_start ON public.os_eventos_agenda(start_at);
CREATE INDEX IF NOT EXISTS idx_os_eventos_prof ON public.os_eventos_agenda(profissional_id);

-- TABLE: os_timeline -----------------------------------------
CREATE TABLE IF NOT EXISTS public.os_timeline (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES public.ordens_servico(id) ON DELETE CASCADE,
  evento text NOT NULL,
  detalhe text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.os_timeline TO authenticated;
GRANT ALL ON public.os_timeline TO service_role;
ALTER TABLE public.os_timeline ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth all os_timeline" ON public.os_timeline FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX IF NOT EXISTS idx_os_timeline_os ON public.os_timeline(os_id);

-- TRIGGERS ----------------------------------------------------
-- updated_at em todas as tabelas relevantes
DROP TRIGGER IF EXISTS trg_os_updated ON public.ordens_servico;
CREATE TRIGGER trg_os_updated BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_os_visitas_updated ON public.os_visitas;
CREATE TRIGGER trg_os_visitas_updated BEFORE UPDATE ON public.os_visitas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_os_logistica_updated ON public.os_logistica;
CREATE TRIGGER trg_os_logistica_updated BEFORE UPDATE ON public.os_logistica
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_os_eventos_updated ON public.os_eventos_agenda;
CREATE TRIGGER trg_os_eventos_updated BEFORE UPDATE ON public.os_eventos_agenda
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auditoria + desnormalização da OS
CREATE OR REPLACE FUNCTION public.os_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- preencher desnormalização
    IF NEW.cliente_nome IS NULL AND NEW.client_id IS NOT NULL THEN
      SELECT COALESCE(nome_fantasia, razao_social) INTO NEW.cliente_nome
      FROM public.clients WHERE id = NEW.client_id;
    END IF;
    IF NEW.servico_nome IS NULL AND NEW.service_id IS NOT NULL THEN
      SELECT nome INTO NEW.servico_nome FROM public.services WHERE id = NEW.service_id;
    END IF;
    INSERT INTO public.os_timeline(os_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'OS criada', 'Status inicial: ' || NEW.status::text, auth.uid());
    RETURN NEW;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.os_timeline(os_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Mudança de status', OLD.status::text || ' → ' || NEW.status::text, auth.uid());
    IF NEW.status = 'em_campo' AND NEW.data_real_inicio IS NULL THEN
      NEW.data_real_inicio := CURRENT_DATE;
    END IF;
    IF NEW.status = 'finalizada' AND NEW.data_real_conclusao IS NULL THEN
      NEW.data_real_conclusao := CURRENT_DATE;
      NEW.percentual_executado := 100;
    END IF;
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

  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_os_audit_ins ON public.ordens_servico;
CREATE TRIGGER trg_os_audit_ins BEFORE INSERT ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_audit();

DROP TRIGGER IF EXISTS trg_os_audit_upd ON public.ordens_servico;
CREATE TRIGGER trg_os_audit_upd BEFORE UPDATE ON public.ordens_servico
  FOR EACH ROW EXECUTE FUNCTION public.os_audit();

-- Sincronizar evento da agenda quando uma visita é criada/atualizada
CREATE OR REPLACE FUNCTION public.sync_visita_agenda()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_titulo text;
  v_cidade text;
  v_start timestamptz;
  v_end timestamptz;
BEGIN
  SELECT COALESCE(o.titulo, o.numero), o.cidade INTO v_titulo, v_cidade
  FROM public.ordens_servico o WHERE o.id = NEW.os_id;

  v_start := (NEW.data::timestamp + COALESCE(NEW.hora_inicio,'08:00'::time));
  v_end   := (NEW.data::timestamp + COALESCE(NEW.hora_fim, (COALESCE(NEW.hora_inicio,'08:00'::time) + interval '2 hours')));

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.os_eventos_agenda(os_id, visita_id, profissional_id, titulo, tipo, start_at, end_at, cidade)
    VALUES (NEW.os_id, NEW.id, NEW.responsavel_id, COALESCE(NEW.objetivo, v_titulo), 'visita', v_start, v_end, COALESCE(NEW.local, v_cidade));
  ELSE
    UPDATE public.os_eventos_agenda
       SET profissional_id = NEW.responsavel_id,
           titulo = COALESCE(NEW.objetivo, v_titulo),
           start_at = v_start,
           end_at = v_end,
           cidade = COALESCE(NEW.local, v_cidade),
           updated_at = now()
     WHERE visita_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_visita_sync ON public.os_visitas;
CREATE TRIGGER trg_visita_sync AFTER INSERT OR UPDATE ON public.os_visitas
  FOR EACH ROW EXECUTE FUNCTION public.sync_visita_agenda();

-- STORAGE BUCKETS via tabela apenas se não existirem (gerenciados normalmente pela API; aqui só policies)
-- Policies para buckets os-evidencias / os-documentos
DO $$ BEGIN
  -- evita erro caso buckets ainda não existam
  NULL;
END $$;

-- Policies de storage.objects (idempotentes)
DROP POLICY IF EXISTS "auth read os-evidencias" ON storage.objects;
CREATE POLICY "auth read os-evidencias" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'os-evidencias');
DROP POLICY IF EXISTS "auth write os-evidencias" ON storage.objects;
CREATE POLICY "auth write os-evidencias" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'os-evidencias') WITH CHECK (bucket_id = 'os-evidencias');

DROP POLICY IF EXISTS "auth read os-documentos" ON storage.objects;
CREATE POLICY "auth read os-documentos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'os-documentos');
DROP POLICY IF EXISTS "auth write os-documentos" ON storage.objects;
CREATE POLICY "auth write os-documentos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'os-documentos') WITH CHECK (bucket_id = 'os-documentos');
