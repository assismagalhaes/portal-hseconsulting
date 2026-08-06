-- Corrige a autorizacao transitiva do fluxo "Marcar como revisado".
--
-- A auditoria anterior atualizou as RPCs publicas, mas a validacao chama a
-- funcao-base psico_validar_revisao_tecnica_sem_parecer_v1_4(), que ainda
-- usava can_see_internal() e devolvia ACESSO_NEGADO para o perfil tecnico.
DO $migration$
DECLARE
  v_function record;
  v_definition text;
  v_updated_definition text;
  v_changed integer := 0;
  v_remaining text;
  v_names constant text[] := ARRAY[
    'psico_marcar_plano_revisado',
    'psico_validar_revisao_tecnica',
    'psico_validar_revisao_tecnica_sem_parecer_v1_4'
  ];
BEGIN
  IF to_regprocedure('public.can_see_psico(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Funcao de autorizacao public.can_see_psico(uuid) nao encontrada';
  END IF;

  IF to_regprocedure('public.psico_marcar_plano_revisado(uuid)') IS NULL
     OR to_regprocedure('public.psico_validar_revisao_tecnica(uuid)') IS NULL
     OR to_regprocedure('public.psico_validar_revisao_tecnica_sem_parecer_v1_4(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Cadeia de validacao do plano psicossocial incompleta';
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
    v_changed := v_changed + 1;
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
    RAISE EXCEPTION 'Gate legado ainda presente em: %', v_remaining;
  END IF;

  RAISE NOTICE '% funcao(oes) da cadeia do plano atualizada(s) para can_see_psico', v_changed;
END
$migration$;

-- Somente as duas RPCs de entrada continuam expostas ao usuario autenticado.
-- A funcao sem_parecer permanece interna e e executada pela cadeia SECURITY
-- DEFINER, evitando ampliar desnecessariamente a superficie da Data API.
REVOKE ALL ON FUNCTION public.psico_marcar_plano_revisado(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_marcar_plano_revisado(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.psico_validar_revisao_tecnica(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_validar_revisao_tecnica(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.psico_validar_revisao_tecnica_sem_parecer_v1_4(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.psico_validar_revisao_tecnica_sem_parecer_v1_4(uuid)
  TO service_role;

REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;
