-- O perfil tecnico ja possui acesso ao modulo psicossocial por can_see_psico(),
-- mas as RPCs operacionais da aba Coleta ainda usam o gate legado
-- can_see_internal(). Atualiza somente a autorizacao dessas funcoes, mantendo
-- todas as validacoes de estado, confirmacao, prazo, auditoria e integridade.
DO $migration$
DECLARE
  v_function record;
  v_definition text;
  v_updated_definition text;
  v_changed integer := 0;
  v_remaining integer;
BEGIN
  IF to_regprocedure('public.can_see_psico(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Funcao public.can_see_psico(uuid) nao encontrada';
  END IF;

  FOR v_function IN
    SELECT p.oid
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND p.proname = ANY (ARRAY[
         'psico_abrir_coleta',
         'psico_prorrogar_coleta',
         'psico_encerrar_coleta',
         'psico_resumo_coleta'
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
       'psico_abrir_coleta',
       'psico_prorrogar_coleta',
       'psico_encerrar_coleta',
       'psico_resumo_coleta'
     ])
     AND pg_get_functiondef(p.oid) LIKE '%can_see_internal%';

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION '% RPC(s) da coleta ainda usam can_see_internal', v_remaining;
  END IF;

  IF v_changed = 0 THEN
    RAISE NOTICE 'RPCs da coleta ja estavam autorizadas por can_see_psico';
  ELSE
    RAISE NOTICE '% RPC(s) da coleta atualizada(s) para can_see_psico', v_changed;
  END IF;
END
$migration$;

REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;