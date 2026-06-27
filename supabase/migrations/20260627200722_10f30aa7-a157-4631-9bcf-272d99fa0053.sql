
CREATE POLICY "auth read execucao anexos"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'execucao-anexos');

CREATE POLICY "auth upload execucao anexos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'execucao-anexos');

CREATE POLICY "auth update execucao anexos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'execucao-anexos');

CREATE POLICY "auth delete execucao anexos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'execucao-anexos');
