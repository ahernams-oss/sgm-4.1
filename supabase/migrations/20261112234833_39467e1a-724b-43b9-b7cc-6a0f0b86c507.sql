ALTER TABLE public.requisicoes ADD COLUMN IF NOT EXISTS solicitante_usuario_id uuid;
UPDATE public.requisicoes r SET solicitante_usuario_id = u.id FROM public.usuarios u WHERE r.solicitante_usuario_id IS NULL AND (lower(trim(r.solicitante))=lower(trim(u.nome)) OR lower(trim(r.solicitante))=lower(trim(u.email))) AND (SELECT count(*) FROM public.usuarios x WHERE lower(trim(r.solicitante))=lower(trim(x.nome)) OR lower(trim(r.solicitante))=lower(trim(x.email)))=1;
CREATE OR REPLACE FUNCTION public.rp_preservar_solicitante() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN
IF TG_OP='INSERT' THEN IF auth.uid() IS NOT NULL THEN NEW.solicitante_usuario_id := public.current_usuario_id(); END IF;
ELSIF NEW.solicitante_usuario_id IS DISTINCT FROM OLD.solicitante_usuario_id THEN RAISE EXCEPTION 'O solicitante original da requisição não pode ser alterado.'; END IF;
RETURN NEW; END $$;
CREATE TRIGGER rp_preservar_solicitante BEFORE INSERT OR UPDATE ON public.requisicoes FOR EACH ROW EXECUTE FUNCTION public.rp_preservar_solicitante();