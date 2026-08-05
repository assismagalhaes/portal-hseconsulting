-- A politica de acesso do modulo psicossocial ja usa can_see_psico(), que
-- acrescenta o perfil tecnico aos perfis internos. Algumas RPCs, porem,
-- continuaram com o gate legado can_see_internal(), bloqueando o tecnico
-- antes mesmo de a RLS das tabelas ser avaliada.
--
-- Recria somente as RPCs usadas pela aba de resultados. Funcoes de cadastro,
-- configuracao, publicacao, revisao e emissao permanecem inalteradas.
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
         'psico_validar_processamento_resultados',
         'psico_processar_resultados',
         'psico_obter_resultado_resumo',
         'psico_listar_escopos_resultado',
         'psico_obter_resultados_fatores',
         'psico_obter_resultados_perguntas',
         'psico_obter_dashboard_resultados',
         'psico_obter_interpretacao_executiva',
         'psico_obter_comparacao_segmentacoes'
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
       'psico_validar_processamento_resultados',
       'psico_processar_resultados',
       'psico_obter_resultado_resumo',
       'psico_listar_escopos_resultado',
       'psico_obter_resultados_fatores',
       'psico_obter_resultados_perguntas',
       'psico_obter_dashboard_resultados',
       'psico_obter_interpretacao_executiva',
       'psico_obter_comparacao_segmentacoes'
     ])
     AND pg_get_functiondef(p.oid) LIKE '%can_see_internal%';

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION '% RPC(s) de resultados ainda usam can_see_internal', v_remaining;
  END IF;

  RAISE NOTICE '% RPC(s) de resultados atualizada(s) para can_see_psico', v_changed;
END
$migration$;

REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;
