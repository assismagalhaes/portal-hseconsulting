
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS endereco text,
  ADD COLUMN IF NOT EXISTS cargo text,
  ADD COLUMN IF NOT EXISTS whatsapp text;

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS categoria text;

ALTER TABLE public.proposal_items
  ADD COLUMN IF NOT EXISTS categoria text;

ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS escopo_geral text;

ALTER TABLE public.proposal_revisions
  ADD COLUMN IF NOT EXISTS titulo text,
  ADD COLUMN IF NOT EXISTS snapshot jsonb;

-- Função para registrar revisão de proposta
CREATE OR REPLACE FUNCTION public.add_proposal_revision(_proposal_id uuid, _titulo text, _descricao text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_rev int;
  rev_id uuid;
BEGIN
  SELECT COALESCE(MAX(revisao),0)+1 INTO next_rev FROM public.proposal_revisions WHERE proposal_id = _proposal_id;
  INSERT INTO public.proposal_revisions (proposal_id, revisao, titulo, descricao, user_id)
  VALUES (_proposal_id, next_rev, _titulo, _descricao, auth.uid())
  RETURNING id INTO rev_id;
  RETURN rev_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.add_proposal_revision(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_proposal_revision(uuid,text,text) TO authenticated;

-- Trigger automático de revisão por mudança de status
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
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    SELECT COALESCE(MAX(revisao),0)+1 INTO next_rev FROM public.proposal_revisions WHERE proposal_id = NEW.id;
    INSERT INTO public.proposal_revisions (proposal_id, revisao, titulo, descricao, user_id)
    VALUES (NEW.id, next_rev, 'Status alterado', 'De "' || OLD.status || '" para "' || NEW.status || '"', auth.uid());
  END IF;

  RETURN NEW;
END $$;
