-- Páginas públicas agora passam pelo servidor: remover leitura sem login
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipamentos','ordens_servico','os_assinaturas','rdos','rdo_assinaturas','boletins_medicao','boletim_assinaturas','pedidos_compra','pc_assinaturas','equipamentos_laudos_assinaturas','equipamentos_laudos_condenacao','pmoc_atividades','pmoc_atividades_execucoes','solicitacoes_servicos','processos_seletivos']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t||'_anon_read', t);
  END LOOP;
END $$;
DROP POLICY IF EXISTS "processos_seletivos_anon_update" ON public.processos_seletivos;

-- O portal do fornecedor lê pedidos de compra do próprio fornecedor
CREATE POLICY "pedidos_compra_anon_fornecedor" ON public.pedidos_compra FOR SELECT TO anon
  USING (fornecedor_id IS NOT NULL AND fornecedor_id::text = public.req_header('x-fornecedor-id'));

-- Habilitação do pregão: fornecedor só mexe na própria participação
CREATE POLICY "pregao_habilitacao_anon_select" ON public.pregao_habilitacao FOR SELECT TO anon
  USING (participante_id IN (SELECT id FROM public.pregao_participantes));
CREATE POLICY "pregao_habilitacao_anon_insert" ON public.pregao_habilitacao FOR INSERT TO anon
  WITH CHECK (participante_id IN (SELECT id FROM public.pregao_participantes WHERE pregao_id = pregao_habilitacao.pregao_id));
CREATE POLICY "pregao_habilitacao_anon_update" ON public.pregao_habilitacao FOR UPDATE TO anon
  USING (participante_id IN (SELECT id FROM public.pregao_participantes))
  WITH CHECK (participante_id IN (SELECT id FROM public.pregao_participantes WHERE pregao_id = pregao_habilitacao.pregao_id));
CREATE POLICY "pregao_habilitacao_anon_delete" ON public.pregao_habilitacao FOR DELETE TO anon
  USING (participante_id IN (SELECT id FROM public.pregao_participantes));

-- Arquivos: limitar ao módulo de quem acessa
DROP POLICY IF EXISTS "relatorios_ferias_read" ON storage.objects;
CREATE POLICY "relatorios_ferias_read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'relatorios-ferias' AND public.has_module('mapa_funcionarios'));
DROP POLICY IF EXISTS "contratos_anexos_acesso" ON storage.objects;
CREATE POLICY "contratos_anexos_acesso" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'contratos-anexos' AND (public.has_module('contratos_terceiros') OR public.has_module('clientes')))
  WITH CHECK (bucket_id = 'contratos-anexos' AND (public.has_module('contratos_terceiros') OR public.has_module('clientes')));
DROP POLICY IF EXISTS "Allow public access to licitacoes docs" ON storage.objects;
CREATE POLICY "Allow public access to licitacoes docs" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'licitacoes-documentos' AND public.has_module('licitacoes'))
  WITH CHECK (bucket_id = 'licitacoes-documentos' AND public.has_module('licitacoes'));