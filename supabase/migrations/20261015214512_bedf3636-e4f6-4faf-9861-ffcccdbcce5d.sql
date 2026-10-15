CREATE TABLE public.equipamentos_capacidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  btu integer NOT NULL UNIQUE,
  descricao text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.equipamentos_capacidades TO authenticated;
GRANT ALL ON public.equipamentos_capacidades TO service_role;
ALTER TABLE public.equipamentos_capacidades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios logados gerenciam capacidades" ON public.equipamentos_capacidades FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
INSERT INTO public.equipamentos_capacidades (btu, descricao) VALUES
(7000,'7.000 BTUs'),(9000,'9.000 BTUs'),(12000,'12.000 BTUs'),(18000,'18.000 BTUs'),(22000,'22.000 BTUs'),(24000,'24.000 BTUs'),(30000,'30.000 BTUs'),(36000,'36.000 BTUs'),(48000,'48.000 BTUs'),(57000,'57.000 BTUs'),(60000,'60.000 BTUs');