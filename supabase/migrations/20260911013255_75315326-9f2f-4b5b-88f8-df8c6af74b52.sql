GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.obras TO anon;
GRANT ALL ON public.obras TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.obras_numero_seq TO authenticated, anon, service_role;