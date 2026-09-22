CREATE OR REPLACE FUNCTION public.set_next_rp_numero()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero <= 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('rp_numero'));
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero FROM public.requisicoes;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_next_rp_numero ON public.requisicoes;
CREATE TRIGGER trg_set_next_rp_numero
BEFORE INSERT ON public.requisicoes
FOR EACH ROW EXECUTE FUNCTION public.set_next_rp_numero();

CREATE UNIQUE INDEX IF NOT EXISTS requisicoes_numero_key ON public.requisicoes (numero);