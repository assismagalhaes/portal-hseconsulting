ALTER FUNCTION public.psico_respostas_validar_35()
  SECURITY DEFINER;

ALTER FUNCTION public.psico_respostas_validar_35()
  SET search_path = pg_catalog, public, pg_temp;

REVOKE ALL ON FUNCTION public.psico_respostas_validar_35() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_respostas_validar_35() TO authenticated, service_role;