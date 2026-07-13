
CREATE OR REPLACE FUNCTION public.sync_proposal_followup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_id uuid;
  v_op_id uuid;
BEGIN
  -- Nada a fazer se a data não mudou.
  IF TG_OP = 'UPDATE'
     AND NEW.proximo_followup IS NOT DISTINCT FROM OLD.proximo_followup
     AND NEW.client_id IS NOT DISTINCT FROM OLD.client_id THEN
    RETURN NEW;
  END IF;

  IF NEW.proximo_followup IS NULL THEN
    -- Data foi limpa → remove follow-up pendente vinculado à proposta.
    DELETE FROM public.crm_followups
     WHERE proposal_id = NEW.id AND status = 'pendente';
    RETURN NEW;
  END IF;

  SELECT id INTO v_op_id
    FROM public.crm_oportunidades
   WHERE proposal_id = NEW.id
   LIMIT 1;

  SELECT id INTO v_existing_id
    FROM public.crm_followups
   WHERE proposal_id = NEW.id AND status = 'pendente'
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    UPDATE public.crm_followups
       SET proximo_followup_data = NEW.proximo_followup,
           client_id = COALESCE(client_id, NEW.client_id),
           oportunidade_id = COALESCE(oportunidade_id, v_op_id),
           updated_at = now()
     WHERE id = v_existing_id;
  ELSE
    INSERT INTO public.crm_followups(
      proposal_id, client_id, oportunidade_id,
      tipo, data, status,
      responsavel_id, created_by,
      resumo, proxima_acao, proximo_followup_data
    ) VALUES (
      NEW.id, NEW.client_id, v_op_id,
      'outro', CURRENT_DATE, 'pendente',
      NEW.created_by, NEW.created_by,
      'Follow-up agendado a partir da proposta ' || COALESCE(NEW.numero, ''),
      'Retornar contato sobre a proposta',
      NEW.proximo_followup
    );
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_proposal_followup ON public.proposals;
CREATE TRIGGER trg_sync_proposal_followup
AFTER INSERT OR UPDATE OF proximo_followup, client_id
ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.sync_proposal_followup();

-- Backfill: cria follow-ups pendentes para propostas que já têm data preenchida.
INSERT INTO public.crm_followups(
  proposal_id, client_id, oportunidade_id,
  tipo, data, status,
  responsavel_id, created_by,
  resumo, proxima_acao, proximo_followup_data
)
SELECT p.id, p.client_id,
       (SELECT id FROM public.crm_oportunidades o WHERE o.proposal_id = p.id LIMIT 1),
       'outro', CURRENT_DATE, 'pendente',
       p.created_by, p.created_by,
       'Follow-up agendado a partir da proposta ' || COALESCE(p.numero, ''),
       'Retornar contato sobre a proposta',
       p.proximo_followup
  FROM public.proposals p
 WHERE p.proximo_followup IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.crm_followups f
      WHERE f.proposal_id = p.id AND f.status = 'pendente'
   );
