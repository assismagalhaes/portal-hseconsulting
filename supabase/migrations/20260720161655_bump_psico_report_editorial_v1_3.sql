-- O redesenho editorial altera a apresentação e a leitura técnica do PDF.
-- Uma nova revisão deve ser criada em vez de reutilizar uma emissão 1.2.0.
DO $migration$
DECLARE
  v_definition text;
BEGIN
  SELECT pg_get_functiondef('public.psico_preparar_emissao_relatorio(uuid,text,text)'::regprocedure)
    INTO v_definition;

  IF position('v_modelo_versao text := ''1.3.0''' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position('v_modelo_versao text := ''1.2.0''' IN v_definition) = 0 THEN
    RAISE EXCEPTION 'Versao base inesperada em psico_preparar_emissao_relatorio';
  END IF;

  v_definition := replace(
    v_definition,
    'v_modelo_versao text := ''1.2.0''',
    'v_modelo_versao text := ''1.3.0'''
  );

  EXECUTE v_definition;
END
$migration$;
