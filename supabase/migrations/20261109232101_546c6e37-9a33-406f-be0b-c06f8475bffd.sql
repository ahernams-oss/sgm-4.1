create or replace function public.sgm_cliente_permitido(_cliente_id text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.usuarios u where u.auth_user_id=auth.uid() and u.ativo is distinct from false and coalesce(u.clientes_permitidos,'[]'::jsonb) ? _cliente_id) $$;
revoke all on function public.sgm_cliente_permitido(text) from public,anon;
grant execute on function public.sgm_cliente_permitido(text) to authenticated,service_role;
create or replace function public.sgm_cliente_cadastro_permitido(_cliente_id text) returns boolean language sql stable security definer set search_path=public as $$ select public.sgm_cliente_permitido(_cliente_id) or public.sgm_tem_permissao('usuarios.criar') or public.sgm_tem_permissao('usuarios.editar') $$;
revoke all on function public.sgm_cliente_cadastro_permitido(text) from public,anon;
grant execute on function public.sgm_cliente_cadastro_permitido(text) to authenticated,service_role;
create policy sgm_clientes_leitura_escopo on public.clientes as restrictive for select to authenticated using (public.sgm_cliente_cadastro_permitido(id::text));
create policy sgm_clientes_edicao_escopo on public.clientes as restrictive for update to authenticated using(public.sgm_cliente_permitido(id::text)) with check(public.sgm_cliente_permitido(id::text));
create policy sgm_clientes_exclusao_escopo on public.clientes as restrictive for delete to authenticated using(public.sgm_cliente_permitido(id::text));
create policy sgm_clientes_cadastro_modulo on public.clientes as restrictive for insert to authenticated with check(public.sgm_tem_permissao('clientes.criar'));
do $$ declare r record; begin
for r in select table_name from information_schema.columns where table_schema='public' and column_name='cliente_id' and table_name <> 'clientes_credenciais' loop
execute format('create policy sgm_cliente_escopo on public.%I as restrictive for all to authenticated using (public.sgm_cliente_permitido(cliente_id::text)) with check (public.sgm_cliente_permitido(cliente_id::text))',r.table_name);
end loop;
end $$;
create policy sgm_cliente_escopo on public.requisicoes_compras as restrictive for all to authenticated using(public.sgm_cliente_permitido(centro_custo)) with check(public.sgm_cliente_permitido(centro_custo));
create or replace function public.sgm_requisicao_compra_permitida(_id text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.requisicoes_compras r where r.id::text=_id and public.sgm_cliente_permitido(r.centro_custo)) $$;
revoke all on function public.sgm_requisicao_compra_permitida(text) from public,anon;
grant execute on function public.sgm_requisicao_compra_permitida(text) to authenticated,service_role;
do $$ declare t text; begin foreach t in array array['cotacoes_compras','pedidos_compra','recebimentos','estoque_transferencias','compras_confirmacoes_valores'] loop execute format('create policy sgm_cliente_escopo on public.%I as restrictive for all to authenticated using (public.sgm_requisicao_compra_permitida(requisicao_id)) with check (public.sgm_requisicao_compra_permitida(requisicao_id))',t); end loop; end $$;
create or replace function public.sgm_funcionario_permitido(_id text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.funcionarios f where f.id::text=_id and public.sgm_cliente_permitido(f.cliente_id)) $$;
revoke all on function public.sgm_funcionario_permitido(text) from public,anon;
grant execute on function public.sgm_funcionario_permitido(text) to authenticated,service_role;
do $$ declare r record; begin for r in select table_name from information_schema.columns where table_schema='public' and column_name='funcionario_id' loop execute format('create policy sgm_funcionario_escopo on public.%I as restrictive for all to authenticated using (public.sgm_funcionario_permitido(funcionario_id::text)) with check (public.sgm_funcionario_permitido(funcionario_id::text))',r.table_name); end loop; end $$;
create or replace function public.sgm_equipamento_permitido(_id text) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from public.equipamentos e where e.id::text=_id and public.sgm_cliente_permitido(e.cliente_id)) $$;
revoke all on function public.sgm_equipamento_permitido(text) from public,anon;
grant execute on function public.sgm_equipamento_permitido(text) to authenticated,service_role;
do $$ declare r record; begin for r in select table_name from information_schema.columns where table_schema='public' and column_name='equipamento_id' and table_name not in ('ordens_servico','solicitacoes_servicos') loop execute format('create policy sgm_equipamento_escopo on public.%I as restrictive for all to authenticated using (public.sgm_equipamento_permitido(equipamento_id::text)) with check (public.sgm_equipamento_permitido(equipamento_id::text))',r.table_name); end loop; end $$;