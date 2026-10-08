DROP POLICY IF EXISTS "pregao_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "pregao_docs_delete" ON storage.objects;
CREATE POLICY "pregao_docs_update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'pregao-documentos' AND auth.uid() IS NOT NULL) WITH CHECK (bucket_id = 'pregao-documentos' AND auth.uid() IS NOT NULL);
CREATE POLICY "pregao_docs_delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'pregao-documentos' AND auth.uid() IS NOT NULL);