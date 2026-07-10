-- Fase 1: multi-CNPJ por proposta (apenas exibição)
CREATE TABLE public.proposal_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proposal_id uuid NOT NULL REFERENCES public.proposals(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  papel text NOT NULL DEFAULT 'coligada' CHECK (papel IN ('principal','coligada')),
  ordem integer NOT NULL DEFAULT 0,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (proposal_id, client_id)
);

CREATE UNIQUE INDEX proposal_clients_one_principal
  ON public.proposal_clients (proposal_id)
  WHERE papel = 'principal';

CREATE INDEX proposal_clients_proposal_idx ON public.proposal_clients(proposal_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.proposal_clients TO authenticated;
GRANT SELECT ON public.proposal_clients TO anon;
GRANT ALL ON public.proposal_clients TO service_role;

ALTER TABLE public.proposal_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados leem proposal_clients"
  ON public.proposal_clients FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados gerenciam proposal_clients"
  ON public.proposal_clients FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- Leitura pública para a tela de aceite (mesma lógica de proposal_items/proposals no aceite público)
CREATE POLICY "Leitura publica proposal_clients via aceite"
  ON public.proposal_clients FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.proposal_aceites pa
    WHERE pa.proposal_id = proposal_clients.proposal_id
  ));

-- Sincroniza proposals.client_id com o papel = principal
CREATE OR REPLACE FUNCTION public.sync_proposal_principal_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') AND NEW.papel = 'principal' THEN
    UPDATE public.proposals
       SET client_id = NEW.client_id
     WHERE id = NEW.proposal_id
       AND (client_id IS DISTINCT FROM NEW.client_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_sync_proposal_principal_client
AFTER INSERT OR UPDATE ON public.proposal_clients
FOR EACH ROW EXECUTE FUNCTION public.sync_proposal_principal_client();

-- Ao criar/alterar proposta com client_id, garante linha principal em proposal_clients
CREATE OR REPLACE FUNCTION public.ensure_proposal_principal_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se já existe alguém como principal com esse client_id, nada a fazer
  IF EXISTS (
    SELECT 1 FROM public.proposal_clients
    WHERE proposal_id = NEW.id AND papel = 'principal' AND client_id = NEW.client_id
  ) THEN
    RETURN NEW;
  END IF;

  -- Remove principal antigo (se cliente principal mudou)
  UPDATE public.proposal_clients
     SET papel = 'coligada'
   WHERE proposal_id = NEW.id AND papel = 'principal';

  -- Se o novo client_id já está como coligada, promove; senão insere
  IF EXISTS (
    SELECT 1 FROM public.proposal_clients
    WHERE proposal_id = NEW.id AND client_id = NEW.client_id
  ) THEN
    UPDATE public.proposal_clients
       SET papel = 'principal'
     WHERE proposal_id = NEW.id AND client_id = NEW.client_id;
  ELSE
    INSERT INTO public.proposal_clients (proposal_id, client_id, papel, ordem)
    VALUES (NEW.id, NEW.client_id, 'principal', 0);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ensure_proposal_principal_row
AFTER INSERT OR UPDATE OF client_id ON public.proposals
FOR EACH ROW EXECUTE FUNCTION public.ensure_proposal_principal_row();

-- Backfill: cada proposta existente com client_id vira 'principal' em proposal_clients
INSERT INTO public.proposal_clients (proposal_id, client_id, papel, ordem)
SELECT id, client_id, 'principal', 0
FROM public.proposals
WHERE client_id IS NOT NULL
ON CONFLICT (proposal_id, client_id) DO NOTHING;