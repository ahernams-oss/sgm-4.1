DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'avaliacoes_desempenho','contrato_transferencias_saldo','contratos_terceiros',
    'epis_recebimentos','exames_periodicos','funcionario_cliente_historico',
    'funcionario_transferencia_solicitacoes','juridico_decisoes_pagamentos','juridico_parcelas',
    'nrs_catalogo','portal_holerites','portal_holerites_import_item','portal_holerites_import_lote',
    'portal_treinamentos','pregao_lances','pregao_propostas_iniciais','pregao_propostas_fechadas',
    'responsaveis_tecnicos','user_grid_column_prefs','whatsapp_campanhas','whatsapp_envios',
    'cotacao_convites','cotacao_propostas_externas','ferias_relatorio_envios'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "app_acesso_%1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "app_acesso_%1$s" ON public.%1$I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%1$I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%1$I TO service_role', t);
  END LOOP;
END $$;