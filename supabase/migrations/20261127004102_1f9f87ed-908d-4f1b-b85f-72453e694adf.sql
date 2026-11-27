ALTER TABLE public.ordens_servico
  ADD COLUMN IF NOT EXISTS servicos_eventuais jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.ordens_servico.servicos_eventuais IS 'Itens de Serv. Eventuais selecionados na O.S., com vínculo ao item do contrato, quantidade e valor unitário com CITL.';