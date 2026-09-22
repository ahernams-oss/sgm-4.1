CREATE TABLE public.fin_fluxo_ajustes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data date NOT NULL DEFAULT CURRENT_DATE,
  tipo text NOT NULL DEFAULT 'entrada',
  descricao text NOT NULL DEFAULT '',
  valor numeric NOT NULL DEFAULT 0,
  conta_bancaria_id uuid NULL REFERENCES public.fin_contas_bancarias(id) ON DELETE SET NULL,
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_fluxo_ajustes TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_fluxo_ajustes TO anon;
GRANT ALL ON public.fin_fluxo_ajustes TO service_role;

ALTER TABLE public.fin_fluxo_ajustes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_acesso_fin_fluxo_ajustes" ON public.fin_fluxo_ajustes FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_fin_fluxo_ajustes_updated_at BEFORE UPDATE ON public.fin_fluxo_ajustes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();