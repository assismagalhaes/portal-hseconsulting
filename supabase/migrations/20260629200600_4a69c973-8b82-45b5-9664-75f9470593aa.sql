ALTER TABLE public.proposal_items ADD COLUMN IF NOT EXISTS nome TEXT;
-- Backfill: usar nome do serviço quando disponível; caso contrário manter descricao_comercial
UPDATE public.proposal_items pi
SET nome = COALESCE(s.nome, pi.descricao_comercial)
FROM public.services s
WHERE pi.service_id = s.id AND (pi.nome IS NULL OR pi.nome = '');
UPDATE public.proposal_items SET nome = descricao_comercial WHERE nome IS NULL OR nome = '';