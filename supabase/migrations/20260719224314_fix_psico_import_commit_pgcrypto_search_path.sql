-- pgcrypto está instalado no schema extensions. Os commits de importação
-- geram o código da avaliação com gen_random_bytes(), portanto precisam desse
-- schema no search_path restrito das funções SECURITY DEFINER.
ALTER FUNCTION public.psico_importacao_commit_bruta(uuid, jsonb)
  SET search_path = public, extensions;

ALTER FUNCTION public.psico_importacao_commit_agregada(uuid, jsonb, jsonb)
  SET search_path = public, extensions;
