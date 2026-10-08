-- Cotações: anon já tem políticas por token; remover regras abertas
DROP POLICY IF EXISTS "app_acesso_cotacao_convites" ON public.cotacao_convites;
DROP POLICY IF EXISTS "Leitura por autenticados" ON public.cotacao_convites;
DROP POLICY IF EXISTS "Update por autenticados" ON public.cotacao_convites;
DROP POLICY IF EXISTS "Inserção por autenticados" ON public.cotacao_convites;
CREATE POLICY "cotacao_convites_auth" ON public.cotacao_convites FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "app_acesso_cotacao_propostas_externas" ON public.cotacao_propostas_externas;
DROP POLICY IF EXISTS "Leitura por autenticados" ON public.cotacao_propostas_externas;
DROP POLICY IF EXISTS "proposta_auth_all" ON public.cotacao_propostas_externas;
CREATE POLICY "cotacao_propostas_auth" ON public.cotacao_propostas_externas FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Tabelas internas com leitura pública (QR do equipamento / verificação de assinatura)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipamentos','ordens_servico','os_assinaturas','rdos','rdo_assinaturas','boletins_medicao','boletim_assinaturas','pedidos_compra','pc_assinaturas','equipamentos_laudos_assinaturas','equipamentos_laudos_condenacao','pmoc_atividades','solicitacoes_servicos','processos_seletivos','pregoes','pregao_itens','pregao_lances','pregao_mensagens','pregao_participantes','pregao_habilitacao']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL)', t||'_auth', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Allow all equipamentos" ON public.equipamentos;
DROP POLICY IF EXISTS "Allow all ordens_servico" ON public.ordens_servico;
DROP POLICY IF EXISTS "Allow all os_assinaturas" ON public.os_assinaturas;
DROP POLICY IF EXISTS "Allow all rdos" ON public.rdos;
DROP POLICY IF EXISTS "Allow all rdo_assinaturas" ON public.rdo_assinaturas;
DROP POLICY IF EXISTS "Public delete boletins_medicao" ON public.boletins_medicao;
DROP POLICY IF EXISTS "Public insert boletins_medicao" ON public.boletins_medicao;
DROP POLICY IF EXISTS "Public read boletins_medicao" ON public.boletins_medicao;
DROP POLICY IF EXISTS "Public update boletins_medicao" ON public.boletins_medicao;
DROP POLICY IF EXISTS "Allow all boletim_assinaturas" ON public.boletim_assinaturas;
DROP POLICY IF EXISTS "Allow all ped_compra" ON public.pedidos_compra;
DROP POLICY IF EXISTS "pc_assinaturas_delete" ON public.pc_assinaturas;
DROP POLICY IF EXISTS "pc_assinaturas_insert" ON public.pc_assinaturas;
DROP POLICY IF EXISTS "pc_assinaturas_select" ON public.pc_assinaturas;
DROP POLICY IF EXISTS "pc_assinaturas_update" ON public.pc_assinaturas;
DROP POLICY IF EXISTS "Allow all on laudos assinaturas" ON public.equipamentos_laudos_assinaturas;
DROP POLICY IF EXISTS "Allow all on laudos condenacao" ON public.equipamentos_laudos_condenacao;
DROP POLICY IF EXISTS "Allow all pmoc_atividades" ON public.pmoc_atividades;
DROP POLICY IF EXISTS "Allow all for anon" ON public.solicitacoes_servicos;
DROP POLICY IF EXISTS "Allow all for authenticated" ON public.solicitacoes_servicos;
DROP POLICY IF EXISTS "Allow all proc_seletivos" ON public.processos_seletivos;
DROP POLICY IF EXISTS "pregoes_all" ON public.pregoes;
DROP POLICY IF EXISTS "pregao_itens_all" ON public.pregao_itens;
DROP POLICY IF EXISTS "app_acesso_pregao_lances" ON public.pregao_lances;
DROP POLICY IF EXISTS "pregao_lances_delete_auth" ON public.pregao_lances;
DROP POLICY IF EXISTS "pregao_lances_insert" ON public.pregao_lances;
DROP POLICY IF EXISTS "pregao_lances_select" ON public.pregao_lances;
DROP POLICY IF EXISTS "pregao_lances_update_auth" ON public.pregao_lances;
DROP POLICY IF EXISTS "pregao_msg_all" ON public.pregao_mensagens;
DROP POLICY IF EXISTS "pregao_part_all" ON public.pregao_participantes;
DROP POLICY IF EXISTS "pregao_hab_all" ON public.pregao_habilitacao;

-- Acesso sem login apenas onde as páginas públicas precisam (somente leitura, salvo exceções)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipamentos','ordens_servico','os_assinaturas','rdos','rdo_assinaturas','boletins_medicao','boletim_assinaturas','pedidos_compra','pc_assinaturas','equipamentos_laudos_assinaturas','equipamentos_laudos_condenacao','pmoc_atividades','solicitacoes_servicos','processos_seletivos','pregoes','pregao_itens','pregao_lances','pregao_mensagens','pregao_participantes']
  LOOP
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO anon USING (true)', t||'_anon_read', t);
  END LOOP;
END $$;

CREATE POLICY "processos_seletivos_anon_update" ON public.processos_seletivos FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "pregao_lances_anon_insert" ON public.pregao_lances FOR INSERT TO anon WITH CHECK (pregao_id IS NOT NULL);
CREATE POLICY "pregao_mensagens_anon_insert" ON public.pregao_mensagens FOR INSERT TO anon WITH CHECK (pregao_id IS NOT NULL);
CREATE POLICY "pregao_participantes_anon_insert" ON public.pregao_participantes FOR INSERT TO anon WITH CHECK (pregao_id IS NOT NULL AND fornecedor_id IS NOT NULL);