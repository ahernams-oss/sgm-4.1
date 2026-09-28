ALTER TABLE public.pmoc_ordens_servico ADD COLUMN IF NOT EXISTS execucao_id text DEFAULT '';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pmoc_ordens_servico TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.pmoc_ordens_servico_numero_seq TO authenticated;