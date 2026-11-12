REVOKE EXECUTE ON FUNCTION public.arquivar_auditoria(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arquivar_auditoria(integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.arquivar_auditoria_ciclo(integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.refresh_usuario_senha_status(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.arquivar_auditoria(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.arquivar_auditoria(integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.arquivar_auditoria_ciclo(integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.refresh_usuario_senha_status(uuid) TO service_role;

DROP POLICY IF EXISTS "Logados gerenciam transferencias" ON public.estoque_transferencias;
CREATE POLICY "Estoque/cotacoes gerenciam transferencias" ON public.estoque_transferencias FOR ALL TO authenticated
  USING (public.has_module_prefix('estoque') OR public.has_module_prefix('cotacoes'))
  WITH CHECK (public.has_module_prefix('estoque') OR public.has_module_prefix('cotacoes'));

DROP POLICY IF EXISTS "Usuarios autenticados gerenciam rateio" ON public.fin_contas_pagar_rateio;
CREATE POLICY "Contas a pagar gerencia rateio" ON public.fin_contas_pagar_rateio FOR ALL TO authenticated
  USING (public.has_module_prefix('financeiro.contas_pagar'))
  WITH CHECK (public.has_module_prefix('financeiro.contas_pagar'));

DROP POLICY IF EXISTS "Usuarios logados gerenciam capacidades" ON public.equipamentos_capacidades;
CREATE POLICY "Usuarios SGM leem capacidades" ON public.equipamentos_capacidades FOR SELECT TO authenticated
  USING (public.current_usuario_id() IS NOT NULL);
CREATE POLICY "Equipamentos gerenciam capacidades" ON public.equipamentos_capacidades FOR ALL TO authenticated
  USING (public.has_module_prefix('equipamentos') OR public.has_module_prefix('pmoc'))
  WITH CHECK (public.has_module_prefix('equipamentos') OR public.has_module_prefix('pmoc'));

DROP POLICY IF EXISTS "Usuarios logados gerenciam vinculos fabricantes" ON public.categorias_compras_fabricantes;
CREATE POLICY "Usuarios SGM leem vinculos fabricantes" ON public.categorias_compras_fabricantes FOR SELECT TO authenticated
  USING (public.current_usuario_id() IS NOT NULL);
CREATE POLICY "Categorias de compras gerenciam vinculos" ON public.categorias_compras_fabricantes FOR ALL TO authenticated
  USING (public.has_module_prefix('categorias_compras'))
  WITH CHECK (public.has_module_prefix('categorias_compras'));