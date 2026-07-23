
CREATE OR REPLACE FUNCTION public.psico_rate_limit_hit(_bucket text, _key_hash text, _window_seconds integer, _max integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_bucket_start timestamptz := to_timestamp(floor(extract(epoch from v_now) / _window_seconds) * _window_seconds);
  v_count integer;
BEGIN
  -- UPSERT: se existe row (bucket,key_hash), incrementa se ainda na mesma janela, senão reseta para 1.
  INSERT INTO public.psico_rate_limits(bucket, key_hash, window_start, count, updated_at)
  VALUES (_bucket, _key_hash, v_bucket_start, 1, v_now)
  ON CONFLICT (bucket, key_hash) DO UPDATE
    SET count        = (CASE WHEN psico_rate_limits.window_start >= EXCLUDED.window_start
                             THEN psico_rate_limits.count + 1 ELSE 1 END),
        window_start = (CASE WHEN psico_rate_limits.window_start >= EXCLUDED.window_start
                             THEN psico_rate_limits.window_start ELSE EXCLUDED.window_start END),
        updated_at   = v_now
  RETURNING count INTO v_count;
  RETURN v_count <= _max;
END;
$function$;
