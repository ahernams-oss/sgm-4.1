-- Rotinas agendadas do SGM: pg_cron (no Supabase) chamando as funções na VPS.
--
-- Onde rodar: SQL Editor do projeto Supabase ATUAL (mbasypzxvvufavraofif), depois que a VPS
-- estiver no ar e respondendo em https://SEU-DOMINIO/api/public/edge/<funcao>.
--
-- Antes de rodar, troque os dois valores no bloco 2:
--   base_url  -> URL pública do SGM na VPS, sem barra no fim
--   apikey    -> SUPABASE_PUBLISHABLE_KEY do projeto atual (a mesma VITE_SUPABASE_PUBLISHABLE_KEY do .env)
--
-- Horários em UTC (padrão do pg_cron no Supabase). Brasília = UTC-3: 12:00 UTC = 09:00 BRT.
--
-- Se os 3 jobs antigos (check-parcelas-vencimento-daily, notificar-vencimento-ferias-daily,
-- cotacao-epis-vencendo-daily) estiverem no projeto ANTIGO (vdjezhhrnksluzealfcl), rode o bloco 1
-- também lá, ou pause aquele projeto: eles continuam disparando as funções antigas com dados antigos.

-- 0) Extensões (se der erro de permissão, ative em Database > Extensions no painel)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) Remover os jobs antigos, que apontavam para o projeto vdjezhhrnksluzealfcl
select cron.unschedule(jobname)
from cron.job
where jobname in (
  'check-parcelas-vencimento-daily',
  'notificar-vencimento-ferias-daily',
  'cotacao-epis-vencendo-daily'
);

-- 2) Criar (ou recriar) os jobs apontando para a VPS
do $$
declare
  base_url text := 'https://SEU-DOMINIO';          -- <-- ajuste
  apikey   text := 'SUA_SUPABASE_PUBLISHABLE_KEY';  -- <-- ajuste
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
            'apikey', %L,
            'Authorization', 'Bearer ' || %L
          ),
          body := jsonb_build_object('source', 'cron'),
          timeout_milliseconds := 60000
        ) as request_id;
      $cmd$, base_url || '/api/public/edge/' || j.fn, apikey, apikey)
    );
  end loop;
end $$;

-- 3) Conferir
select jobname, schedule, active from cron.job order by jobname;

-- Depois do primeiro disparo: histórico do pg_cron e respostas HTTP da VPS
-- select jobname, status, return_message, start_time from cron.job_run_details
--   join cron.job using (jobid) order by start_time desc limit 20;
-- select id, status_code, left(content::text, 200) as resposta, created
--   from net._http_response order by id desc limit 20;

-- Rotinas que TÊM botão na interface e por isso ficaram fora da agenda (adicione se quiser):
--   check-audiencias-vencimento (Jurídico), check-documentos-vencimento (Licitações),
--   process-whatsapp-campanhas (Comunicação WhatsApp), importar-nfes-brasilnfe (NF-es recebidas).
