DROP POLICY IF EXISTS pregoes_anon_read ON public.pregoes;
DROP POLICY IF EXISTS pregao_itens_anon_read ON public.pregao_itens;
DROP POLICY IF EXISTS pregao_lances_anon_read ON public.pregao_lances;
DROP POLICY IF EXISTS pregao_mensagens_anon_read ON public.pregao_mensagens;
DROP POLICY IF EXISTS pregao_participantes_anon_read ON public.pregao_participantes;
REVOKE SELECT ON public.pregoes, public.pregao_itens, public.pregao_lances, public.pregao_mensagens, public.pregao_participantes FROM anon;

DROP POLICY IF EXISTS pregao_docs_update ON storage.objects;
DROP POLICY IF EXISTS pregao_docs_delete ON storage.objects;
CREATE POLICY pregao_docs_update ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'pregao-documentos' AND (owner_id = auth.uid()::text OR public.has_module_prefix('pregao')))
  WITH CHECK (bucket_id = 'pregao-documentos' AND (owner_id = auth.uid()::text OR public.has_module_prefix('pregao')));
CREATE POLICY pregao_docs_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'pregao-documentos' AND (owner_id = auth.uid()::text OR public.has_module_prefix('pregao')));