ALTER TABLE public.processos_seletivos
  ADD COLUMN IF NOT EXISTS ultimo_movimento_em timestamptz,
  ADD COLUMN IF NOT EXISTS alerta_inatividade_em timestamptz;
UPDATE public.processos_seletivos SET ultimo_movimento_em = COALESCE(created_at, now()) WHERE ultimo_movimento_em IS NULL;
ALTER TABLE public.processos_seletivos ALTER COLUMN ultimo_movimento_em SET DEFAULT now();
CREATE OR REPLACE FUNCTION public.ps_registrar_movimento() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.candidatos IS DISTINCT FROM OLD.candidatos THEN
    NEW.ultimo_movimento_em := now();
    NEW.alerta_inatividade_em := NULL;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS ps_registrar_movimento ON public.processos_seletivos;
CREATE TRIGGER ps_registrar_movimento BEFORE UPDATE ON public.processos_seletivos FOR EACH ROW EXECUTE FUNCTION public.ps_registrar_movimento();