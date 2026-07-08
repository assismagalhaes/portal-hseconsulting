
-- Permitir que participantes do projeto (inclusive Profissional Técnico) atualizem
-- serviços do projeto (status, observações, datas, progresso).
-- Mantém proteção de valores via UI e via trigger que impede técnicos de alterar valor/quantidade.

DROP POLICY IF EXISTS projeto_servicos_update_participantes ON public.projeto_servicos;
CREATE POLICY projeto_servicos_update_participantes
ON public.projeto_servicos
FOR UPDATE
TO authenticated
USING (public.user_can_access_projeto(auth.uid(), projeto_id))
WITH CHECK (public.user_can_access_projeto(auth.uid(), projeto_id));

-- Trigger: técnico puro não pode alterar campos comerciais
CREATE OR REPLACE FUNCTION public.projeto_servicos_block_tecnico_valores()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.is_tecnico() THEN
    IF NEW.valor IS DISTINCT FROM OLD.valor
       OR NEW.quantidade IS DISTINCT FROM OLD.quantidade THEN
      RAISE EXCEPTION 'Perfil técnico não pode alterar valor ou quantidade do serviço';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_projeto_servicos_block_tecnico ON public.projeto_servicos;
CREATE TRIGGER trg_projeto_servicos_block_tecnico
BEFORE UPDATE ON public.projeto_servicos
FOR EACH ROW EXECUTE FUNCTION public.projeto_servicos_block_tecnico_valores();
