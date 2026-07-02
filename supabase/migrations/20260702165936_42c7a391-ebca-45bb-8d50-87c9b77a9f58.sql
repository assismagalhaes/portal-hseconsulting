
CREATE OR REPLACE FUNCTION public.proposal_sync_emissao_inicial()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.valor_total IS DISTINCT FROM OLD.valor_total THEN
    UPDATE public.proposal_revisions
       SET valor_novo = COALESCE(NEW.valor_total, 0),
           diferenca_valor = COALESCE(NEW.valor_total, 0)
     WHERE proposal_id = NEW.id
       AND tipo = 'emissao_inicial'
       AND NOT EXISTS (
         SELECT 1 FROM public.proposal_revisions r2
          WHERE r2.proposal_id = NEW.id AND r2.revisao > 1
       );
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_proposal_sync_emissao_inicial ON public.proposals;
CREATE TRIGGER trg_proposal_sync_emissao_inicial
  AFTER UPDATE OF valor_total ON public.proposals
  FOR EACH ROW EXECUTE FUNCTION public.proposal_sync_emissao_inicial();

-- Backfill: sincronizar revisões iniciais existentes que ficaram com valor_novo desatualizado
UPDATE public.proposal_revisions r
   SET valor_novo = COALESCE(p.valor_total, 0),
       diferenca_valor = COALESCE(p.valor_total, 0)
  FROM public.proposals p
 WHERE r.proposal_id = p.id
   AND r.tipo = 'emissao_inicial'
   AND r.revisao = 1
   AND r.valor_novo IS DISTINCT FROM COALESCE(p.valor_total, 0)
   AND NOT EXISTS (
     SELECT 1 FROM public.proposal_revisions r2
      WHERE r2.proposal_id = p.id AND r2.revisao > 1
   );
