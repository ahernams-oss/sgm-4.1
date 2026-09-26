DO $$
DECLARE r record; pub text[] := ARRAY['boletim_assinaturas','boletins_medicao','cotacao_convites','cotacao_propostas_externas','equipamentos','equipamentos_laudos_assinaturas','equipamentos_laudos_condenacao','ordens_servico','os_assinaturas','pc_assinaturas','pedidos_compra','pmoc_atividades','pmoc_atividades_execucoes','pregao_itens','pregao_lances','pregao_mensagens','pregao_participantes','pregoes','pregao_habilitacao','processos_seletivos','rdo_assinaturas','rdos','solicitacoes_servicos'];
BEGIN
  -- Tabelas: regras "libera tudo" passam a exigir usuário autenticado
  FOR r IN SELECT policyname, tablename, cmd, qual, with_check FROM pg_policies
           WHERE schemaname='public' AND (qual='true' OR with_check='true')
             AND NOT (tablename = ANY(pub)) AND roles <> '{service_role}'
  LOOP
    IF r.cmd IN ('SELECT','DELETE') THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (auth.uid() IS NOT NULL)', r.policyname, r.tablename);
    ELSIF r.cmd = 'INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated WITH CHECK (auth.uid() IS NOT NULL)', r.policyname, r.tablename);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I TO authenticated USING (%s) WITH CHECK (%s)', r.policyname, r.tablename,
        CASE WHEN r.qual IS NULL OR r.qual='true' THEN 'auth.uid() IS NOT NULL' ELSE '('||r.qual||') AND auth.uid() IS NOT NULL' END,
        CASE WHEN r.with_check IS NULL OR r.with_check='true' THEN 'auth.uid() IS NOT NULL' ELSE '('||r.with_check||') AND auth.uid() IS NOT NULL' END);
    END IF;
  END LOOP;

  -- Arquivos: exigem usuário autenticado (exceto documentos do pregão usados pelo fornecedor e regras só do servidor)
  FOR r IN SELECT policyname, cmd, qual, with_check FROM pg_policies
           WHERE schemaname='storage' AND tablename='objects'
             AND coalesce(qual,'')||coalesce(with_check,'') NOT LIKE '%auth.uid()%'
             AND coalesce(qual,'')||coalesce(with_check,'') NOT LIKE '%service_role%'
             AND coalesce(qual,'')||coalesce(with_check,'') NOT LIKE '%pregao-documentos%'
             AND roles <> '{service_role}'
  LOOP
    IF r.cmd IN ('SELECT','DELETE') THEN
      EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated USING ((%s) AND auth.uid() IS NOT NULL)', r.policyname, coalesce(r.qual,'true'));
    ELSIF r.cmd = 'INSERT' THEN
      EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated WITH CHECK ((%s) AND auth.uid() IS NOT NULL)', r.policyname, coalesce(r.with_check,'true'));
    ELSE
      EXECUTE format('ALTER POLICY %I ON storage.objects TO authenticated USING ((%s) AND auth.uid() IS NOT NULL) WITH CHECK ((%s) AND auth.uid() IS NOT NULL)', r.policyname, coalesce(r.qual,'true'), coalesce(r.with_check, r.qual, 'true'));
    END IF;
  END LOOP;
END $$;