ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS suspenso boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS suspensao_motivo text,
  ADD COLUMN IF NOT EXISTS suspensao_data timestamptz,
  ADD COLUMN IF NOT EXISTS suspensao_ate date,
  ADD COLUMN IF NOT EXISTS suspensao_por text;