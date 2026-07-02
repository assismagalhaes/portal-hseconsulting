
CREATE OR REPLACE FUNCTION public.projetos_on_proposal_aprovada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    PERFORM public.criar_projeto_da_proposta(NEW.id);
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_projetos_on_proposal_aprovada ON public.proposals;
CREATE TRIGGER trg_projetos_on_proposal_aprovada
AFTER UPDATE ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.projetos_on_proposal_aprovada();

-- Backfill: cria projeto para propostas já aprovadas que ainda não têm projeto
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT pr.id
      FROM public.proposals pr
      LEFT JOIN public.projetos pj ON pj.proposal_id = pr.id
     WHERE pr.status = 'aprovada' AND pj.id IS NULL
  LOOP
    PERFORM public.criar_projeto_da_proposta(p.id);
  END LOOP;
END $$;
