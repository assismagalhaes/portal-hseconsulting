-- Correção PR1: função psico_ind_ler_respostas_livres estava condicionada a
-- can_see_internal(auth.uid()), o que rejeitava chamadas legítimas do service_role
-- (onde auth.uid() é NULL). Como a função é exclusivamente concedida ao service_role
-- (REVOKE de PUBLIC/anon/authenticated), o filtro adicional é redundante e quebrava
-- o único caminho de leitura previsto.

CREATE OR REPLACE FUNCTION public.psico_ind_ler_respostas_livres(_formulario_id uuid)
RETURNS SETOF public.psico_individual_respostas_livres
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.psico_individual_respostas_livres
  WHERE formulario_id = _formulario_id;
$$;

REVOKE ALL ON FUNCTION public.psico_ind_ler_respostas_livres(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.psico_ind_ler_respostas_livres(uuid) FROM anon;
REVOKE ALL ON FUNCTION public.psico_ind_ler_respostas_livres(uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.psico_ind_ler_respostas_livres(uuid) TO service_role;