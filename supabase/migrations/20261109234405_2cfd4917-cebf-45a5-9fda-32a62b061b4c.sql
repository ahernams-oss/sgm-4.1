create or replace function public.pmoc_smart_validar() returns trigger language plpgsql security invoker set search_path=public as $$ begin
if tg_op='UPDATE' and old.smart and (not new.smart or new.equipamento_id is distinct from old.equipamento_id or new.atividade_id is distinct from old.atividade_id or new.plano_id is distinct from old.plano_id) then raise exception 'Vínculo da manutenção não pode ser alterado'; end if;
if not new.smart then return new; end if;
if auth.uid() is not null and not(public.sgm_tem_permissao('pmoc.editar') or public.sgm_tem_permissao('pmoc.criar') or public.sgm_tem_permissao('pmoc.confirmar_execucao')) then raise exception 'Sem permissão para operar PMOC'; end if;
if jsonb_typeof(coalesce(new.fotos,'[]'))<>'array' or jsonb_array_length(coalesce(new.fotos,'[]'))>6 then raise exception 'Máximo de seis fotos'; end if;
if length(coalesce(new.observacoes,''))>10000 then raise exception 'Observações muito longas'; end if;
if tg_op='INSERT' and new.status<>'Em execução' then raise exception 'Inicie a manutenção antes de finalizar'; end if;
if tg_op='UPDATE' then
if new.status is distinct from old.status and not((old.status='Em execução' and new.status='Pendente') or (old.status='Pendente' and new.status in ('Confirmada','Rejeitada'))) then raise exception 'Mudança de etapa inválida'; end if;
if new.status in ('Confirmada','Rejeitada') and new.status is distinct from old.status and auth.uid() is not null and not public.sgm_tem_permissao('pmoc.confirmar_execucao') then raise exception 'Sem permissão para confirmar manutenção'; end if;
if old.status<>'Em execução' and (new.fotos is distinct from old.fotos or new.observacoes is distinct from old.observacoes) then raise exception 'Manutenção encerrada para edição'; end if;
end if;
return new; end $$;
create trigger trg_pmoc_smart_validar before insert or update on public.pmoc_atividades_execucoes for each row execute function public.pmoc_smart_validar();