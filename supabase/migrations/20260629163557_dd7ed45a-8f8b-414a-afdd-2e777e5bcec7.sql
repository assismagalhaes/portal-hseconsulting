
ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS entregaveis text,
  ADD COLUMN IF NOT EXISTS observacoes_escopo text,
  ADD COLUMN IF NOT EXISTS quantidade_tecnica text;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS entregaveis text,
  ADD COLUMN IF NOT EXISTS observacoes_escopo text,
  ADD COLUMN IF NOT EXISTS quantidade_tecnica text;
