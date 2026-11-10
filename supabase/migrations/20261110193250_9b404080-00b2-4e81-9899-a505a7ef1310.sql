CREATE OR REPLACE FUNCTION public.sgm_validar_criacao_ss()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.sgm_tem_permissao('solicitacao_servicos.criar') THEN
    RAISE EXCEPTION 'Seu perfil não permite abrir SS.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sgm_validar_criacao_ss() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_validar_criacao_ss ON public.solicitacoes_servicos;
CREATE TRIGGER trg_validar_criacao_ss BEFORE INSERT ON public.solicitacoes_servicos
FOR EACH ROW EXECUTE FUNCTION public.sgm_validar_criacao_ss();