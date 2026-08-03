
CREATE OR REPLACE FUNCTION public.psico_rate_limit_hit(_bucket text, _key_hash text, _window_seconds integer, _max integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz := date_trunc('second', v_now) - make_interval(secs => (extract(epoch from v_now)::bigint % _window_seconds));
  v_count integer;
BEGIN
  INSERT INTO public.psico_rate_limits(bucket, key_hash, window_start, count, updated_at)
  VALUES (_bucket, _key_hash, v_window_start, 1, v_now)
  ON CONFLICT (bucket, key_hash) DO UPDATE
    SET count = CASE WHEN public.psico_rate_limits.window_start = EXCLUDED.window_start
                     THEN public.psico_rate_limits.count + 1
                     ELSE 1 END,
        window_start = EXCLUDED.window_start,
        updated_at = v_now
  RETURNING count INTO v_count;
  RETURN v_count <= _max;
EXCEPTION WHEN OTHERS THEN
  -- Em caso de falha real do storage, falha-fechado é preferível a permitir abuso.
  RETURN false;
END;
$function$;
