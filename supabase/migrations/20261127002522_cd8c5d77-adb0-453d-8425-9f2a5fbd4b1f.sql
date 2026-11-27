CREATE TABLE public.servicos_eventuais (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
 contrato_id text NOT NULL,
 grupo text NOT NULL DEFAULT '', subgrupo text NOT NULL DEFAULT '',
 item text NOT NULL, discriminacao text NOT NULL, unidade text NOT NULL,
 quantidade numeric(16,4) NOT NULL DEFAULT 0,
 preco_unitario numeric(16,2) NOT NULL DEFAULT 0,
 citl_percentual numeric(9,4) NOT NULL DEFAULT 0,
 referencia text NOT NULL DEFAULT '',
 unitario_com_citl numeric GENERATED ALWAYS AS (round(preco_unitario * (1 + citl_percentual / 100),2)) STORED,
 total_sem_citl numeric GENERATED ALWAYS AS (round(quantidade * preco_unitario,2)) STORED,
 total_com_citl numeric GENERATED ALWAYS AS (round(quantidade * round(preco_unitario * (1 + citl_percentual / 100),2),2)) STORED,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(cliente_id,contrato_id,item)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.servicos_eventuais TO authenticated;
GRANT ALL ON public.servicos_eventuais TO service_role;
ALTER TABLE public.servicos_eventuais ENABLE ROW LEVEL SECURITY;
CREATE POLICY eventuais_escopo ON public.servicos_eventuais AS RESTRICTIVE FOR ALL TO authenticated USING (auth.uid() IS NOT NULL AND sgm_private.sgm_cliente_permitido(cliente_id::text)) WITH CHECK (auth.uid() IS NOT NULL AND sgm_private.sgm_cliente_permitido(cliente_id::text));
CREATE POLICY eventuais_ler ON public.servicos_eventuais FOR SELECT TO authenticated USING(public.has_module_prefix('sco'));
CREATE POLICY eventuais_criar ON public.servicos_eventuais FOR INSERT TO authenticated WITH CHECK(public.has_module('sco.criar'));
CREATE POLICY eventuais_editar ON public.servicos_eventuais FOR UPDATE TO authenticated USING(public.has_module('sco.editar')) WITH CHECK(public.has_module('sco.editar'));
CREATE POLICY eventuais_excluir ON public.servicos_eventuais FOR DELETE TO authenticated USING(public.has_module('sco.excluir'));
CREATE INDEX servicos_eventuais_cliente_contrato_idx ON public.servicos_eventuais(cliente_id,contrato_id);
CREATE FUNCTION public.validar_servico_eventual() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM public.clientes c CROSS JOIN LATERAL jsonb_array_elements(coalesce(c.contratos,'[]'::jsonb)) ct WHERE c.id=NEW.cliente_id AND ct->>'id'=NEW.contrato_id) THEN RAISE EXCEPTION 'Selecione um contrato pertencente ao cliente.'; END IF;
 IF trim(NEW.item)='' OR trim(NEW.discriminacao)='' OR trim(NEW.unidade)='' THEN RAISE EXCEPTION 'Informe item, discriminação e unidade.'; END IF;
 IF NEW.quantidade<0 OR NEW.preco_unitario<0 OR NEW.citl_percentual<0 OR NEW.citl_percentual>100 OR NEW.quantidade::text IN ('NaN','Infinity','-Infinity') OR NEW.preco_unitario::text IN ('NaN','Infinity','-Infinity') OR NEW.citl_percentual::text IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'Quantidades e preços devem ser positivos; CITL deve estar entre 0 e 100%%.'; END IF;
 IF TG_OP='UPDATE' AND (NEW.cliente_id IS DISTINCT FROM OLD.cliente_id OR NEW.contrato_id IS DISTINCT FROM OLD.contrato_id) THEN RAISE EXCEPTION 'O vínculo com cliente e contrato não pode ser alterado.'; END IF;
 NEW.updated_at=now(); RETURN NEW;
END; $$;
CREATE TRIGGER validar_servico_eventual BEFORE INSERT OR UPDATE ON public.servicos_eventuais FOR EACH ROW EXECUTE FUNCTION public.validar_servico_eventual();