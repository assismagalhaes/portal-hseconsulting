-- Atualiza a versao documental após incluir a marca do cliente no quadro da
-- organizacao, padronizar o inicio dos textos operacionais e ampliar o rodape.
DO $migration$
DECLARE
  v_definition text;
  v_new text;
BEGIN
  SELECT pg_get_functiondef(
    'public.psico_preparar_emissao_relatorio(uuid, text, text)'::regprocedure
  )
  INTO v_definition;

  IF v_definition IS NULL THEN
    RAISE EXCEPTION 'psico_preparar_emissao_relatorio nao encontrada';
  END IF;

  IF position('v_modelo_versao text := ''1.6.1''' IN v_definition) > 0 THEN
    RETURN;
  END IF;

  IF position('v_modelo_versao text := ''1.6.0''' IN v_definition) = 0 THEN
    RAISE EXCEPTION
      'Versao base inesperada em psico_preparar_emissao_relatorio';
  END IF;

  v_new := replace(
    v_definition,
    'v_modelo_versao text := ''1.6.0''',
    'v_modelo_versao text := ''1.6.1'''
  );

  EXECUTE v_new;
END
$migration$;
