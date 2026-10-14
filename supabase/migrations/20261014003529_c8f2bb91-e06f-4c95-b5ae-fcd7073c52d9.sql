CREATE TABLE public.categorias_compras_fabricantes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  grupo_id uuid NOT NULL REFERENCES public.categorias_compras_grupos(id) ON DELETE CASCADE,
  fabricante_id uuid NOT NULL REFERENCES public.fabricantes(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (grupo_id, fabricante_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_compras_fabricantes TO authenticated;
GRANT ALL ON public.categorias_compras_fabricantes TO service_role;
ALTER TABLE public.categorias_compras_fabricantes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuarios logados gerenciam vinculos fabricantes" ON public.categorias_compras_fabricantes
  FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);