ALTER TABLE public.financeiro_contratos
  DROP CONSTRAINT IF EXISTS financeiro_contratos_proposal_id_key;

CREATE INDEX IF NOT EXISTS financeiro_contratos_proposal_id_idx
  ON public.financeiro_contratos(proposal_id);