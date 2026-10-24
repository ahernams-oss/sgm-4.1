CREATE OR REPLACE FUNCTION public.set_next_nfse_numero()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.numero_dps IS NULL OR NEW.numero_dps = 0 THEN
    PERFORM pg_advisory_xact_lock(hashtext('nfse_numero_' || COALESCE(NEW.empresa_id::text,'') || '_' || COALESCE(NEW.ambiente::text,'') || '_' || COALESCE(NEW.serie,'')));
    SELECT COALESCE(MAX(numero_dps), 0) + 1 INTO NEW.numero_dps
    FROM public.nfses_emitidas
    WHERE COALESCE(empresa_id::text,'') = COALESCE(NEW.empresa_id::text,'')
      AND ambiente = NEW.ambiente
      AND serie = NEW.serie;
  END IF;
  RETURN NEW;
END;
$function$;

-- Regression: invoke the real trigger on a temporary table; no invoice is persisted or sent.
DO $test$
DECLARE
  test_serie text := 'teste_nfse_' || gen_random_uuid()::text;
  actual bigint;
BEGIN
  CREATE TEMP TABLE nfse_numero_regressao (
    empresa_id uuid, ambiente smallint, serie text, numero_dps bigint
  ) ON COMMIT DROP;
  CREATE TRIGGER teste_numero_nfse BEFORE INSERT ON nfse_numero_regressao
    FOR EACH ROW EXECUTE FUNCTION public.set_next_nfse_numero();

  INSERT INTO nfse_numero_regressao VALUES (NULL, 2, test_serie, NULL)
    RETURNING numero_dps INTO actual;
  IF actual IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Regressão NFS-e: homologação deveria gerar 1, recebeu %', actual;
  END IF;
  INSERT INTO nfse_numero_regressao VALUES (NULL, 1, test_serie, 0)
    RETURNING numero_dps INTO actual;
  IF actual IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Regressão NFS-e: produção deveria gerar 1, recebeu %', actual;
  END IF;
  INSERT INTO nfse_numero_regressao VALUES (NULL, 2, test_serie, 118)
    RETURNING numero_dps INTO actual;
  IF actual IS DISTINCT FROM 118 THEN
    RAISE EXCEPTION 'Regressão NFS-e: número explícito deveria permanecer 118, recebeu %', actual;
  END IF;
END;
$test$;