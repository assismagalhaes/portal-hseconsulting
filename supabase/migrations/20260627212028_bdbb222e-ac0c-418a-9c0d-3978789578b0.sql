
CREATE POLICY "fin compr select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'financeiro-comprovantes');
CREATE POLICY "fin compr insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'financeiro-comprovantes');
CREATE POLICY "fin compr update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'financeiro-comprovantes');
CREATE POLICY "fin compr delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'financeiro-comprovantes');
