DO $migration$
DECLARE
  v_function regprocedure := to_regprocedure('public.psico_obter_interpretacao_executiva(uuid,uuid)');
  v_definition text;
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'Função psico_obter_interpretacao_executiva(uuid,uuid) não localizada.';
  END IF;

  SELECT pg_get_functiondef(v_function) INTO v_definition;

  IF position('WHEN ''critica'' THEN' IN v_definition) > 0
     AND position('WHEN ''alta'' THEN' IN v_definition) > 0
     AND position('WHEN ''media'' THEN' IN v_definition) > 0 THEN
    v_definition := replace(v_definition, 'WHEN ''critica'' THEN', 'WHEN ''Crítica'' THEN');
    v_definition := replace(v_definition, 'WHEN ''alta'' THEN', 'WHEN ''Alta'' THEN');
    v_definition := replace(v_definition, 'WHEN ''media'' THEN', 'WHEN ''Média'' THEN');
    EXECUTE v_definition;
  ELSIF position('WHEN ''Crítica'' THEN' IN v_definition) = 0
     OR position('WHEN ''Alta'' THEN' IN v_definition) = 0
     OR position('WHEN ''Média'' THEN' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Contrato esperado da interpretação não localizado; migration interrompida para revisão.';
  END IF;
END;
$migration$;
