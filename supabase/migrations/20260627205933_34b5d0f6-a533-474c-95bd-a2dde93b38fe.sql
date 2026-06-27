
CREATE POLICY "auth read documentos-tecnicos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos-tecnicos');
CREATE POLICY "auth upload documentos-tecnicos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos-tecnicos');
CREATE POLICY "auth update documentos-tecnicos" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'documentos-tecnicos');
CREATE POLICY "auth delete documentos-tecnicos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'documentos-tecnicos');
