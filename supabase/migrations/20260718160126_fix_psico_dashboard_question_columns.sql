-- Corrige o contrato da RPC do dashboard sem duplicar sua definição extensa.
-- psico_perguntas usa texto/sentido_pontuacao; a RPC publicada ainda
-- referenciava as colunas inexistentes enunciado/inversa.
DO $migration$
DECLARE
  v_function regprocedure := to_regprocedure('public.psico_obter_dashboard_resultados(uuid,uuid)');
  v_definition text;
  v_old_fragment text := 'pg.enunciado, pg.inversa,';
  v_new_fragment text := 'pg.texto AS enunciado, (pg.sentido_pontuacao = ''invertida'') AS inversa,';
BEGIN
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'Função psico_obter_dashboard_resultados(uuid,uuid) não localizada.';
  END IF;

  SELECT pg_get_functiondef(v_function) INTO v_definition;

  IF position(v_old_fragment IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Fragmento legado da RPC não localizado; migration interrompida para revisão.';
  END IF;

  EXECUTE replace(v_definition, v_old_fragment, v_new_fragment);
END;
$migration$;
