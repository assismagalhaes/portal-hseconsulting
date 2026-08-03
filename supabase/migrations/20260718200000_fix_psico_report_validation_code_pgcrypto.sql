-- O pgcrypto esta instalado no schema extensions. Qualificar gen_random_bytes
-- preserva o search_path restrito da funcao e evita dependencia da sessao.
CREATE OR REPLACE FUNCTION public.psico_gerar_codigo_validacao()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  h text;
BEGIN
  h := upper(encode(extensions.gen_random_bytes(16), 'hex'));
  RETURN substr(h,1,4)||'-'||substr(h,5,4)||'-'||substr(h,9,4)||'-'||substr(h,13,4)||'-'||
         substr(h,17,4)||'-'||substr(h,21,4)||'-'||substr(h,25,4)||'-'||substr(h,29,4);
END
$$;
