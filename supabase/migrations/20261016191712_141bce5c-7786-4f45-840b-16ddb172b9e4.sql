CREATE TABLE public.fin_contas_pagar_rateio (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conta_pagar_id UUID NOT NULL REFERENCES public.fin_contas_pagar(id) ON DELETE CASCADE,
  centro_custo_id UUID NOT NULL REFERENCES public.fin_centros_custo(id) ON DELETE RESTRICT,
  percentual NUMERIC(7,4) NOT NULL DEFAULT 0,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_contas_pagar_rateio TO authenticated;
GRANT ALL ON public.fin_contas_pagar_rateio TO service_role;
ALTER TABLE public.fin_contas_pagar_rateio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios autenticados gerenciam rateio" ON public.fin_contas_pagar_rateio FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_fin_cp_rateio_conta ON public.fin_contas_pagar_rateio(conta_pagar_id);