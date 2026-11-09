alter table public.pmoc_atividades_execucoes add column smart boolean not null default false;
create or replace function sgm_private.pmoc_smart_gravar(_acao text, _atividade uuid default null, _equipamento uuid default null, _execucao uuid default null, _observacoes text default null, _foto text default null, _proxima timestamptz default null) returns jsonb language plpgsql security invoker set search_path=public as $$
declare v public.pmoc_atividades_execucoes; a public.pmoc_atividades; e public.equipamentos; u text; begin
if auth.uid() is null or not(public.sgm_tem_permissao('pmoc.editar') or public.sgm_tem_permissao('pmoc.criar')) then raise exception 'Sem permissão para operar PMOC'; end if;
select nome into u from public.usuarios where auth_user_id=auth.uid() and ativo is distinct from false;
if u is null then raise exception 'Usuário indisponível'; end if;
if _acao='iniciar' then
perform pg_advisory_xact_lock(hashtextextended(_atividade::text||':'||_equipamento::text,0));
select * into e from public.equipamentos where id=_equipamento;
select * into a from public.pmoc_atividades where id=_atividade;
if e.id is null or a.id is null or not a.ativa or not sgm_private.sgm_cliente_permitido(e.cliente_id) or not(a.equipamento_id=e.id::text or (coalesce(a.equipamento_id,'')='' and e.plano_manutencao=a.plano_id)) then raise exception 'Atividade ou equipamento indisponível'; end if;
select * into v from public.pmoc_atividades_execucoes where atividade_id=_atividade and equipamento_id=_equipamento and status in ('Em execução','Pendente') order by created_at desc limit 1;
if v.id is not null then return to_jsonb(v); end if;
if a.proxima_execucao is not null and current_date < a.proxima_execucao::date-2 then raise exception 'Manutenção ainda fora do período de execução'; end if;
insert into public.pmoc_atividades_execucoes(atividade_id,plano_id,equipamento_id,equipamento_nome,atividade_descricao,periodicidade,status,registrado_por,smart) values(a.id,nullif(a.plano_id,'')::uuid,e.id,concat_ws(' ',e.tag,e.equipamento),a.descricao,a.periodicidade,'Em execução',u,true) returning * into v;
else
select * into v from public.pmoc_atividades_execucoes where id=_execucao for update;
if v.id is null or not v.smart or v.status<>'Em execução' then raise exception 'Manutenção indisponível para edição'; end if;
if _acao='salvar' then
if _observacoes is not null and length(_observacoes)>10000 then raise exception 'Observações muito longas'; end if;
if _foto is not null then
if _foto not like 'pmoc-smart-fotos/'||v.equipamento_id::text||'/'||v.id::text||'/%' or _foto like '%..%' then raise exception 'Foto inválida'; end if;
if not exists(select 1 from storage.objects where bucket_id='pmoc-smart-fotos' and name=substring(_foto from 18)) then raise exception 'Foto não enviada'; end if;
if not coalesce(v.fotos,'[]') ? _foto then
if jsonb_array_length(coalesce(v.fotos,'[]'))>=6 then raise exception 'Máximo de seis fotos'; end if;
v.fotos:=coalesce(v.fotos,'[]')||jsonb_build_array(_foto);
end if; end if;
update public.pmoc_atividades_execucoes set observacoes=coalesce(_observacoes,observacoes),fotos=v.fotos where id=v.id returning * into v;
elsif _acao='finalizar' then
if _proxima is null or _proxima<=now() then raise exception 'Próxima execução inválida'; end if;
update public.pmoc_atividades_execucoes set status='Pendente',data_execucao=now(),proxima_execucao=_proxima where id=v.id returning * into v;
else raise exception 'Ação inválida'; end if; end if;
return to_jsonb(v); end $$;
revoke all on function sgm_private.pmoc_smart_gravar(text,uuid,uuid,uuid,text,text,timestamptz) from public,anon;
grant execute on function sgm_private.pmoc_smart_gravar(text,uuid,uuid,uuid,text,text,timestamptz) to authenticated,service_role;
create or replace function public.pmoc_smart_gravar(_acao text, _atividade uuid default null, _equipamento uuid default null, _execucao uuid default null, _observacoes text default null, _foto text default null, _proxima timestamptz default null) returns jsonb language sql security invoker set search_path=public as $$ select sgm_private.pmoc_smart_gravar(_acao,_atividade,_equipamento,_execucao,_observacoes,_foto,_proxima) $$;
revoke all on function public.pmoc_smart_gravar(text,uuid,uuid,uuid,text,text,timestamptz) from public,anon;
grant execute on function public.pmoc_smart_gravar(text,uuid,uuid,uuid,text,text,timestamptz) to authenticated,service_role;
create or replace function public.pmoc_smart_sincronizar() returns trigger language plpgsql security invoker set search_path=public as $$ declare eq public.equipamentos; n text; begin
if not new.smart then return new; end if;
if auth.uid() is not null and new.status='Confirmada' and (tg_op='INSERT' or old.status is distinct from 'Confirmada') and not public.sgm_tem_permissao('pmoc.confirmar_execucao') then raise exception 'Sem permissão para confirmar manutenção'; end if;
select * into eq from public.equipamentos where id=new.equipamento_id;
n:=case new.status when 'Em execução' then 'Em execução' when 'Confirmada' then 'Concluída' when 'Rejeitada' then 'Cancelada' else 'Aguardando Confirmação' end;
if not exists(select 1 from public.pmoc_ordens_servico where execucao_id=new.id::text) then
insert into public.pmoc_ordens_servico(execucao_id,plano_id,atividade_id,equipamento_id,equipamento_nome,origem,unidade,local_descricao,descricao,tipo,status,data_abertura,data_inicio_execucao,tecnico_responsavel,evidencias,observacoes) values(new.id::text,coalesce(new.plano_id::text,''),new.atividade_id::text,new.equipamento_id::text,new.equipamento_nome,'PMOC',eq.cliente_nome,concat_ws(' / ',eq.local_descricao,eq.setor_descricao),new.atividade_descricao,'Preventiva',n,current_date,new.created_at,new.registrado_por,new.fotos,coalesce(new.observacoes,''));
else update public.pmoc_ordens_servico set status=n,evidencias=new.fotos,observacoes=coalesce(new.observacoes,''),data_conclusao=case when new.status='Em execução' then null else new.data_execucao end,aprovado_por=coalesce(new.confirmado_por,''),data_aprovacao=new.data_confirmacao where execucao_id=new.id::text; end if;
return new; end $$;
create trigger trg_pmoc_smart_sync after insert or update on public.pmoc_atividades_execucoes for each row execute function public.pmoc_smart_sincronizar();
drop policy sgm_equipamento_escopo on public.pmoc_atividades;
create policy sgm_equipamento_escopo on public.pmoc_atividades as restrictive for all to authenticated using(sgm_private.sgm_equipamento_permitido(equipamento_id) or (coalesce(equipamento_id,'')='' and exists(select 1 from public.pmoc_planos p where p.id::text=plano_id))) with check(sgm_private.sgm_equipamento_permitido(equipamento_id) or (coalesce(equipamento_id,'')='' and exists(select 1 from public.pmoc_planos p where p.id::text=plano_id)));
create policy pmoc_smart_fotos_read on storage.objects for select to authenticated using(bucket_id='pmoc-smart-fotos' and sgm_private.sgm_equipamento_permitido((storage.foldername(name))[1]));
create policy pmoc_smart_fotos_insert on storage.objects for insert to authenticated with check(bucket_id='pmoc-smart-fotos' and sgm_private.sgm_equipamento_permitido((storage.foldername(name))[1]) and (public.sgm_tem_permissao('pmoc.editar') or public.sgm_tem_permissao('pmoc.criar')) and exists(select 1 from public.pmoc_atividades_execucoes x where x.id::text=(storage.foldername(name))[2] and x.equipamento_id::text=(storage.foldername(name))[1] and x.smart and x.status='Em execução'));