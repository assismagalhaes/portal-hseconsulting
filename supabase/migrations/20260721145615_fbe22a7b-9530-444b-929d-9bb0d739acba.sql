DO $$
DECLARE
  v_definition text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef('public.psico_preparar_emissao_relatorio(uuid, text, text)'::regprocedure)
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'psico_preparar_emissao_relatorio nao encontrada';
  END IF;

  IF position('v_modelo_versao text := ''1.5.1''' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  v_new := regexp_replace(
    v_definition,
    'v_modelo_versao text := ''[^'']+''',
    'v_modelo_versao text := ''1.5.1''',
    'g'
  );

  EXECUTE v_new;
END $$;