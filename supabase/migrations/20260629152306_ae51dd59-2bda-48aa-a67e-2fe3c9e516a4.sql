CREATE OR REPLACE FUNCTION public.crm_oport_audit_before()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
      IF NEW.etapa = 'ganho' AND NEW.data_ganho IS NULL THEN NEW.data_ganho := now(); END IF;
      IF NEW.etapa = 'perdido' AND NEW.data_perda IS NULL THEN NEW.data_perda := now(); END IF;
    END IF;
    NEW.updated_by := auth.uid();
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.crm_oport_audit_after()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.crm_historico(oportunidade_id, lead_id, client_id, proposal_id, tipo, titulo, detalhe, user_id)
    VALUES (NEW.id, NEW.lead_id, NEW.client_id, NEW.proposal_id, 'oportunidade_criada', 'Oportunidade criada', 'Etapa inicial: '||NEW.etapa::text, auth.uid());
    RETURN NEW;
  END IF;
  IF NEW.etapa IS DISTINCT FROM OLD.etapa THEN
    INSERT INTO public.crm_historico(oportunidade_id, lead_id, client_id, proposal_id, tipo, titulo, detalhe, user_id)
    VALUES (NEW.id, NEW.lead_id, NEW.client_id, NEW.proposal_id, 'etapa_alterada', 'Mudança de etapa', OLD.etapa::text||' → '||NEW.etapa::text, auth.uid());
  END IF;
  IF NEW.responsavel_id IS DISTINCT FROM OLD.responsavel_id THEN
    INSERT INTO public.crm_historico(oportunidade_id, lead_id, client_id, tipo, titulo, user_id)
    VALUES (NEW.id, NEW.lead_id, NEW.client_id, 'responsavel_alterado', 'Responsável alterado', auth.uid());
  END IF;
  RETURN NULL;
END $function$;

DROP TRIGGER IF EXISTS trg_oport_audit ON public.crm_oportunidades;
CREATE TRIGGER trg_oport_audit_before BEFORE INSERT OR UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.crm_oport_audit_before();
CREATE TRIGGER trg_oport_audit_after AFTER INSERT OR UPDATE ON public.crm_oportunidades
  FOR EACH ROW EXECUTE FUNCTION public.crm_oport_audit_after();