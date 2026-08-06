-- Corrige a autorizacao transitiva da aplicacao do plano gerado por IA.
--
-- A RPC publica ja foi incluida na auditoria do fluxo tecnico, mas delega a
-- persistencia para psico_aplicar_plano_ia_strict_v1(). Essa funcao interna
-- manteve o gate legado can_see_internal() e recusava o perfil tecnico depois
-- de a IA concluir a geracao.
DO $migration$
DECLARE
  v_function record;
  v_definition text;
  v_updated_definition text;
  v_remaining text;
  v_names constant text[] := ARRAY[
    'psico_aplicar_plano_ia',
    'psico_aplicar_plano_ia_strict_v1'
  ];
BEGIN
  IF to_regprocedure('public.can_see_psico(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Funcao de autorizacao public.can_see_psico(uuid) nao encontrada';
  END IF;

  IF to_regprocedure('public.psico_aplicar_plano_ia(uuid,jsonb,text,text)') IS NULL
     OR to_regprocedure('public.psico_aplicar_plano_ia_strict_v1(uuid,jsonb,text,text)') IS NULL THEN
    RAISE EXCEPTION 'Cadeia de aplicacao do plano por IA incompleta';
  END IF;

  FOR v_function IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND p.proname = ANY (v_names)
       AND pg_get_functiondef(p.oid) LIKE '%can_see_internal%'
     ORDER BY p.oid
  LOOP
    v_definition := pg_get_functiondef(v_function.oid);
    v_updated_definition := replace(
      v_definition,
      'public.can_see_internal(',
      'public.can_see_psico('
    );
    v_updated_definition := replace(
      v_updated_definition,
      'can_see_internal(',
      'public.can_see_psico('
    );
    EXECUTE v_updated_definition;
  END LOOP;

  SELECT string_agg(p.oid::regprocedure::text, ', ' ORDER BY p.oid::regprocedure::text)
    INTO v_remaining
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind = 'f'
     AND p.proname = ANY (v_names)
     AND pg_get_functiondef(p.oid) LIKE '%can_see_internal%';

  IF v_remaining IS NOT NULL THEN
    RAISE EXCEPTION 'Funcoes ainda usam can_see_internal: %', v_remaining;
  END IF;
END
$migration$;

-- Somente a fachada sanitizadora permanece exposta ao cliente autenticado.
REVOKE ALL ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_aplicar_plano_ia(uuid, jsonb, text, text)
  TO authenticated, service_role;

-- A autoridade estrita continua interna e nao pode ser chamada pelo frontend.
REVOKE ALL ON FUNCTION public.psico_aplicar_plano_ia_strict_v1(uuid, jsonb, text, text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_aplicar_plano_ia_strict_v1(uuid, jsonb, text, text)
  TO service_role;

REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;
