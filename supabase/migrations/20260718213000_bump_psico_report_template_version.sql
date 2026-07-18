-- A idempotencia da emissao considera o hash do snapshot e a versao do
-- template. O template 1.0.1 corrige o fuso do carimbo de aprovacao, portanto
-- deve materializar uma nova revisao mesmo quando os dados aprovados nao mudam.
DO $$
DECLARE
  v_assinatura regprocedure :=
    'public.psico_preparar_emissao_relatorio(uuid,text,text)'::regprocedure;
  v_definicao text;
  v_versao_anterior constant text :=
    'v_modelo_versao text := ''1.0.0''';
  v_versao_nova constant text :=
    'v_modelo_versao text := ''1.0.1''';
BEGIN
  SELECT pg_get_functiondef(v_assinatura)
  INTO v_definicao;

  IF position(v_versao_anterior IN v_definicao) = 0 THEN
    RAISE EXCEPTION
      'psico_preparar_emissao_relatorio nao esta na versao esperada 1.0.0';
  END IF;

  v_definicao := replace(v_definicao, v_versao_anterior, v_versao_nova);
  EXECUTE v_definicao;
END
$$;

REVOKE ALL ON FUNCTION public.psico_preparar_emissao_relatorio(uuid, text, text)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.psico_preparar_emissao_relatorio(uuid, text, text)
TO authenticated, service_role;
