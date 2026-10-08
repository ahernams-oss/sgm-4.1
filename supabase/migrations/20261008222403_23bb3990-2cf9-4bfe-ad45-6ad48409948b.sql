CREATE OR REPLACE FUNCTION public.sgm_normaliza_cargo(_nome text) RETURNS text LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  select regexp_replace(lower(btrim(coalesce(_nome,''))), '\s+', ' ', 'g')
$$;

CREATE OR REPLACE FUNCTION public.sgm_cargo_acesso_total(_nome text) RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path TO 'public' AS $$
  select public.sgm_normaliza_cargo(_nome) in (
    'diretor geral lasant', 'gerente executivo lasant',
    'coordenador administrativo lasant', 'coordenador técnico lasant', 'coordenador tecnico lasant')
$$;

CREATE OR REPLACE FUNCTION public.is_diretor_geral() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select exists (select 1 from public.usuarios u join public.cargos c on c.id::text = u.cargo_id
    where u.auth_user_id = auth.uid() and public.sgm_normaliza_cargo(c.nome) = 'diretor geral lasant')
$$;

CREATE OR REPLACE FUNCTION public.sgm_cargo_id_protegido(_id text) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select coalesce(_id,'') <> '' and exists (select 1 from public.cargos c where c.id::text = _id and public.sgm_cargo_acesso_total(c.nome))
$$;

-- Cargos protegidos: só o Diretor Geral Lasant cria, renomeia ou apaga
CREATE OR REPLACE FUNCTION public.proteger_cargos_acesso_total() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_diretor_geral() THEN RETURN COALESCE(NEW, OLD); END IF;
  IF (TG_OP <> 'INSERT' AND public.sgm_cargo_acesso_total(OLD.nome))
     OR (TG_OP <> 'DELETE' AND public.sgm_cargo_acesso_total(NEW.nome)) THEN
    RAISE EXCEPTION 'Somente o Diretor Geral Lasant pode alterar este cargo.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
DROP TRIGGER IF EXISTS trg_proteger_cargos_acesso_total ON public.cargos;
CREATE TRIGGER trg_proteger_cargos_acesso_total BEFORE INSERT OR UPDATE OR DELETE ON public.cargos
  FOR EACH ROW EXECUTE FUNCTION public.proteger_cargos_acesso_total();

-- Atribuição: só o Diretor Geral Lasant coloca ou tira alguém de um cargo protegido
CREATE OR REPLACE FUNCTION public.proteger_atribuicao_cargo() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_diretor_geral() THEN RETURN NEW; END IF;
  IF (TG_OP = 'INSERT' AND public.sgm_cargo_id_protegido(NEW.cargo_id))
     OR (TG_OP = 'UPDATE' AND NEW.cargo_id IS DISTINCT FROM OLD.cargo_id
         AND (public.sgm_cargo_id_protegido(NEW.cargo_id) OR public.sgm_cargo_id_protegido(OLD.cargo_id))) THEN
    RAISE EXCEPTION 'Somente o Diretor Geral Lasant pode atribuir este cargo.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_cargo_usuarios ON public.usuarios;
CREATE TRIGGER trg_proteger_cargo_usuarios BEFORE INSERT OR UPDATE OF cargo_id ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_atribuicao_cargo();
DROP TRIGGER IF EXISTS trg_proteger_cargo_funcionarios ON public.funcionarios;
CREATE TRIGGER trg_proteger_cargo_funcionarios BEFORE INSERT OR UPDATE OF cargo_id ON public.funcionarios
  FOR EACH ROW EXECUTE FUNCTION public.proteger_atribuicao_cargo();

REVOKE EXECUTE ON FUNCTION public.proteger_cargos_acesso_total() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.proteger_atribuicao_cargo() FROM PUBLIC, anon, authenticated;