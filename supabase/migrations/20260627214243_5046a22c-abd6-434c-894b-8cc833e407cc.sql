
-- ENUMs
DO $$ BEGIN
  CREATE TYPE public.ia_modulo AS ENUM ('geral','proposta','precificacao','documento','os','execucao','crm','financeiro','alertas');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ia_alerta_gravidade AS ENUM ('baixa','media','alta','critica');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ia_alerta_status AS ENUM ('novo','em_analise','resolvido','ignorado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.ia_acao_status AS ENUM ('sugerida','aplicada','recusada','expirada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ia_interacoes
CREATE TABLE IF NOT EXISTS public.ia_interacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  modulo public.ia_modulo NOT NULL DEFAULT 'geral',
  entidade_tipo text,
  entidade_id uuid,
  pergunta text NOT NULL,
  resposta text,
  contexto jsonb DEFAULT '{}'::jsonb,
  model text,
  tokens_input int,
  tokens_output int,
  acao_sugerida text,
  acao_aceita boolean,
  avaliacao int,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_interacoes TO authenticated;
GRANT ALL ON public.ia_interacoes TO service_role;
ALTER TABLE public.ia_interacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_interacoes_select_internal" ON public.ia_interacoes FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));
CREATE POLICY "ia_interacoes_insert_self" ON public.ia_interacoes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.can_see_internal(auth.uid()));
CREATE POLICY "ia_interacoes_update_self" ON public.ia_interacoes FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ia_alertas
CREATE TABLE IF NOT EXISTS public.ia_alertas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL,
  gravidade public.ia_alerta_gravidade NOT NULL DEFAULT 'media',
  modulo public.ia_modulo NOT NULL DEFAULT 'geral',
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  entidade_tipo text,
  entidade_id uuid,
  titulo text NOT NULL,
  descricao text,
  acao_sugerida text,
  responsavel_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.ia_alerta_status NOT NULL DEFAULT 'novo',
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  meta jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_alertas TO authenticated;
GRANT ALL ON public.ia_alertas TO service_role;
ALTER TABLE public.ia_alertas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_alertas_all_internal" ON public.ia_alertas FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ia_alertas_updated BEFORE UPDATE ON public.ia_alertas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ia_prompts
CREATE TABLE IF NOT EXISTS public.ia_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  modulo public.ia_modulo NOT NULL,
  objetivo text,
  prompt_base text NOT NULL,
  versao int NOT NULL DEFAULT 1,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_prompts TO authenticated;
GRANT ALL ON public.ia_prompts TO service_role;
ALTER TABLE public.ia_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_prompts_select_internal" ON public.ia_prompts FOR SELECT TO authenticated
  USING (public.can_see_internal(auth.uid()));
CREATE POLICY "ia_prompts_admin_write" ON public.ia_prompts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_ia_prompts_updated BEFORE UPDATE ON public.ia_prompts
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ia_acoes_sugeridas
CREATE TABLE IF NOT EXISTS public.ia_acoes_sugeridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interacao_id uuid REFERENCES public.ia_interacoes(id) ON DELETE SET NULL,
  modulo public.ia_modulo NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  descricao text,
  payload jsonb DEFAULT '{}'::jsonb,
  entidade_tipo text,
  entidade_id uuid,
  status public.ia_acao_status NOT NULL DEFAULT 'sugerida',
  applied_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  applied_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_acoes_sugeridas TO authenticated;
GRANT ALL ON public.ia_acoes_sugeridas TO service_role;
ALTER TABLE public.ia_acoes_sugeridas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_acoes_all_internal" ON public.ia_acoes_sugeridas FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));
CREATE TRIGGER trg_ia_acoes_updated BEFORE UPDATE ON public.ia_acoes_sugeridas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ia_contextos
CREATE TABLE IF NOT EXISTS public.ia_contextos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interacao_id uuid REFERENCES public.ia_interacoes(id) ON DELETE CASCADE,
  fonte text NOT NULL,
  conteudo jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ia_contextos TO authenticated;
GRANT ALL ON public.ia_contextos TO service_role;
ALTER TABLE public.ia_contextos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_contextos_internal" ON public.ia_contextos FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- ia_feedbacks
CREATE TABLE IF NOT EXISTS public.ia_feedbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interacao_id uuid REFERENCES public.ia_interacoes(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  nota int CHECK (nota BETWEEN 1 AND 5),
  util boolean,
  comentario text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_feedbacks TO authenticated;
GRANT ALL ON public.ia_feedbacks TO service_role;
ALTER TABLE public.ia_feedbacks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_feedbacks_internal" ON public.ia_feedbacks FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- ia_resumos
CREATE TABLE IF NOT EXISTS public.ia_resumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade_tipo text NOT NULL,
  entidade_id uuid,
  titulo text,
  resumo text NOT NULL,
  modulo public.ia_modulo NOT NULL DEFAULT 'geral',
  meta jsonb DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ia_resumos TO authenticated;
GRANT ALL ON public.ia_resumos TO service_role;
ALTER TABLE public.ia_resumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ia_resumos_internal" ON public.ia_resumos FOR ALL TO authenticated
  USING (public.can_see_internal(auth.uid())) WITH CHECK (public.can_see_internal(auth.uid()));

-- Prompts iniciais
INSERT INTO public.ia_prompts(nome, modulo, objetivo, prompt_base, ativo) VALUES
  ('Assistente Geral HSE','geral','Responder dúvidas operacionais com base em dados internos',
   'Você é o copiloto interno da HSE Consulting. Responda em português, de forma objetiva e profissional, sempre baseado nos dados fornecidos no contexto. Quando não houver dados suficientes, diga claramente. Nunca exponha custos ao cliente. Toda sugestão deve ser tratada como recomendação para validação humana.', true),
  ('Revisor de Proposta','proposta','Melhorar redação comercial e identificar inconsistências',
   'Você é um revisor sênior de propostas comerciais de SST. Analise a proposta fornecida e sugira melhorias na descrição comercial, escopo, itens não inclusos, responsabilidades e clareza. Aponte inconsistências entre escopo e preço. Não altere a proposta — apenas gere sugestões para revisão.', true),
  ('Análise de Precificação','precificacao','Avaliar saúde da precificação',
   'Você é analista financeiro. Avalie a precificação considerando custo previsto, horas, margem e complexidade. Classifique como: Precificação saudável, Atenção: margem baixa, Risco de prejuízo, ou Custo incompatível com escopo. Sugira revisão quando aplicável. Nunca altere valores automaticamente.', true),
  ('Assistente Documento Técnico','documento','Apoiar redação técnica de documentos SST',
   'Você é redator técnico SST. Sugira textos para seções de PGR/PCMSO/LTCAT/etc., melhore a redação técnica, aponte campos variáveis não preenchidos e informações obrigatórias ausentes. Sempre adicione: "Conteúdo sugerido por IA. Revisão técnica obrigatória antes da emissão."', true),
  ('Assistente OS','os','Resumir e priorizar ordens de serviço',
   'Você é coordenador operacional. Resuma evidências, liste pendências, sugira próximos passos, alerte sobre checklist incompleto ou ausência de evidências. Identifique OS paradas há muitos dias.', true),
  ('Assistente Comercial','crm','Apoiar follow-up e argumentação comercial',
   'Você é consultor comercial sênior. Sugira próximo follow-up, resuma histórico do cliente, sugira argumento comercial, mensagem de WhatsApp e e-mail. Identifique propostas próximas do vencimento e leads quentes sem ação. Considere etapa do funil e histórico.', true),
  ('Assistente Financeiro','financeiro','Apoiar análise financeira e cobrança',
   'Você é analista financeiro. Identifique contratos com baixa margem real, custos acima do previsto, parcelas vencidas. Sugira textos de cobrança amigável. Gere resumos por cliente e mensais. Nunca realize cobranças automaticamente.', true),
  ('Gerador de Alertas','alertas','Gerar alertas inteligentes cruzando módulos',
   'Você é analista de riscos. Cruze dados de propostas, OS, documentos, CRM e financeiro para identificar riscos: proposta aprovada sem OS, OS sem responsável, documento vencendo, margem baixa, oportunidade quente sem follow-up, etc. Para cada alerta retorne tipo, gravidade, descrição e ação sugerida.', true)
ON CONFLICT DO NOTHING;
