
-- Storage policies for cliente-uploads bucket
-- Paths convention: {client_id}/{filename}
CREATE POLICY "cliente_uploads_internal_all"
ON storage.objects FOR ALL TO authenticated
USING (bucket_id = 'cliente-uploads' AND public.can_see_internal(auth.uid()))
WITH CHECK (bucket_id = 'cliente-uploads' AND public.can_see_internal(auth.uid()));

CREATE POLICY "cliente_uploads_client_select"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'cliente-uploads'
  AND (storage.foldername(name))[1] = public.current_client_id()::text);

CREATE POLICY "cliente_uploads_client_insert"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'cliente-uploads'
  AND (storage.foldername(name))[1] = public.current_client_id()::text);
