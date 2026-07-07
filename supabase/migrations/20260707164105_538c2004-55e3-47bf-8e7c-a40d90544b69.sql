
-- 1. Function: is_tecnico_only
CREATE OR REPLACE FUNCTION public.is_tecnico_only()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(),'tecnico')
    AND NOT public.has_role(auth.uid(),'admin')
    AND NOT public.has_role(auth.uid(),'comercial')
    AND NOT public.has_role(auth.uid(),'financeiro')
$$;

GRANT EXECUTE ON FUNCTION public.is_tecnico_only() TO authenticated;

-- 2. Revoke direct read of financial columns for authenticated users
REVOKE SELECT (valor_contratado) ON public.projetos FROM authenticated;
REVOKE SELECT (valor) ON public.projeto_servicos FROM authenticated;

-- Ensure remaining columns remain readable for authenticated
GRANT SELECT (id, numero, titulo, proposal_id, client_id, financeiro_contrato_id,
              status, gestor_id, responsavel_comercial_id, responsavel_execucao_id,
              data_inicio, data_fim_prevista, data_fim_real, percentual_progresso,
              observacoes, created_by, updated_by, created_at, updated_at)
  ON public.projetos TO authenticated;

GRANT SELECT (id, projeto_id, proposal_item_id, service_id, nome, categoria,
              responsavel_id, status, percentual_progresso, quantidade, unidade,
              validade_meses, data_validade, data_inicio, data_conclusao,
              observacoes, created_at, updated_at)
  ON public.projeto_servicos TO authenticated;

-- 3. RPC to expose values only for non-técnico-puro users
CREATE OR REPLACE FUNCTION public.get_projetos_valores(_ids uuid[])
RETURNS TABLE(id uuid, valor_contratado numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.valor_contratado
    FROM public.projetos p
   WHERE p.id = ANY(_ids)
     AND NOT public.is_tecnico_only()
     AND public.user_can_access_projeto(auth.uid(), p.id)
$$;

GRANT EXECUTE ON FUNCTION public.get_projetos_valores(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_projeto_servicos_valores(_projeto_id uuid)
RETURNS TABLE(id uuid, valor numeric)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ps.id, ps.valor
    FROM public.projeto_servicos ps
   WHERE ps.projeto_id = _projeto_id
     AND NOT public.is_tecnico_only()
     AND public.user_can_access_projeto(auth.uid(), _projeto_id)
$$;

GRANT EXECUTE ON FUNCTION public.get_projeto_servicos_valores(uuid) TO authenticated;
