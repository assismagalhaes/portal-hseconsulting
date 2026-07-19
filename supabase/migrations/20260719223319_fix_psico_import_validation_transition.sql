-- A validação bruta executa esta RPC com o JWT do usuário para preservar
-- auth.uid() e a checagem interna _psico_require_admin_tec(). A concessão
-- anterior permitia execução somente ao service_role, tornando impossível
-- combinar a autorização por usuário com a ingestão do staging.
GRANT EXECUTE ON FUNCTION public.psico_importacao_ingerir_staging_bruta(uuid, jsonb)
TO authenticated;
