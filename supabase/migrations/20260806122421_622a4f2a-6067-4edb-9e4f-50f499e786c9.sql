-- Aplicar a migração
DROP POLICY IF EXISTS "psico_rel_bucket_select_interno" ON storage.objects;

CREATE POLICY "psico_rel_bucket_select_interno"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'psico-relatorios'
  AND (SELECT public.can_see_psico(auth.uid()))
);

REVOKE ALL ON FUNCTION public.can_see_psico(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_see_psico(uuid) TO authenticated, service_role;

-- Verificar a policy recém criada sem usar bucket_id no WHERE do pg_policies (que falhou antes)
SELECT 
    policyname, 
    cmd, 
    qual 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND policyname = 'psico_rel_bucket_select_interno';

-- Verificar outras policies no mesmo bucket para garantir que não foram ampliadas
SELECT 
    policyname, 
    cmd, 
    qual 
FROM pg_policies 
WHERE schemaname = 'storage' 
  AND tablename = 'objects' 
  AND qual LIKE '%psico-relatorios%';
