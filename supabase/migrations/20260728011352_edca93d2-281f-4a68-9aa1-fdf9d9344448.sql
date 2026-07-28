-- A migração já foi aplicada via supabase--migration no turno anterior, 
-- mas o registro na schema_migrations falhou por ser "read-only" no read_query.
-- Vou usar supabase--migration para garantir o registro da versão, 
-- já que a ferramenta de migração tem permissão de escrita.

INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260727184052') ON CONFLICT DO NOTHING;
GRANT EXECUTE ON FUNCTION public.psico_aplicar_plano_ia_strict_v1(uuid, jsonb, text, text) TO service_role;
