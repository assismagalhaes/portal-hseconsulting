-- Libera ao perfil tecnico o mesmo ciclo da logomarca ja disponivel ao admin.
DROP POLICY IF EXISTS "client branding internal select" ON storage.objects;
CREATE POLICY "client branding internal select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'client-branding' AND (SELECT public.can_see_psico(auth.uid())) AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$');

DROP POLICY IF EXISTS "client branding internal insert" ON storage.objects;
CREATE POLICY "client branding internal insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'client-branding' AND (SELECT public.can_see_psico(auth.uid())) AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$');

DROP POLICY IF EXISTS "client branding internal update" ON storage.objects;
CREATE POLICY "client branding internal update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'client-branding' AND (SELECT public.can_see_psico(auth.uid())) AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$')
WITH CHECK (bucket_id = 'client-branding' AND (SELECT public.can_see_psico(auth.uid())) AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$');

DROP POLICY IF EXISTS "client branding internal delete" ON storage.objects;
CREATE POLICY "client branding internal delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'client-branding' AND (SELECT public.can_see_psico(auth.uid())) AND name ~ '^[0-9a-f-]{36}/logo\.(png|jpg)$');
