CREATE OR REPLACE FUNCTION public.on_proposal_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    PERFORM public.criar_execucoes_da_proposta(NEW.id);
  END IF;
  RETURN NEW;
END $function$;