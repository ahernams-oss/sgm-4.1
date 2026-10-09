-- Confere em produção as regras de 20261008220000_sgm_rls_acesso: escolhe um usuário comum (com login,
-- sem acesso total, sem usuarios.editar nem empresa.editar), tenta como se fosse ele 7 alterações que
-- só um administrador poderia fazer e DESFAZ todas no final, mesmo as que passarem.
-- Esperado: linhas 1 a 7 "bloqueado"; linha 8 "OK: leu N usuários". Rodar no SQL Editor.

drop table if exists pg_temp.sgm_teste_rls;
create temp table sgm_teste_rls (ordem int, teste text, resultado text);

do $$
declare
  alvo record;
  cargo_diretor text;
  nome_diretor text;
  res text[] := '{}';
  n int;
  nomes text[] := array[
    'mudar o PRÓPRIO cargo para um de acesso total',
    'trocar o PRÓPRIO perfil de acesso',
    'renomear o PRÓPRIO cargo como um de acesso total',
    'dar permissão ao PRÓPRIO perfil',
    'criar um usuário',
    'trocar o WhatsApp do RH da empresa',
    'excluir outro usuário',
    'listar usuários (uso normal das telas)'];
  i int;
begin
  select u.id, u.nome, u.auth_user_id, u.cargo_id, u.perfil_acesso_id into alvo
  from public.usuarios u
  left join public.cargos c on c.id::text = u.cargo_id
  left join public.perfis_acesso p on p.id::text = u.perfil_acesso_id
  where u.auth_user_id is not null
    and not public.sgm_cargo_acesso_total(c.nome)
    and coalesce(p.permissoes ->> 'usuarios.editar', '') <> 'true'
    and coalesce(p.permissoes ->> 'empresa.editar', '') <> 'true'
  order by u.nome
  limit 1;

  if alvo.id is null then
    raise exception 'Nenhum usuário comum com login encontrado para o teste.';
  end if;
  select id::text, nome into cargo_diretor, nome_diretor from public.cargos where public.sgm_cargo_acesso_total(nome) order by nome limit 1;

  perform set_config('request.jwt.claim.sub', alvo.auth_user_id::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', alvo.auth_user_id, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';

  for i in 1..8 loop
    begin
      if i = 1 then update public.usuarios set cargo_id = cargo_diretor where id = alvo.id;
      elsif i = 2 then update public.usuarios set perfil_acesso_id = (select id::text from public.perfis_acesso where id::text is distinct from alvo.perfil_acesso_id limit 1) where id = alvo.id;
      elsif i = 3 then update public.cargos set nome = coalesce(nome_diretor, 'Diretor Geral Lasant') where id::text = alvo.cargo_id;
      elsif i = 4 then update public.perfis_acesso set permissoes = coalesce(permissoes, '{}'::jsonb) || '{"usuarios.editar": true}'::jsonb where id::text = alvo.perfil_acesso_id;
      elsif i = 5 then insert into public.usuarios (nome, email) values ('teste rls', 'teste-rls@invalido.local');
      elsif i = 6 then update public.empresa set whatsapp_rh = '5500000000000';
      elsif i = 7 then delete from public.usuarios where id <> alvo.id;
      else perform 1;
      end if;
      get diagnostics n = row_count;
      if i = 8 then
        select count(*) into n from public.usuarios;
        raise exception 'desfazer:%', case when n > 0 then 'OK: leu ' || n || ' usuários' else 'PROBLEMA: não leu nenhum usuário' end;
      end if;
      raise exception 'desfazer:%', case when n > 0 then 'ABERTO: alterou ' || n || ' linha(s)' else 'bloqueado (0 linhas)' end;
    exception when others then
      if sqlerrm like 'desfazer:%' then
        res := res || substr(sqlerrm, 10);
      else
        res := res || ('bloqueado: ' || left(sqlerrm, 90));
      end if;
    end;
  end loop;

  execute 'reset role';
  perform set_config('request.jwt.claim.sub', '', true);
  perform set_config('request.jwt.claims', '', true);
  insert into sgm_teste_rls values (0, 'usuário usado no teste', alvo.nome);
  for i in 1..8 loop
    insert into sgm_teste_rls values (i, nomes[i], res[i]);
  end loop;
end $$;

select * from sgm_teste_rls order by ordem;
