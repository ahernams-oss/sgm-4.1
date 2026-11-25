DROP POLICY IF EXISTS pregao_habilitacao_auth ON public.pregao_habilitacao;
CREATE POLICY pregao_habilitacao_auth_select ON public.pregao_habilitacao FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY pregao_habilitacao_auth_write ON public.pregao_habilitacao FOR ALL TO authenticated USING (public.has_module_prefix('pregao')) WITH CHECK (public.has_module_prefix('pregao'));

DROP POLICY IF EXISTS processos_seletivos_auth ON public.processos_seletivos;
CREATE POLICY processos_seletivos_auth_select ON public.processos_seletivos FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY processos_seletivos_auth_write ON public.processos_seletivos FOR ALL TO authenticated
  USING (public.has_module_prefix('processos_seletivos') OR public.has_module_prefix('requisicao_colaboradores'))
  WITH CHECK (public.has_module_prefix('processos_seletivos') OR public.has_module_prefix('requisicao_colaboradores'));

DROP POLICY IF EXISTS "Authenticated manage whatsapp_campanhas" ON public.whatsapp_campanhas;
DROP POLICY IF EXISTS app_acesso_whatsapp_campanhas ON public.whatsapp_campanhas;
CREATE POLICY whatsapp_campanhas_modulo ON public.whatsapp_campanhas FOR ALL TO authenticated
  USING (public.has_module_prefix('comunicacao_whatsapp')) WITH CHECK (public.has_module_prefix('comunicacao_whatsapp'));