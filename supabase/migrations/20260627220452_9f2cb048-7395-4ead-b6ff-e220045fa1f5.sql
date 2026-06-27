
-- ============ ENUMS ============
DO $$ BEGIN
  CREATE TYPE public.automacao_tipo AS ENUM ('comercial','operacional','documental','financeira','portal_cliente','ia_gestao','sistema');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.automacao_gatilho_tipo AS ENUM ('por_data','por_vencimento','mudanca_status','criacao_registro','inatividade','atraso','evento_sistema','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.automacao_acao_tipo AS ENUM (
    'criar_notificacao','criar_alerta','criar_tarefa','criar_followup','criar_pendencia_documental',
    'gerar_resumo_ia','atualizar_status_alerta','registrar_timeline','registrar_log',
    'sugerir_mensagem','sugerir_email','sugerir_cobranca'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.automacao_status_execucao AS ENUM ('sucesso','parcial','erro','ignorada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notif_prioridade AS ENUM ('baixa','normal','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notif_status AS ENUM ('nao_lida','lida','resolvida','ignorada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tarefa_status AS ENUM ('pendente','em_andamento','concluida','cancelada','atrasada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.tarefa_prioridade AS ENUM ('baixa','normal','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ AUTOMACOES ============
CREATE TABLE public.automacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  tipo public.automacao_tipo NOT NULL DEFAULT 'sistema',
  ativa boolean NOT NULL DEFAULT true,
  responsavel_padrao uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  prioridade_padrao public.notif_prioridade NOT NULL DEFAULT 'normal',
  agendamento_cron text,
  dias_antes int,
  dias_inatividade int,
  mensagem_padrao text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  modulos_afetados text[] NOT NULL DEFAULT '{}',
  ultima_execucao timestamptz,
  proxima_execucao timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes TO authenticated;
GRANT ALL ON public.automacoes TO service_role;
ALTER TABLE public.automacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos veem automacoes" ON public.automacoes FOR SELECT TO authenticated USING (NOT public.is_client_user());
CREATE POLICY "internos gerenciam automacoes" ON public.automacoes FOR ALL TO authenticated USING (NOT public.is_client_user()) WITH CHECK (NOT public.is_client_user());
CREATE TRIGGER trg_automacoes_updated BEFORE UPDATE ON public.automacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.automacoes_gatilhos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automacao_id uuid NOT NULL REFERENCES public.automacoes(id) ON DELETE CASCADE,
  tipo public.automacao_gatilho_tipo NOT NULL,
  evento text,
  condicao jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes_gatilhos TO authenticated;
GRANT ALL ON public.automacoes_gatilhos TO service_role;
ALTER TABLE public.automacoes_gatilhos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos gerenciam gatilhos" ON public.automacoes_gatilhos FOR ALL TO authenticated USING (NOT public.is_client_user()) WITH CHECK (NOT public.is_client_user());

CREATE TABLE public.automacoes_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automacao_id uuid NOT NULL REFERENCES public.automacoes(id) ON DELETE CASCADE,
  tipo public.automacao_acao_tipo NOT NULL,
  titulo text,
  template text,
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  ordem int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes_acoes TO authenticated;
GRANT ALL ON public.automacoes_acoes TO service_role;
ALTER TABLE public.automacoes_acoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos gerenciam acoes" ON public.automacoes_acoes FOR ALL TO authenticated USING (NOT public.is_client_user()) WITH CHECK (NOT public.is_client_user());

CREATE TABLE public.automacoes_execucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  automacao_id uuid NOT NULL REFERENCES public.automacoes(id) ON DELETE CASCADE,
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  duracao_ms int,
  status public.automacao_status_execucao NOT NULL DEFAULT 'sucesso',
  registros_afetados int NOT NULL DEFAULT 0,
  notificacoes_criadas int NOT NULL DEFAULT 0,
  tarefas_criadas int NOT NULL DEFAULT 0,
  alertas_criados int NOT NULL DEFAULT 0,
  erros jsonb,
  detalhe text,
  executado_por uuid REFERENCES auth.users(id),
  origem text NOT NULL DEFAULT 'sistema'
);
GRANT SELECT, INSERT, UPDATE ON public.automacoes_execucoes TO authenticated;
GRANT ALL ON public.automacoes_execucoes TO service_role;
ALTER TABLE public.automacoes_execucoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos veem execucoes" ON public.automacoes_execucoes FOR SELECT TO authenticated USING (NOT public.is_client_user());
CREATE POLICY "internos registram execucoes" ON public.automacoes_execucoes FOR INSERT TO authenticated WITH CHECK (NOT public.is_client_user());
CREATE POLICY "internos atualizam execucoes" ON public.automacoes_execucoes FOR UPDATE TO authenticated USING (NOT public.is_client_user());
CREATE INDEX idx_autom_exec_automacao ON public.automacoes_execucoes(automacao_id, iniciado_em DESC);

CREATE TABLE public.automacoes_configuracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,
  valor jsonb NOT NULL DEFAULT '{}'::jsonb,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.automacoes_configuracoes TO authenticated;
GRANT ALL ON public.automacoes_configuracoes TO service_role;
ALTER TABLE public.automacoes_configuracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos gerenciam config autom" ON public.automacoes_configuracoes FOR ALL TO authenticated USING (NOT public.is_client_user()) WITH CHECK (NOT public.is_client_user());
CREATE TRIGGER trg_autom_cfg_updated BEFORE UPDATE ON public.automacoes_configuracoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ NOTIFICACOES ============
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  modulo text NOT NULL DEFAULT 'geral',
  tipo text NOT NULL DEFAULT 'info',
  titulo text NOT NULL,
  mensagem text,
  prioridade public.notif_prioridade NOT NULL DEFAULT 'normal',
  status public.notif_status NOT NULL DEFAULT 'nao_lida',
  link text,
  entidade_tipo text,
  entidade_id uuid,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  automacao_id uuid REFERENCES public.automacoes(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'sistema',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  lida_em timestamptz,
  resolvida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ver proprias notificacoes" ON public.notificacoes FOR SELECT TO authenticated USING (user_id = auth.uid() AND NOT public.is_client_user());
CREATE POLICY "criar notificacoes internas" ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (NOT public.is_client_user());
CREATE POLICY "atualizar proprias notificacoes" ON public.notificacoes FOR UPDATE TO authenticated USING (user_id = auth.uid() AND NOT public.is_client_user());
CREATE POLICY "deletar proprias notificacoes" ON public.notificacoes FOR DELETE TO authenticated USING (user_id = auth.uid() AND NOT public.is_client_user());
CREATE INDEX idx_notif_user_status ON public.notificacoes(user_id, status, created_at DESC);

-- ============ TAREFAS ============
CREATE TABLE public.tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  modulo_origem text NOT NULL DEFAULT 'geral',
  entidade_tipo text,
  entidade_id uuid,
  data_prevista date,
  prioridade public.tarefa_prioridade NOT NULL DEFAULT 'normal',
  status public.tarefa_status NOT NULL DEFAULT 'pendente',
  observacoes text,
  automacao_id uuid REFERENCES public.automacoes(id) ON DELETE SET NULL,
  concluida_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas TO authenticated;
GRANT ALL ON public.tarefas TO service_role;
ALTER TABLE public.tarefas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos veem tarefas" ON public.tarefas FOR SELECT TO authenticated USING (NOT public.is_client_user());
CREATE POLICY "internos gerenciam tarefas" ON public.tarefas FOR ALL TO authenticated USING (NOT public.is_client_user()) WITH CHECK (NOT public.is_client_user());
CREATE TRIGGER trg_tarefas_updated BEFORE UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_tarefas_resp ON public.tarefas(responsavel_id, status, data_prevista);

CREATE TABLE public.tarefas_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  concluido boolean NOT NULL DEFAULT false,
  ordem int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tarefas_checklist TO authenticated;
GRANT ALL ON public.tarefas_checklist TO service_role;
ALTER TABLE public.tarefas_checklist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos checklist tarefas" ON public.tarefas_checklist FOR ALL TO authenticated USING (NOT public.is_client_user()) WITH CHECK (NOT public.is_client_user());

CREATE TABLE public.tarefas_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tarefa_id uuid NOT NULL REFERENCES public.tarefas(id) ON DELETE CASCADE,
  evento text NOT NULL,
  detalhe text,
  user_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.tarefas_historico TO authenticated;
GRANT ALL ON public.tarefas_historico TO service_role;
ALTER TABLE public.tarefas_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "internos veem historico tarefas" ON public.tarefas_historico FOR SELECT TO authenticated USING (NOT public.is_client_user());
CREATE POLICY "internos inserem historico tarefas" ON public.tarefas_historico FOR INSERT TO authenticated WITH CHECK (NOT public.is_client_user());

-- ============ TRIGGER tarefa audit ============
CREATE OR REPLACE FUNCTION public.tarefa_audit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.tarefas_historico(tarefa_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'tarefa_criada', 'Status inicial: '||NEW.status::text, auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.tarefas_historico(tarefa_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'mudanca_status', OLD.status::text||' → '||NEW.status::text, auth.uid());
    IF NEW.status = 'concluida' AND NEW.concluida_em IS NULL THEN NEW.concluida_em := now(); END IF;
  END IF;
  NEW.updated_by := auth.uid();
  RETURN NEW;
END $$;
CREATE TRIGGER trg_tarefa_audit BEFORE INSERT OR UPDATE ON public.tarefas FOR EACH ROW EXECUTE FUNCTION public.tarefa_audit();

-- ============ SEED AUTOMACOES PADRAO ============
INSERT INTO public.automacoes (nome, descricao, tipo, ativa, prioridade_padrao, agendamento_cron, dias_antes, modulos_afetados) VALUES
('Proposta enviada sem retorno (3 dias)','Cria follow-up e notifica comercial após 3 dias sem retorno','comercial',true,'normal','0 9 * * *',3,ARRAY['propostas','crm']),
('Proposta vencendo em 5 dias','Notifica comercial e sugere mensagem de follow-up','comercial',true,'alta','0 9 * * *',5,ARRAY['propostas']),
('Lead novo sem responsável','Notifica gestor comercial sobre leads sem dono','comercial',true,'alta','0 9 * * *',NULL,ARRAY['crm']),
('Oportunidade quente sem próxima ação','Cria alerta comercial para oportunidades quentes paradas','comercial',true,'alta','0 9 * * *',NULL,ARRAY['crm']),
('Proposta aprovada — verificar execução','Notifica operação e verifica criação de OS','comercial',true,'alta',NULL,NULL,ARRAY['propostas','execucao']),
('OS criada sem responsável técnico','Notifica gestor operacional','operacional',true,'alta','0 8 * * *',NULL,ARRAY['os']),
('OS agendada para amanhã','Notifica técnico responsável','operacional',true,'normal','0 17 * * *',1,ARRAY['os','agenda']),
('OS em campo sem checklist','Cria alerta operacional','operacional',true,'alta','0 18 * * *',NULL,ARRAY['os']),
('OS atrasada','Notifica responsável e gestor','operacional',true,'critica','0 9 * * *',NULL,ARRAY['os']),
('Serviço concluído sem documento técnico','Cria tarefa para responsável técnico','operacional',true,'alta','0 10 * * *',NULL,ARRAY['execucao','documentos']),
('Documento vencendo em 30 dias','Notifica responsável e cria alerta de renovação','documental',true,'alta','0 9 * * *',30,ARRAY['documentos']),
('Documento vencido','Notifica gestor e cria alerta crítico','documental',true,'critica','0 9 * * *',NULL,ARRAY['documentos']),
('Documento em revisão há +5 dias','Notifica revisor','documental',true,'normal','0 9 * * *',5,ARRAY['documentos']),
('Pendência documental sem resposta (3 dias)','Notifica responsável','documental',true,'alta','0 9 * * *',3,ARRAY['documentos']),
('Documento aprovado — sugerir liberação','Sugere liberação ao Portal do Cliente','documental',true,'normal',NULL,NULL,ARRAY['documentos','portal_cliente']),
('Parcela vencendo em 3 dias','Notifica financeiro e sugere cobrança amigável','financeira',true,'alta','30 9 * * *',3,ARRAY['financeiro']),
('Parcela vencida','Cria alerta financeiro e notifica','financeira',true,'critica','30 9 * * *',NULL,ARRAY['financeiro']),
('Pagamento parcial','Cria tarefa de acompanhamento','financeira',true,'normal',NULL,NULL,ARRAY['financeiro']),
('Custo realizado acima do previsto','Notifica gestor','financeira',true,'alta','0 11 * * *',NULL,ARRAY['financeiro']),
('Serviço concluído com parcela final em aberto','Cria alerta financeiro','financeira',true,'alta','0 11 * * *',NULL,ARRAY['financeiro','execucao']),
('Cliente enviou documento pelo portal','Notifica responsável interno','portal_cliente',true,'alta',NULL,NULL,ARRAY['portal_cliente','documentos']),
('Cliente respondeu comunicação','Notifica usuário HSE responsável','portal_cliente',true,'normal',NULL,NULL,ARRAY['portal_cliente']),
('Pendência marcada como enviada','Atualiza status e notifica responsável','portal_cliente',true,'normal',NULL,NULL,ARRAY['portal_cliente']),
('Documento liberado ao cliente','Notifica portal do cliente','portal_cliente',true,'normal',NULL,NULL,ARRAY['portal_cliente']),
('Resumo operacional do dia','Gera resumo diário com IA','ia_gestao',true,'normal','0 7 * * *',NULL,ARRAY['ia']),
('Resumo semanal da gestão','Gera resumo semanal com IA','ia_gestao',true,'normal','0 8 * * 1',NULL,ARRAY['ia']),
('Gerar alertas inteligentes','Roda engine de alertas cross-módulo','ia_gestao',true,'alta','0 6 * * *',NULL,ARRAY['ia','alertas']);
