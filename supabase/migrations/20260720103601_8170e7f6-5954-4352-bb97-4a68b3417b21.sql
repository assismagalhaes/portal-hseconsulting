ALTER FUNCTION public.psico_importacao_commit_bruta(uuid, jsonb)
  SET search_path = public, extensions;

ALTER FUNCTION public.psico_importacao_commit_agregada(uuid, jsonb, jsonb)
  SET search_path = public, extensions;