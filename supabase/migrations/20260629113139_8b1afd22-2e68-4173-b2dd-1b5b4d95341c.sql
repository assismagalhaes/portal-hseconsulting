
-- Enum de origem do cadastro
DO $$ BEGIN
  CREATE TYPE public.proposal_origem AS ENUM ('nova_proposta','retroativa','importacao_manual','importacao_planilha');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Colunas novas
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS data_emissao date,
  ADD COLUMN IF NOT EXISTS data_aprovacao date,
  ADD COLUMN IF NOT EXISTS data_recusa date,
  ADD COLUMN IF NOT EXISTS origem_cadastro public.proposal_origem NOT NULL DEFAULT 'nova_proposta',
  ADD COLUMN IF NOT EXISTS observacao_retroativa text;

-- Backfill: usar created_at como data de emissão das propostas existentes
UPDATE public.proposals SET data_emissao = created_at::date WHERE data_emissao IS NULL;

-- Default para novas linhas
ALTER TABLE public.proposals ALTER COLUMN data_emissao SET DEFAULT CURRENT_DATE;
ALTER TABLE public.proposals ALTER COLUMN data_emissao SET NOT NULL;

-- Backfill data_aprovacao para propostas já aprovadas
UPDATE public.proposals
   SET data_aprovacao = COALESCE(data_aprovacao, aceite_data, updated_at::date)
 WHERE status = 'aprovada' AND data_aprovacao IS NULL;

-- Backfill data_recusa para propostas já recusadas/canceladas
UPDATE public.proposals
   SET data_recusa = COALESCE(data_recusa, updated_at::date)
 WHERE status IN ('recusada','cancelada') AND data_recusa IS NULL;

-- Trigger: ao mudar status, preencher automaticamente as datas se vazias
CREATE OR REPLACE FUNCTION public.proposals_preencher_datas_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'aprovada' AND NEW.data_aprovacao IS NULL THEN
      NEW.data_aprovacao := CURRENT_DATE;
    END IF;
    IF NEW.status IN ('recusada','cancelada') AND NEW.data_recusa IS NULL THEN
      NEW.data_recusa := CURRENT_DATE;
    END IF;
    IF NEW.status = 'enviada' AND NEW.data_envio IS NULL THEN
      NEW.data_envio := CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proposals_preencher_datas ON public.proposals;
CREATE TRIGGER trg_proposals_preencher_datas
BEFORE UPDATE ON public.proposals
FOR EACH ROW
EXECUTE FUNCTION public.proposals_preencher_datas_status();

-- Índices para os novos filtros de dashboard
CREATE INDEX IF NOT EXISTS idx_proposals_data_emissao ON public.proposals(data_emissao);
CREATE INDEX IF NOT EXISTS idx_proposals_data_aprovacao ON public.proposals(data_aprovacao);
CREATE INDEX IF NOT EXISTS idx_proposals_origem_cadastro ON public.proposals(origem_cadastro);
