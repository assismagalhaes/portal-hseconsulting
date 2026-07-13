
-- When proposta sai de 'aprovada', cancelar o projeto vinculado (para não aparecer nos projetos ativos).
-- Quando voltar a 'aprovada', reativar o projeto existente (planejamento) em vez de criar duplicata.

CREATE OR REPLACE FUNCTION public.projetos_on_proposal_aprovada()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing uuid;
BEGIN
  IF NEW.status = 'aprovada' AND (OLD.status IS DISTINCT FROM 'aprovada') THEN
    SELECT id INTO v_existing FROM public.projetos WHERE proposal_id = NEW.id LIMIT 1;
    IF v_existing IS NULL THEN
      PERFORM public.criar_projeto_da_proposta(NEW.id);
    ELSE
      -- Reativar projeto previamente cancelado por reversão de status
      UPDATE public.projetos
         SET status = 'planejamento', updated_at = now()
       WHERE id = v_existing AND status = 'cancelado';
    END IF;
  ELSIF OLD.status = 'aprovada' AND NEW.status IS DISTINCT FROM 'aprovada' THEN
    -- Reversão: cancelar projeto vinculado para removê-lo das visões ativas.
    UPDATE public.projetos
       SET status = 'cancelado', updated_at = now()
     WHERE proposal_id = NEW.id
       AND status <> 'cancelado';
  END IF;
  RETURN NEW;
END
$$;

-- Corrigir o caso relatado (P-2026-42989): proposta voltou para negociação mas projeto ficou em planejamento.
UPDATE public.projetos
   SET status = 'cancelado', updated_at = now()
 WHERE proposal_id IN (
   SELECT id FROM public.proposals WHERE status <> 'aprovada'
 )
 AND status IN ('planejamento','em_execucao','em_revisao','atrasado');
