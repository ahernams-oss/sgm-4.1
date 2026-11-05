CREATE OR REPLACE FUNCTION public.set_next_nfse_numero()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
DECLARE inicio bigint;
BEGIN
  IF NEW.numero_dps IS NULL OR NEW.numero_dps = 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('nfse_numero_' || COALESCE(NEW.empresa_id::text,'') || '_' || COALESCE(NEW.ambiente::text,'') || '_' || COALESCE(NEW.serie,'')));
    SELECT GREATEST(COALESCE(MAX(proximo_numero_dps), 1), 1) INTO inicio
    FROM public.nfse_config
    WHERE empresa_id = NEW.empresa_id AND ambiente = NEW.ambiente AND serie_padrao = NEW.serie;
    SELECT GREATEST(COALESCE(MAX(numero_dps), 0) + 1, inicio) INTO NEW.numero_dps
    FROM public.nfses_emitidas
    WHERE COALESCE(empresa_id::text,'') = COALESCE(NEW.empresa_id::text,'')
      AND ambiente = NEW.ambiente AND serie = NEW.serie;
  END IF;
  RETURN NEW;
END;
$function$;