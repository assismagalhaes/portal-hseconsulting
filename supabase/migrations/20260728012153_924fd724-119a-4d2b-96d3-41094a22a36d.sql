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

-- Registrar a migração
INSERT INTO supabase_migrations.schema_migrations (version) VALUES ('20260728011636') ON CONFLICT (version) DO NOTHING;