-- A implementação estrita é um detalhe interno da RPC pública sanitizadora.
-- O Lovable concedeu EXECUTE novamente ao service_role durante a reconciliação;
-- revogamos o acesso direto para que todos os chamadores passem pela mesma
-- política de monitoramento opcional.
REVOKE ALL ON FUNCTION public.psico_aplicar_plano_ia_strict_v1(
  uuid,
  jsonb,
  text,
  text
) FROM PUBLIC, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.psico_aplicar_plano_ia(
  uuid,
  jsonb,
  text,
  text
) TO authenticated, service_role;
