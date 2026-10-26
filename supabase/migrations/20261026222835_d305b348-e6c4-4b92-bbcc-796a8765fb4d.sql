ALTER TABLE public.epis_catalogo
  ADD COLUMN IF NOT EXISTS grupo text,
  ADD COLUMN IF NOT EXISTS subgrupo text,
  ADD COLUMN IF NOT EXISTS unidade text;