-- Keep company identifiers unique even when a form is submitted more than once.
-- Existing records are intentionally not deleted; the trigger blocks new duplicates
-- while allowing the current data set to be reviewed and cleaned up safely.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_client_identifier()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  normalized text;
BEGIN
  normalized := NULLIF(regexp_replace(trim(COALESCE(NEW.cnpj_cpf, '')), '\D', '', 'g'), '');
  IF normalized IS NULL THEN
    RETURN NEW;
  END IF;

  -- Serialize concurrent submissions for the same CNPJ/CPF.
  PERFORM pg_advisory_xact_lock(hashtextextended(normalized, 0));

  IF EXISTS (
    SELECT 1
    FROM public.clients c
    WHERE c.id IS DISTINCT FROM NEW.id
      AND NULLIF(regexp_replace(trim(COALESCE(c.cnpj_cpf, '')), '\D', '', 'g'), '') = normalized
  ) THEN
    RAISE EXCEPTION 'Já existe um cliente cadastrado com este CNPJ/CPF.'
      USING ERRCODE = '23505', CONSTRAINT = 'clients_cnpj_cpf_unique';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_prevent_duplicate_identifier ON public.clients;
CREATE TRIGGER trg_clients_prevent_duplicate_identifier
  BEFORE INSERT OR UPDATE OF cnpj_cpf ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_client_identifier();
