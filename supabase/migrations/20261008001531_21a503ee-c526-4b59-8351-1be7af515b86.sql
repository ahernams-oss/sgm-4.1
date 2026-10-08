DROP POLICY IF EXISTS "Acesso público pmoc_atividades_execucoes" ON public.pmoc_atividades_execucoes;
CREATE POLICY "pmoc_atividades_execucoes_auth" ON public.pmoc_atividades_execucoes FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "pmoc_atividades_execucoes_anon_read" ON public.pmoc_atividades_execucoes FOR SELECT TO anon USING (true);