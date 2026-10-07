-- Rotinas agendadas do SGM: pg_cron (no Supabase) chamando as funções na VPS.
--
-- Onde rodar: SQL Editor do projeto Supabase ATUAL (mbasypzxvvufavraofif), só DEPOIS que:
--   1. o deploy com a ponte que confere o x-cron-secret estiver no ar, e
--   2. o CRON_SECRET estiver em /opt/sgm/.env na VPS (DEPLOY.md, seção "Rotinas agendadas").
--
-- Antes de rodar, troque um único valor: COLE_AQUI_O_CRON_SECRET, no bloco 2, pelo mesmo valor
-- de CRON_SECRET do /opt/sgm/.env. Ele fica guardado criptografado no Vault do Supabase e os
-- jobs leem de lá a cada disparo, então o segredo não aparece no texto dos jobs (cron.job).
--
-- A ponte só aceita estas 9 rotinas com o cabeçalho x-cron-secret (conjunto CRON em
-- src/lib/edge/auth.ts). Para agendar outra rotina, inclua o nome aqui E lá.
--
-- Horários em UTC (padrão do pg_cron no Supabase). Brasília = UTC-3: 12:00 UTC = 09:00 BRT.
--
-- Se os 3 jobs antigos (check-parcelas-vencimento-daily, notificar-vencimento-ferias-daily,
-- cotacao-epis-vencendo-daily) estiverem no projeto ANTIGO (vdjezhhrnksluzealfcl), rode o bloco 1
-- também lá, ou pause aquele projeto: eles continuam disparando as funções antigas com dados antigos.

-- 0) Extensões (se der erro de permissão, ative em Database > Extensions no painel)
create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

-- 1) Remover os jobs antigos, que apontavam para o projeto vdjezhhrnksluzealfcl
select cron.unschedule(jobname)
from cron.job
where jobname in (
  'check-parcelas-vencimento-daily',
  'notificar-vencimento-ferias-daily',
  'cotacao-epis-vencendo-daily'
);

-- 2) Guardar o CRON_SECRET no Vault (cria na primeira vez; nas próximas, atualiza)
do $$
declare
  segredo   text := 'COLE_AQUI_O_CRON_SECRET';  -- <-- o mesmo valor de CRON_SECRET em /opt/sgm/.env
  existente uuid;
begin
  if segredo = 'COLE_AQUI_O_CRON_SECRET' or length(segredo) < 32 then
    raise exception 'Troque COLE_AQUI_O_CRON_SECRET pelo valor de CRON_SECRET do /opt/sgm/.env (64 caracteres)';
  end if;
  select id into existente from vault.secrets where name = 'sgm_cron_secret';
  if existente is null then
    perform vault.create_secret(segredo, 'sgm_cron_secret', 'x-cron-secret das rotinas do SGM na VPS');
  else
    perform vault.update_secret(existente, segredo);
  end if;
end $$;

-- 3) Criar (ou recriar) os jobs apontando para a VPS
do $$
declare
  base_url text := 'https://136-0-53-217.sslip.io';  -- troque quando houver domínio próprio (sem barra no fim)
  j record;
begin
  for j in
    select * from (values
      -- nome do job,                        agenda (UTC),   função na VPS
      ('sgm-check-parcelas-vencimento',    '30 13 * * *',  'check-parcelas-vencimento'),    -- 10:30 BRT (como era)
      ('sgm-notificar-vencimento-ferias',  '0 12 * * *',   'notificar-vencimento-ferias'),  -- 09:00 BRT (como era)
      ('sgm-cotacao-epis-vencendo',        '5 12 * * *',   'cotacao-epis-vencendo'),        -- 09:05 BRT (como era, +5 min)
      ('sgm-notificar-vencimento-epi',     '10 12 * * *',  'notificar-vencimento-epi'),     -- novos: nunca tiveram agenda
      ('sgm-notificar-vencimento-nr',      '15 12 * * *',  'notificar-vencimento-nr'),
      ('sgm-check-exames-vencimento',      '20 12 * * *',  'check-exames-vencimento'),
      ('sgm-check-experiencia-vencimento', '25 12 * * *',  'check-experiencia-vencimento'),
      ('sgm-check-calibracao-vencimento',  '30 12 * * *',  'check-calibracao-vencimento'),
      ('sgm-check-oc-entrega-atrasada',    '0 */6 * * *',  'check-oc-entrega-atrasada')     -- a cada 6 h (regra das 48 h)
    ) as t(jobname, schedule, fn)
  loop
    perform cron.unschedule(jobname) from cron.job where jobname = j.jobname;
    perform cron.schedule(
      j.jobname,
      j.schedule,
      format($cmd$
        select net.http_post(
          url := %L,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'sgm_cron_secret')
          ),
          body := jsonb_build_object('source', 'cron'),
          timeout_milliseconds := 60000
        ) as request_id;
      $cmd$, base_url || '/api/public/edge/' || j.fn)
    );
  end loop;
end $$;

-- 4) Conferir: 9 jobs sgm-* ativos e o segredo guardado
select jobname, schedule, active from cron.job order by jobname;
select name, created_at, updated_at from vault.secrets where name = 'sgm_cron_secret';

-- Depois do primeiro disparo: histórico do pg_cron e respostas HTTP da VPS.
-- status_code 200 = ok; 401 = segredo do Vault diferente do CRON_SECRET da VPS;
-- 503 = CRON_SECRET vazio em /opt/sgm/.env (ou o app não foi recriado depois de preencher).
-- select jobname, status, return_message, start_time from cron.job_run_details
--   join cron.job using (jobid) order by start_time desc limit 20;
-- select id, status_code, left(content::text, 200) as resposta, created
--   from net._http_response order by id desc limit 20;

-- Trocar o segredo depois: gere outro na VPS, atualize o /opt/sgm/.env, recrie o app e rode só o bloco 2.

-- Rotinas que TÊM botão na interface e por isso ficaram fora da agenda:
--   check-audiencias-vencimento (Jurídico), check-documentos-vencimento (Licitações),
--   process-whatsapp-campanhas (Comunicação WhatsApp), importar-nfes-brasilnfe (NF-es recebidas).
-- Elas exigem usuário logado na ponte. Agendar uma delas pede que a ponte aceite também o
-- x-cron-secret para ela, sem tirar o acesso do botão (mudança em src/lib/edge/auth.ts).
