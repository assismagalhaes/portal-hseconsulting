
ALTER TABLE public.projetos
  ADD COLUMN IF NOT EXISTS responsavel_execucao_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projetos_responsavel_execucao ON public.projetos(responsavel_execucao_id);

-- Atualiza a função de acesso ao projeto para incluir o responsável de execução
CREATE OR REPLACE FUNCTION public.user_can_access_projeto(_uid uuid, _projeto_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL AND (
    public.can_see_internal(_uid)
    OR public.has_role(_uid, 'financeiro')
    OR public.user_has_override(_uid, 'ver_financeiro', NULL)
    OR public.user_has_override(_uid, 'acessar_projeto', _projeto_id)
    OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = _projeto_id AND (p.gestor_id = _uid OR p.responsavel_comercial_id = _uid OR p.responsavel_execucao_id = _uid))
    OR EXISTS (SELECT 1 FROM public.projeto_servicos ps WHERE ps.projeto_id = _projeto_id AND ps.responsavel_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.ordens_servico os
       JOIN public.os_equipe oe ON oe.os_id = os.id
       JOIN public.execucao_profissionais ep ON ep.id = oe.profissional_id
       WHERE os.projeto_id = _projeto_id AND ep.auth_user_id = _uid)
    OR EXISTS (SELECT 1 FROM public.ordens_servico os WHERE os.projeto_id = _projeto_id AND os.responsavel_tecnico_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.execucao_servicos es
       JOIN public.execucao_servico_equipe ese ON ese.execucao_id = es.id
       JOIN public.execucao_profissionais ep ON ep.id = ese.profissional_id
       JOIN public.projeto_servicos ps ON ps.proposal_item_id = es.proposal_item_id
       WHERE ps.projeto_id = _projeto_id AND ep.auth_user_id = _uid)
    OR EXISTS (
      SELECT 1 FROM public.execucao_servicos es
       JOIN public.projeto_servicos ps ON ps.proposal_item_id = es.proposal_item_id
       WHERE ps.projeto_id = _projeto_id AND es.responsavel_tecnico_id = _uid)
  )
$function$;

-- Trigger para registrar mudança de responsável de execução na timeline
CREATE OR REPLACE FUNCTION public.projeto_audit_responsavel_execucao()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_nome text;
BEGIN
  IF NEW.responsavel_execucao_id IS DISTINCT FROM OLD.responsavel_execucao_id THEN
    SELECT nome INTO v_nome FROM public.profiles WHERE id = NEW.responsavel_execucao_id;
    INSERT INTO public.projeto_timeline(projeto_id, evento, detalhe, user_id)
    VALUES (NEW.id, 'Responsável de execução alterado',
            COALESCE('Novo responsável: ' || v_nome, 'Responsável removido'),
            auth.uid());
  END IF;
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS trg_projeto_audit_resp_exec ON public.projetos;
CREATE TRIGGER trg_projeto_audit_resp_exec
AFTER UPDATE ON public.projetos
FOR EACH ROW EXECUTE FUNCTION public.projeto_audit_responsavel_execucao();
