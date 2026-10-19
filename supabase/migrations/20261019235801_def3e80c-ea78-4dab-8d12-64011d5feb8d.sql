CREATE OR REPLACE FUNCTION public.sgm_validar_aprovacao_orcamento()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  limite numeric;
  nome_aprovador text;
  valor_aprovacao numeric;
BEGIN
  IF NEW.status IS DISTINCT FROM 'Aprovado' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'Aprovado' AND NEW.valor_total IS NOT DISTINCT FROM OLD.valor_total
      AND NEW.itens_sco IS NOT DISTINCT FROM OLD.itens_sco
      AND NEW.itens_materiais IS NOT DISTINCT FROM OLD.itens_materiais
      AND NEW.aprovado_por IS NOT DISTINCT FROM OLD.aprovado_por
      AND NEW.data_aprovacao IS NOT DISTINCT FROM OLD.data_aprovacao THEN
      RETURN NEW;
    END IF;
  END IF;
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Aprovação bloqueada: usuário não identificado.' USING ERRCODE = '42501';
  END IF;
  SELECT u.limite_aprovacao_os, u.nome INTO limite, nome_aprovador
  FROM public.usuarios u
  WHERE u.auth_user_id = auth.uid() AND u.ativo IS TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aprovação bloqueada: usuário inativo ou não identificado.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.has_module('solicitacao_servicos.status.aprovada') THEN
    RAISE EXCEPTION 'Você não possui permissão para aprovar este orçamento.' USING ERRCODE = '42501';
  END IF;
  IF limite IS NULL OR limite <= 0 OR limite::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Você não possui limite de aprovação de Ordens/Solicitações de Serviço.' USING ERRCODE = '42501';
  END IF;
  valor_aprovacao := NEW.valor_total;
  IF valor_aprovacao IS NULL OR valor_aprovacao < 0 OR valor_aprovacao::text IN ('NaN', 'Infinity', '-Infinity') THEN
    RAISE EXCEPTION 'Aprovação bloqueada: valor de orçamento inválido.' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    valor_aprovacao := greatest(valor_aprovacao, coalesce(OLD.valor_total, 0));
  END IF;
  IF valor_aprovacao > limite THEN
    RAISE EXCEPTION 'Aprovação bloqueada: valor do orçamento excede seu limite de aprovação.' USING ERRCODE = '42501';
  END IF;
  NEW.aprovado_por := nome_aprovador;
  NEW.data_aprovacao := now()::text;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sgm_validar_aprovacao_orcamento() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_validar_aprovacao_orcamento
BEFORE INSERT OR UPDATE ON public.orcamentos
FOR EACH ROW EXECUTE FUNCTION public.sgm_validar_aprovacao_orcamento();