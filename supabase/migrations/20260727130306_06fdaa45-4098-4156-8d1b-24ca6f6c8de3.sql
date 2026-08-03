CREATE OR REPLACE FUNCTION public.psico_ind_listar_responsaveis()
RETURNS TABLE(id uuid, nome text, cargo text, origem text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ep.id, ep.nome, ep.cargo, 'profissional'::text AS origem
    FROM public.execucao_profissionais ep
   WHERE ep.situacao = 'ativo'
  UNION
  SELECT p.id, p.nome, p.cargo, 'perfil'::text AS origem
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.id
   WHERE ur.role IN ('admin','tecnico','comercial')
   ORDER BY 2;
$$;

REVOKE ALL ON FUNCTION public.psico_ind_listar_responsaveis() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_ind_listar_responsaveis() TO authenticated;