
-- pgcrypto vive em "extensions"; inclui esse schema no search_path da função de hash
ALTER FUNCTION public.psico_hash_entrada_resultado(uuid) SET search_path = public, extensions;
