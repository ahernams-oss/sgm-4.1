-- Regras de acesso (RLS) de usuarios, cargos, perfis_acesso e empresa.
--
-- Aplicada à mão no SQL Editor em 08/10/2026, antes de 20261008222403 (que reaproveita estas funções),
-- por isso a data deste arquivo. Antes dela a única regra destas 4 tabelas era "Allow all"
-- (auth.uid() IS NOT NULL): qualquer usuário logado alterava cargos, perfis, usuários e a empresa,
-- inclusive o próprio cargo para um de acesso total.
--
-- Pode rodar de novo sem efeito colateral: as regras e gatilhos são recriados iguais, e duas funções
-- só são criadas se ainda não existirem, porque migrations posteriores as redefiniram e este arquivo
-- não pode voltá-las à versão antiga: sgm_cargo_acesso_total (20261008222403, cargos "... Lasant") e
-- sgm_guarda_usuarios (sgm_rls_locais_permitidos).
--
-- Reverter em emergência: deploy/sql/rls-reverter.sql. Conferir em produção: deploy/sql/rls-verificar.sql.

do $do$
begin
  if to_regprocedure('public.sgm_cargo_acesso_total(text)') is null then
    execute $sql$
create function public.sgm_cargo_acesso_total(_nome text)
returns boolean language sql immutable set search_path = public as $f$
  select lower(btrim(coalesce(_nome, ''))) in (
    'diretor', 'gerente executivo', 'coordenador de departamento',
    'coordenador tecnico', 'coordenador técnico', 'coordenador administrativo')
$f$;
    $sql$;
  end if;
end $do$;

create or replace function public.is_acesso_total()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.usuarios u
    join public.cargos c on c.id::text = u.cargo_id
    where u.auth_user_id = auth.uid()
      and public.sgm_cargo_acesso_total(c.nome)
  )
$$;

create or replace function public.sgm_tem_permissao(_chave text)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_acesso_total() or exists (
    select 1
    from public.usuarios u
    join public.perfis_acesso p on p.id::text = u.perfil_acesso_id
    where u.auth_user_id = auth.uid()
      and coalesce(p.permissoes ->> _chave, '') = 'true'
  )
$$;

revoke all on function public.sgm_tem_permissao(text) from public, anon;
grant execute on function public.sgm_tem_permissao(text) to authenticated, service_role;
grant execute on function public.sgm_cargo_acesso_total(text) to authenticated, service_role;

drop policy if exists "Allow all usuarios" on public.usuarios;
drop policy if exists sgm_usuarios_select on public.usuarios;
drop policy if exists sgm_usuarios_insert on public.usuarios;
drop policy if exists sgm_usuarios_update on public.usuarios;
drop policy if exists sgm_usuarios_delete on public.usuarios;
create policy sgm_usuarios_select on public.usuarios for select to authenticated
  using (auth.uid() is not null);
create policy sgm_usuarios_insert on public.usuarios for insert to authenticated
  with check (public.sgm_tem_permissao('usuarios.criar'));
create policy sgm_usuarios_update on public.usuarios for update to authenticated
  using (public.sgm_tem_permissao('usuarios.editar'))
  with check (public.sgm_tem_permissao('usuarios.editar'));
create policy sgm_usuarios_delete on public.usuarios for delete to authenticated
  using (public.sgm_tem_permissao('usuarios.excluir'));

drop policy if exists "Allow all cargos" on public.cargos;
drop policy if exists sgm_cargos_select on public.cargos;
drop policy if exists sgm_cargos_insert on public.cargos;
drop policy if exists sgm_cargos_update on public.cargos;
drop policy if exists sgm_cargos_delete on public.cargos;
create policy sgm_cargos_select on public.cargos for select to authenticated
  using (auth.uid() is not null);
create policy sgm_cargos_insert on public.cargos for insert to authenticated
  with check (public.sgm_tem_permissao('cargos.criar'));
create policy sgm_cargos_update on public.cargos for update to authenticated
  using (public.sgm_tem_permissao('cargos.editar') or public.sgm_tem_permissao('cargos.gerenciar_salarios')
      or public.sgm_tem_permissao('cargos.gerenciar_anexos') or public.sgm_tem_permissao('cargos.gerenciar_nrs'))
  with check (public.sgm_tem_permissao('cargos.editar') or public.sgm_tem_permissao('cargos.gerenciar_salarios')
      or public.sgm_tem_permissao('cargos.gerenciar_anexos') or public.sgm_tem_permissao('cargos.gerenciar_nrs'));
create policy sgm_cargos_delete on public.cargos for delete to authenticated
  using (public.sgm_tem_permissao('cargos.excluir'));

drop policy if exists "Allow all perfis_acesso" on public.perfis_acesso;
drop policy if exists sgm_perfis_select on public.perfis_acesso;
drop policy if exists sgm_perfis_insert on public.perfis_acesso;
drop policy if exists sgm_perfis_update on public.perfis_acesso;
drop policy if exists sgm_perfis_delete on public.perfis_acesso;
create policy sgm_perfis_select on public.perfis_acesso for select to authenticated
  using (auth.uid() is not null);
create policy sgm_perfis_insert on public.perfis_acesso for insert to authenticated
  with check (public.sgm_tem_permissao('perfis_acesso.criar') or public.sgm_tem_permissao('perfis_acesso.duplicar'));
create policy sgm_perfis_update on public.perfis_acesso for update to authenticated
  using (public.sgm_tem_permissao('perfis_acesso.editar'))
  with check (public.sgm_tem_permissao('perfis_acesso.editar'));
create policy sgm_perfis_delete on public.perfis_acesso for delete to authenticated
  using (public.sgm_tem_permissao('perfis_acesso.excluir'));

drop policy if exists "Allow all empresa" on public.empresa;
drop policy if exists sgm_empresa_select on public.empresa;
drop policy if exists sgm_empresa_insert on public.empresa;
drop policy if exists sgm_empresa_update on public.empresa;
drop policy if exists sgm_empresa_delete on public.empresa;
create policy sgm_empresa_select on public.empresa for select to authenticated
  using (auth.uid() is not null);
create policy sgm_empresa_insert on public.empresa for insert to authenticated
  with check (public.sgm_tem_permissao('empresa.editar'));
create policy sgm_empresa_update on public.empresa for update to authenticated
  using (public.sgm_tem_permissao('empresa.editar'))
  with check (public.sgm_tem_permissao('empresa.editar'));
create policy sgm_empresa_delete on public.empresa for delete to authenticated
  using (public.is_acesso_total());

do $do$
begin
  if to_regprocedure('public.sgm_guarda_usuarios()') is null then
    execute $sql$
create function public.sgm_guarda_usuarios()
returns trigger language plpgsql security definer set search_path = public as $f$
begin
  if auth.uid() is null then
    return coalesce(new, old);
  end if;

  if tg_op = 'INSERT' then
    new.auth_user_id := null;
  end if;
  if tg_op = 'UPDATE' and (new.auth_user_id is distinct from old.auth_user_id
                           or new.senha_status is distinct from old.senha_status) then
    raise exception 'O vínculo de login e a situação da senha só podem ser alterados pelo servidor.'
      using errcode = '42501';
  end if;

  if public.is_acesso_total() then
    return coalesce(new, old);
  end if;

  if tg_op in ('UPDATE', 'DELETE') and exists (
       select 1 from public.cargos c
       where c.id::text = old.cargo_id and public.sgm_cargo_acesso_total(c.nome)) then
    raise exception 'Somente quem tem acesso total pode alterar ou excluir um usuário com acesso total.'
      using errcode = '42501';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and exists (
       select 1 from public.cargos c
       where c.id::text = new.cargo_id and public.sgm_cargo_acesso_total(c.nome)) then
    raise exception 'Somente quem tem acesso total pode atribuir um cargo com acesso total.'
      using errcode = '42501';
  end if;
  if tg_op = 'UPDATE' and old.auth_user_id = auth.uid() and (
       nullif(new.cargo_id, '') is distinct from nullif(old.cargo_id, '')
       or nullif(new.perfil_acesso_id, '') is distinct from nullif(old.perfil_acesso_id, '')
       or new.limite_aprovacao_compras is distinct from old.limite_aprovacao_compras
       or new.limite_aprovacao_os is distinct from old.limite_aprovacao_os
       or coalesce(new.clientes_permitidos::jsonb, '[]'::jsonb) is distinct from coalesce(old.clientes_permitidos::jsonb, '[]'::jsonb)
       or lower(btrim(new.email)) is distinct from lower(btrim(old.email))) then
    raise exception 'Você não pode alterar o seu próprio cargo, perfil, limites de aprovação, clientes ou e-mail.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and old.auth_user_id = auth.uid() then
    raise exception 'Você não pode excluir o seu próprio usuário.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $f$;
    $sql$;
  end if;
end $do$;

create or replace function public.sgm_guarda_cargos()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_acesso_total() then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and public.sgm_cargo_acesso_total(old.nome)
     and (tg_op = 'DELETE' or lower(btrim(new.nome)) is distinct from lower(btrim(old.nome))) then
    raise exception 'Somente quem tem acesso total pode renomear ou excluir o cargo %.', old.nome
      using errcode = '42501';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and public.sgm_cargo_acesso_total(new.nome)
     and (tg_op = 'INSERT' or not public.sgm_cargo_acesso_total(old.nome)) then
    raise exception 'Somente quem tem acesso total pode criar ou nomear um cargo como %.', new.nome
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

create or replace function public.sgm_guarda_perfis()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or public.is_acesso_total() then
    return coalesce(new, old);
  end if;
  if tg_op in ('UPDATE', 'DELETE') and exists (
       select 1 from public.usuarios u
       where u.auth_user_id = auth.uid() and u.perfil_acesso_id = old.id::text) then
    raise exception 'Você não pode alterar ou excluir o seu próprio perfil de acesso.'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;

revoke all on function public.sgm_guarda_usuarios() from public, anon, authenticated;
revoke all on function public.sgm_guarda_cargos() from public, anon, authenticated;
revoke all on function public.sgm_guarda_perfis() from public, anon, authenticated;

drop trigger if exists sgm_guarda_usuarios on public.usuarios;
create trigger sgm_guarda_usuarios before insert or update or delete on public.usuarios
  for each row execute function public.sgm_guarda_usuarios();
drop trigger if exists sgm_guarda_cargos on public.cargos;
create trigger sgm_guarda_cargos before insert or update or delete on public.cargos
  for each row execute function public.sgm_guarda_cargos();
drop trigger if exists sgm_guarda_perfis on public.perfis_acesso;
create trigger sgm_guarda_perfis before update or delete on public.perfis_acesso
  for each row execute function public.sgm_guarda_perfis();
