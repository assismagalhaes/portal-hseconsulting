
-- Enums
DO $$ BEGIN
  CREATE TYPE public.simulacao_tipo AS ENUM ('individual','agrupada');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.rateio_regra AS ENUM ('igual','proporcional_venda','proporcional_custo','proporcional_horas','proporcional_quantidade','manual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Simulações
CREATE TABLE IF NOT EXISTS public.simulacoes_precificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  nome text,
  tipo public.simulacao_tipo NOT NULL DEFAULT 'agrupada',
  regra_rateio public.rateio_regra NOT NULL DEFAULT 'igual',
  observacoes text,
  aplicada boolean NOT NULL DEFAULT false,
  aplicada_em timestamptz,
  totais jsonb NOT NULL DEFAULT '{}'::jsonb,
  parametros jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulacoes_proposal ON public.simulacoes_precificacao(proposal_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacoes_precificacao TO authenticated;
GRANT ALL ON public.simulacoes_precificacao TO service_role;
ALTER TABLE public.simulacoes_precificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage simulacoes" ON public.simulacoes_precificacao
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_simulacoes_updated BEFORE UPDATE ON public.simulacoes_precificacao
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Custos compartilhados
CREATE TABLE IF NOT EXISTS public.simulacao_custos_compartilhados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id uuid NOT NULL REFERENCES public.simulacoes_precificacao(id) ON DELETE CASCADE,
  categoria text NOT NULL,
  descricao text,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulacao_custos_simulacao ON public.simulacao_custos_compartilhados(simulacao_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacao_custos_compartilhados TO authenticated;
GRANT ALL ON public.simulacao_custos_compartilhados TO service_role;
ALTER TABLE public.simulacao_custos_compartilhados ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage sim custos" ON public.simulacao_custos_compartilhados
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Itens da simulação
CREATE TABLE IF NOT EXISTS public.simulacao_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  simulacao_id uuid NOT NULL REFERENCES public.simulacoes_precificacao(id) ON DELETE CASCADE,
  proposal_item_id uuid NOT NULL REFERENCES public.proposal_items(id) ON DELETE CASCADE,
  custos_individuais jsonb NOT NULL DEFAULT '{}'::jsonb,
  horas jsonb NOT NULL DEFAULT '{}'::jsonb,
  qtd_funcionarios int NOT NULL DEFAULT 0,
  margem_desejada numeric(6,4) NOT NULL DEFAULT 0,
  aliquota_imposto numeric(6,4) NOT NULL DEFAULT 0,
  lucro_desejado numeric(14,2) NOT NULL DEFAULT 0,
  desconto_comercial numeric(14,2) NOT NULL DEFAULT 0,
  peso_manual numeric(14,4) NOT NULL DEFAULT 0,
  custo_individual numeric(14,2) NOT NULL DEFAULT 0,
  custo_compartilhado_rateado numeric(14,2) NOT NULL DEFAULT 0,
  custo_total numeric(14,2) NOT NULL DEFAULT 0,
  preco_sugerido numeric(14,2) NOT NULL DEFAULT 0,
  preco_final numeric(14,2) NOT NULL DEFAULT 0,
  lucro_estimado numeric(14,2) NOT NULL DEFAULT 0,
  margem_liquida numeric(6,4) NOT NULL DEFAULT 0,
  markup numeric(8,4) NOT NULL DEFAULT 0,
  status_margem text,
  indicadores jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_simulacao_itens_simulacao ON public.simulacao_itens(simulacao_id);
CREATE INDEX IF NOT EXISTS idx_simulacao_itens_item ON public.simulacao_itens(proposal_item_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.simulacao_itens TO authenticated;
GRANT ALL ON public.simulacao_itens TO service_role;
ALTER TABLE public.simulacao_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage sim itens" ON public.simulacao_itens
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Histórico
CREATE TABLE IF NOT EXISTS public.historico_precificacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  simulacao_id uuid REFERENCES public.simulacoes_precificacao(id) ON DELETE SET NULL,
  proposal_item_id uuid REFERENCES public.proposal_items(id) ON DELETE SET NULL,
  acao text NOT NULL,
  valor_anterior numeric(14,2),
  valor_novo numeric(14,2),
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hist_prec_proposal ON public.historico_precificacao(proposal_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_precificacao TO authenticated;
GRANT ALL ON public.historico_precificacao TO service_role;
ALTER TABLE public.historico_precificacao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth manage hist prec" ON public.historico_precificacao
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
