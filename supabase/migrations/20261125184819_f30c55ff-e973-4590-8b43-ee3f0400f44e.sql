create or replace function sgm_private.sgm_eh_fornecedor(_id text) returns boolean language sql stable security definer set search_path to 'public' as $$ select exists(select 1 from public.clientes c where c.id::text=_id and c.tipo='Fornecedor') $$;

drop policy if exists sgm_clientes_leitura_escopo on public.clientes;
create policy sgm_clientes_leitura_escopo on public.clientes as restrictive for select to authenticated
 using (tipo='Fornecedor' or sgm_private.sgm_cliente_cadastro_permitido(id::text));
drop policy if exists sgm_clientes_edicao_escopo on public.clientes;
create policy sgm_clientes_edicao_escopo on public.clientes as restrictive for update to authenticated
 using ((tipo='Fornecedor' and public.sgm_tem_permissao('fornecedores.editar')) or sgm_private.sgm_cliente_permitido(id::text));
drop policy if exists sgm_clientes_exclusao_escopo on public.clientes;
create policy sgm_clientes_exclusao_escopo on public.clientes as restrictive for delete to authenticated
 using ((tipo='Fornecedor' and public.sgm_tem_permissao('fornecedores.excluir')) or sgm_private.sgm_cliente_permitido(id::text));