-- Fecha as lacunas de autorizacao do perfil tecnico no fluxo operacional
-- psicossocial coletivo. can_see_psico() inclui admin, comercial e tecnico;
-- as operacoes administrativas/destrutivas permanecem fora desta lista.
DO $migration$
DECLARE
  v_function record;
  v_definition text;
  v_updated_definition text;
  v_changed integer := 0;
  v_remaining integer;
  v_names constant text[] := ARRAY[
    -- avaliacao, participantes e coleta
    'psico_vincular_versao_vigente',
    'psico_atualizar_participante',
    'psico_gerar_link_publico',
    'psico_abrir_coleta',
    'psico_prorrogar_coleta',
    'psico_encerrar_coleta',
    'psico_resumo_coleta',
    -- resultados
    'psico_validar_processamento_resultados',
    'psico_processar_resultados',
    'psico_obter_resultado_resumo',
    'psico_listar_escopos_resultado',
    'psico_obter_resultados_fatores',
    'psico_obter_resultados_perguntas',
    'psico_obter_dashboard_resultados',
    'psico_obter_interpretacao_executiva',
    'psico_obter_comparacao_segmentacoes',
    -- tratamento por fator e plano de acao
    'psico_criar_revisao_tecnica',
    'psico_gerar_recomendacoes_internal',
    'psico_regenerar_recomendacoes',
    'psico_marcar_plano_revisado',
    'psico_validar_revisao_tecnica',
    -- IA do plano e do parecer
    'psico_obter_contexto_plano_ia',
    'psico_aplicar_plano_ia',
    'psico_obter_contexto_parecer_ia',
    'psico_salvar_parecer_conclusivo',
    -- revisao tecnica
    'psico_aprovar_revisao_tecnica',
    -- relatorio: validar, emitir e baixar
    'psico_validar_emissao_relatorio',
    'psico_obter_conteudo_aprovado_relatorio',
    'psico_preparar_emissao_relatorio',
    'psico_obter_versao_download'
  ];
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

  SELECT count(*)
    INTO v_remaining
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.prokind = 'f'
     AND p.proname = ANY (v_names)
     AND pg_get_functiondef(p.oid) LIKE '%can_see_internal%';

  IF v_remaining <> 0 THEN
    RAISE EXCEPTION '% RPC(s) operacionais ainda usam can_see_internal', v_remaining;
  END IF;

  -- Recriar uma funcao preserva ACL no PostgreSQL, mas estes grants explicitos
  -- garantem o contrato do modulo e removem a heranca insegura de PUBLIC/anon.
  FOR v_function IN
    SELECT p.oid, p.oid::regprocedure AS signature
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.prokind = 'f'
       AND p.proname = ANY (v_names)
     ORDER BY p.oid
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', v_function.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', v_function.signature);
  END LOOP;

  REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;

  RAISE NOTICE '% RPC(s) operacionais atualizada(s) para can_see_psico', v_changed;
END
$migration$;

-- As tabelas psico_* ja possuem RLS por can_see_psico(). Esta verificacao
-- falha de forma fechada se alguma tabela operacional estiver sem RLS.
DO $rls_audit$
DECLARE
  v_without_rls text;
BEGIN
  SELECT string_agg(format('%I.%I', n.nspname, c.relname), ', ' ORDER BY c.relname)
    INTO v_without_rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relkind = 'r'
     AND c.relname LIKE 'psico\_%' ESCAPE '\'
     AND NOT c.relrowsecurity;

  IF v_without_rls IS NOT NULL THEN
    RAISE EXCEPTION 'Tabelas psicossociais sem RLS: %', v_without_rls;
  END IF;
END
$rls_audit$;

-- Permanecem intencionalmente fora do acesso tecnico:
-- psico_reabrir_revisao_tecnica (administrador),
-- psico_revogar_versao_relatorio (administrador),
-- publicacao/duplicacao de questionarios e bibliotecas (administrador),
-- remocao administrativa de respostas publicas (administrador).
