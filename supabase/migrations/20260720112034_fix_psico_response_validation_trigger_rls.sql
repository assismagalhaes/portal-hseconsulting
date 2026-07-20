-- O constraint trigger e INITIALLY DEFERRED e pode executar somente no commit,
-- depois que uma RPC SECURITY DEFINER ja restaurou o papel do chamador.
-- Como psico_respostas usa RLS default-deny, o trigger precisa executar com o
-- proprietario da funcao para validar o registro-pai e seus 35 itens.
ALTER FUNCTION public.psico_respostas_validar_35()
  SECURITY DEFINER;

ALTER FUNCTION public.psico_respostas_validar_35()
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.psico_respostas_validar_35() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_respostas_validar_35() TO authenticated, service_role;
