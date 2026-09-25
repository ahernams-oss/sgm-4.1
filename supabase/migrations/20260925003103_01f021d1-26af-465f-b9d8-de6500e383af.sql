ALTER TABLE public.portal_treinamentos
  ADD COLUMN IF NOT EXISTS carga_horaria numeric,
  ADD COLUMN IF NOT EXISTS realizado_em date,
  ADD COLUMN IF NOT EXISTS local text,
  ADD COLUMN IF NOT EXISTS instr_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS instr_assinante_nome text,
  ADD COLUMN IF NOT EXISTS instr_assinante_cargo text,
  ADD COLUMN IF NOT EXISTS instr_assinatura_hash text,
  ADD COLUMN IF NOT EXISTS coord_assinado_em timestamptz,
  ADD COLUMN IF NOT EXISTS coord_assinante_nome text,
  ADD COLUMN IF NOT EXISTS coord_assinante_cargo text,
  ADD COLUMN IF NOT EXISTS coord_assinatura_hash text;