-- Alinha a interpretação executiva aos rótulos reais do enum
-- psico_prioridade_fator: Monitoramento, Média, Alta e Crítica.
DO $migration$
DECLARE
  v_function regprocedure := to_regprocedure('public.psico_obter_interpretacao_executiva(uuid,uuid)');
  v_definition text;
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'Função psico_obter_interpretacao_executiva(uuid,uuid) não localizada.';
  END IF;

  SELECT pg_get_functiondef(v_function) INTO v_definition;

  IF position('WHEN ''critica'' THEN' IN v_definition) = 0
     OR position('WHEN ''alta'' THEN' IN v_definition) = 0
     OR position('WHEN ''media'' THEN' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Comparações legadas de prioridade não localizadas; migration interrompida para revisão.';
  END IF;

  v_definition := replace(v_definition, 'WHEN ''critica'' THEN', 'WHEN ''Crítica'' THEN');
  v_definition := replace(v_definition, 'WHEN ''alta'' THEN', 'WHEN ''Alta'' THEN');
  v_definition := replace(v_definition, 'WHEN ''media'' THEN', 'WHEN ''Média'' THEN');

  EXECUTE v_definition;
END;
$migration$;
