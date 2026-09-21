CREATE OR REPLACE FUNCTION public.set_next_rcs_numero()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.numero IS NULL OR NEW.numero = 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('rcs_numero'));
    SELECT COALESCE(MAX(numero), 0) + 1 INTO NEW.numero
    FROM public.requisicoes_compras;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_next_rcs_numero ON public.requisicoes_compras;
CREATE TRIGGER trg_set_next_rcs_numero
BEFORE INSERT ON public.requisicoes_compras
FOR EACH ROW EXECUTE FUNCTION public.set_next_rcs_numero();

CREATE UNIQUE INDEX IF NOT EXISTS requisicoes_compras_numero_key
ON public.requisicoes_compras (numero);