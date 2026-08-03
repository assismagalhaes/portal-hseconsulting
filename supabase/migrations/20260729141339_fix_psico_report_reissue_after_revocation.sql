-- Uma versão revogada continua ocupando seu número de revisão. A próxima
-- emissão deve avançar (R00 -> R01), enquanto uma versão falha continua
-- elegível para retentativa com o mesmo número.
DO $migration$
DECLARE
  v_validation_definition text;
  v_prepare_definition text;
BEGIN
  SELECT pg_get_functiondef(
    'public.psico_validar_emissao_relatorio(uuid)'::regprocedure
  )
  INTO v_validation_definition;

  SELECT pg_get_functiondef(
    'public.psico_preparar_emissao_relatorio(uuid, text, text)'::regprocedure
  )
  INTO v_prepare_definition;

  IF v_validation_definition IS NULL OR v_prepare_definition IS NULL THEN
    RAISE EXCEPTION 'Funcoes de emissao do relatorio psicossocial nao encontradas';
  END IF;

  IF position(
    'AND v.status IN (''emitido'',''substituido'',''revogado'')'
    IN v_validation_definition
  ) = 0 THEN
    IF position(
      'AND v.status IN (''emitido'',''substituido'')'
      IN v_validation_definition
    ) = 0 THEN
      RAISE EXCEPTION
        'Regra base inesperada em psico_validar_emissao_relatorio';
    END IF;

    v_validation_definition := replace(
      v_validation_definition,
      'AND v.status IN (''emitido'',''substituido'')',
      'AND v.status IN (''emitido'',''substituido'',''revogado'')'
    );
    EXECUTE v_validation_definition;
  END IF;

  IF position(
    'AND status IN (''emitido'', ''substituido'', ''revogado'')'
    IN v_prepare_definition
  ) = 0 THEN
    IF position(
      'AND status IN (''emitido'', ''substituido'')'
      IN v_prepare_definition
    ) = 0 THEN
      RAISE EXCEPTION
        'Regra base inesperada em psico_preparar_emissao_relatorio';
    END IF;

    v_prepare_definition := replace(
      v_prepare_definition,
      'AND status IN (''emitido'', ''substituido'')',
      'AND status IN (''emitido'', ''substituido'', ''revogado'')'
    );
    EXECUTE v_prepare_definition;
  END IF;
END
$migration$;

REVOKE ALL ON FUNCTION public.psico_validar_emissao_relatorio(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_validar_emissao_relatorio(uuid)
  TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.psico_preparar_emissao_relatorio(uuid, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_preparar_emissao_relatorio(uuid, text, text)
  TO authenticated, service_role;
