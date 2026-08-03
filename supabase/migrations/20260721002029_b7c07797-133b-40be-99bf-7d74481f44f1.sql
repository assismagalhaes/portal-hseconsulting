CREATE OR REPLACE FUNCTION public.psico_gerar_link_publico(p_avaliacao_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_alphabet text := 'abcdefghjkmnpqrstuvwxyz23456789';
  v_len int := 10;
  v_i int;
  v_try int := 0;
  v_exists boolean;
BEGIN
  IF NOT public.can_see_internal(auth.uid()) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  LOOP
    v_token := '';
    FOR v_i IN 1..v_len LOOP
      v_token := v_token || substr(v_alphabet, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(v_alphabet)), 1);
    END LOOP;

    SELECT EXISTS (SELECT 1 FROM public.psico_avaliacoes WHERE link_publico_token = v_token) INTO v_exists;
    EXIT WHEN NOT v_exists;
    v_try := v_try + 1;
    IF v_try > 8 THEN v_len := v_len + 1; v_try := 0; END IF;
  END LOOP;

  UPDATE public.psico_avaliacoes
     SET link_publico_token = v_token,
         modo_coleta = 'publico_anonimo',
         updated_at = now()
   WHERE id = p_avaliacao_id;

  RETURN v_token;
END;
$$;

REVOKE ALL ON FUNCTION public.psico_gerar_link_publico(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.psico_gerar_link_publico(uuid) TO authenticated, service_role;