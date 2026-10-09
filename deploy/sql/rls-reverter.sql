-- EMERGÊNCIA: desfaz 20261008220000_sgm_rls_acesso e 20261009005743_sgm_rls_locais_permitidos,
-- voltando as 4 tabelas para "Allow all" (qualquer usuário logado altera tudo, inclusive o próprio cargo).
-- Use só se alguma tela parar de salvar por causa das regras novas, e reaplique a correção depois.
--
-- Não mexe no que a Lovable criou por cima (20261008222403: sgm_cargo_acesso_total com os cargos
-- "... Lasant", is_diretor_geral e as travas de cargo protegido) nem em is_acesso_total/sgm_tem_permissao,
-- que outras regras usam.

drop trigger if exists sgm_guarda_usuarios on public.usuarios;
drop trigger if exists sgm_guarda_cargos on public.cargos;
drop trigger if exists sgm_guarda_perfis on public.perfis_acesso;
drop function if exists public.sgm_guarda_usuarios();
drop function if exists public.sgm_guarda_cargos();
drop function if exists public.sgm_guarda_perfis();

drop policy if exists sgm_usuarios_select on public.usuarios;
drop policy if exists sgm_usuarios_insert on public.usuarios;
drop policy if exists sgm_usuarios_update on public.usuarios;
drop policy if exists sgm_usuarios_delete on public.usuarios;
drop policy if exists sgm_cargos_select on public.cargos;
drop policy if exists sgm_cargos_insert on public.cargos;
drop policy if exists sgm_cargos_update on public.cargos;
drop policy if exists sgm_cargos_delete on public.cargos;
drop policy if exists sgm_perfis_select on public.perfis_acesso;
drop policy if exists sgm_perfis_insert on public.perfis_acesso;
drop policy if exists sgm_perfis_update on public.perfis_acesso;
drop policy if exists sgm_perfis_delete on public.perfis_acesso;
drop policy if exists sgm_empresa_select on public.empresa;
drop policy if exists sgm_empresa_insert on public.empresa;
drop policy if exists sgm_empresa_update on public.empresa;
drop policy if exists sgm_empresa_delete on public.empresa;

drop policy if exists "Allow all usuarios" on public.usuarios;
drop policy if exists "Allow all cargos" on public.cargos;
drop policy if exists "Allow all perfis_acesso" on public.perfis_acesso;
drop policy if exists "Allow all empresa" on public.empresa;
create policy "Allow all usuarios" on public.usuarios for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Allow all cargos" on public.cargos for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Allow all perfis_acesso" on public.perfis_acesso for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);
create policy "Allow all empresa" on public.empresa for all to authenticated
  using (auth.uid() is not null) with check (auth.uid() is not null);

select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('usuarios', 'cargos', 'perfis_acesso', 'empresa')
order by tablename, cmd;
