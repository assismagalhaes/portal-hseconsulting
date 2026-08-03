CREATE OR REPLACE FUNCTION public.psico_hash_snapshot(p_snapshot jsonb)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT encode(
    extensions.digest(convert_to(p_snapshot::text, 'UTF8'), 'sha256'::text),
    'hex'
  )
$$;