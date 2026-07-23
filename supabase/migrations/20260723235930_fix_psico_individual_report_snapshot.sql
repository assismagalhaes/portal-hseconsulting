-- Corrige referências de colunas e autorização interna no snapshot já publicado.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.psico_ind_snapshot_relatorio(uuid)'::regprocedure)
    INTO v_def;
  v_def := replace(v_def, '''data_referencia'', av.data_referencia',
    '''data_referencia'', coalesce(av.data_fim_prevista, av.data_inicio_prevista, av.created_at::date)');
  v_def := replace(v_def, 'c.id = av.client_id', 'c.id = av.cliente_id');
  v_def := regexp_replace(
    v_def,
    'IF coalesce\(auth\.jwt\(\) ->> ''role'',''''\) <> ''service_role'' THEN',
    'IF coalesce(auth.jwt() ->> ''role'','''') <> ''service_role'' AND NOT public.can_see_internal(auth.uid()) THEN',
    'i'
  );
  EXECUTE v_def;
END $$;

-- Serializa a numeração de relatórios da mesma avaliação. O índice único da
-- migração anterior permanece como última barreira de integridade.
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.psico_ind_preparar_relatorio(uuid,text,text)'::regprocedure)
    INTO v_def;
  IF position('pg_advisory_xact_lock' IN v_def)=0 THEN
    v_def := replace(
      v_def,
      'v_gates := public.psico_ind_gates_emissao(p_avaliacao);',
      'PERFORM pg_advisory_xact_lock(hashtextextended(p_avaliacao::text, 0));' || chr(10) ||
      '  v_gates := public.psico_ind_gates_emissao(p_avaliacao);'
    );
  END IF;
  EXECUTE v_def;
END $$;
