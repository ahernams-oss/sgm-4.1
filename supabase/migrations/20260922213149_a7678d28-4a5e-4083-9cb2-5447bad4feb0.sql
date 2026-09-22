ALTER TABLE public.lancamentos ALTER COLUMN unidade_he DROP DEFAULT;
ALTER TABLE public.lancamentos ALTER COLUMN unidade_he TYPE text USING (CASE WHEN unidade_he = 0 THEN '' ELSE unidade_he::text END);
ALTER TABLE public.lancamentos ALTER COLUMN unidade_he SET DEFAULT '';