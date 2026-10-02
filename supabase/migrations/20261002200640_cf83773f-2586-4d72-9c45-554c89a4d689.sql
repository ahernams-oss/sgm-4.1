CREATE TABLE public.locais_entrevista (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), descricao text NOT NULL UNIQUE, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.locais_entrevista TO authenticated;
GRANT ALL ON public.locais_entrevista TO service_role;
ALTER TABLE public.locais_entrevista ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios logados gerenciam locais" ON public.locais_entrevista FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);