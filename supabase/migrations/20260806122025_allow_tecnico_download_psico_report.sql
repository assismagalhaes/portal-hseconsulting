-- A RPC de download ja autoriza o profissional tecnico por can_see_psico(),
-- mas a policy SELECT do bucket privado ainda usava can_see_internal(). O
-- Storage oculta objetos sem permissao como "Object not found". Alinha apenas
-- a leitura do bucket com a autorizacao vigente do modulo psicossocial.

DO $migration$
BEGIN
  IF to_regprocedure('public.can_see_psico(uuid)') IS NULL THEN
    RAISE EXCEPTION 'Funcao de autorizacao public.can_see_psico(uuid) nao encontrada';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'psico-relatorios'
  ) THEN
    RAISE EXCEPTION 'Bucket privado psico-relatorios nao encontrado';
  END IF;
END;
$migration$;

DROP POLICY IF EXISTS "psico_rel_bucket_select_interno" ON storage.objects;

CREATE POLICY "psico_rel_bucket_select_interno"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'psico-relatorios'
  AND (SELECT public.can_see_psico(auth.uid()))
);

DO $audit$
DECLARE
  v_policy text;
BEGIN
  SELECT qual
    INTO v_policy
  FROM pg_policies
  WHERE schemaname = 'storage'
    AND tablename = 'objects'
    AND policyname = 'psico_rel_bucket_select_interno';

  IF v_policy IS NULL
     OR v_policy NOT LIKE '%can_see_psico%'
     OR v_policy LIKE '%can_see_internal%' THEN
    RAISE EXCEPTION 'Policy de leitura do bucket psico-relatorios nao foi atualizada com seguranca';
  END IF;
END;
$audit$;

REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;
