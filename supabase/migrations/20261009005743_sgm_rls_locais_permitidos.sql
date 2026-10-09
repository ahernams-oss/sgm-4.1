-- Inclui usuarios.locais_permitidos (coluna criada em 20261009003859, aba "Acessos locais") na trava
-- de sgm_guarda_usuarios: quem não tem acesso total não altera os próprios locais permitidos,
-- assim como já não altera cargo, perfil, limites, clientes e e-mail.

create or replace function public.sgm_guarda_usuarios()
returns trigger language plpgsql security definer set search_path = public as $$
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
       or coalesce(new.locais_permitidos::jsonb, '[]'::jsonb) is distinct from coalesce(old.locais_permitidos::jsonb, '[]'::jsonb)
       or lower(btrim(new.email)) is distinct from lower(btrim(old.email))) then
    raise exception 'Você não pode alterar o seu próprio cargo, perfil, limites de aprovação, clientes, locais ou e-mail.'
      using errcode = '42501';
  end if;
  if tg_op = 'DELETE' and old.auth_user_id = auth.uid() then
    raise exception 'Você não pode excluir o seu próprio usuário.' using errcode = '42501';
  end if;
  return coalesce(new, old);
end $$;
