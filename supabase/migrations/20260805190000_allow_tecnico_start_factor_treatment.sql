-- Responsaveis tecnicos possuem acesso ao modulo psicossocial por
-- can_see_psico(). A inicializacao do tratamento por fator ainda passava
-- pelo gate legado can_see_internal(), inclusive na geracao interna das
-- recomendacoes, e por isso falhava com ACESSO_NEGADO.
DO $migration$
DECLARE
  v_function record;
  v_definition text;
  v_updated_definition text;
  v_changed integer := 0;
  v_remaining integer;
BEGIN
  IF to_regprocedure('public.can_see_psico(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Funcao de autorizacao public.can_see_psico(uuid) nao encontrada';
  END IF;

  FOR v_function IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND p.proname = ANY (ARRAY[
         'psico_criar_revisao_tecnica',
         'psico_gerar_recomendacoes_internal'
       ])
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

  SELECT count(*)
    INTO v_remaining
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind = 'f'
     AND p.proname = ANY (ARRAY[
       'psico_criar_revisao_tecnica',
       'psico_gerar_recomendacoes_internal'
     ])
     AND pg_get_functiondef(p.oid) LIKE '%can_see_internal%';

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION '% RPC(s) do tratamento por fator ainda usam can_see_internal', v_remaining;
  END IF;

  RAISE NOTICE '% RPC(s) do tratamento por fator atualizada(s) para can_see_psico', v_changed;
END
$migration$;

REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.psico_criar_revisao_tecnica(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_criar_revisao_tecnica(uuid, text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.psico_gerar_recomendacoes_internal(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_gerar_recomendacoes_internal(uuid, boolean) TO authenticated, service_role;
