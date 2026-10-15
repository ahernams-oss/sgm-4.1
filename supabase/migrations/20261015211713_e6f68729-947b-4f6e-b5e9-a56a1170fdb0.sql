CREATE TABLE public.pmoc_precos_btu (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  btu_min integer NOT NULL DEFAULT 0,
  btu_max integer NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pmoc_precos_btu TO authenticated;
GRANT ALL ON public.pmoc_precos_btu TO service_role;
ALTER TABLE public.pmoc_precos_btu ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmoc_valores gerencia precos" ON public.pmoc_precos_btu FOR ALL TO authenticated
  USING (public.has_module('pmoc_valores')) WITH CHECK (public.has_module('pmoc_valores'));

CREATE TABLE public.pmoc_faturamento_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_id uuid NOT NULL,
  data_execucao date NOT NULL,
  execucao_id uuid,
  equipamento_nome text,
  cliente_nome text,
  local_descricao text,
  capacidade_btu integer,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  confirmado_por text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipamento_id, data_execucao)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pmoc_faturamento_itens TO authenticated;
GRANT ALL ON public.pmoc_faturamento_itens TO service_role;
ALTER TABLE public.pmoc_faturamento_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pmoc_valores gerencia faturamento" ON public.pmoc_faturamento_itens FOR ALL TO authenticated
  USING (public.has_module('pmoc_valores')) WITH CHECK (public.has_module('pmoc_valores'));

CREATE OR REPLACE FUNCTION public.pmoc_set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
CREATE TRIGGER trg_pmoc_precos_upd BEFORE UPDATE ON public.pmoc_precos_btu FOR EACH ROW EXECUTE FUNCTION public.pmoc_set_updated_at();
CREATE TRIGGER trg_pmoc_fat_upd BEFORE UPDATE ON public.pmoc_faturamento_itens FOR EACH ROW EXECUTE FUNCTION public.pmoc_set_updated_at();

CREATE OR REPLACE FUNCTION public.pmoc_registrar_faturamento() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_eq record; v_btu integer; v_valor numeric;
BEGIN
  IF NEW.status <> 'Confirmada' OR NEW.equipamento_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'Confirmada' THEN RETURN NEW; END IF;
  SELECT * INTO v_eq FROM public.equipamentos WHERE id = NEW.equipamento_id;
  v_btu := NULLIF(regexp_replace(COALESCE(v_eq.capacidade_btu, ''), '[^0-9]', '', 'g'), '')::integer;
  SELECT valor INTO v_valor FROM public.pmoc_precos_btu
    WHERE v_btu IS NOT NULL AND v_btu BETWEEN btu_min AND btu_max
    ORDER BY btu_max ASC LIMIT 1;
  INSERT INTO public.pmoc_faturamento_itens
    (equipamento_id, data_execucao, execucao_id, equipamento_nome, cliente_nome, local_descricao, capacidade_btu, valor, confirmado_por)
  VALUES (NEW.equipamento_id, (NEW.data_execucao AT TIME ZONE 'America/Sao_Paulo')::date, NEW.id,
    COALESCE(v_eq.equipamento, NEW.equipamento_nome), v_eq.cliente_nome, v_eq.local_descricao, v_btu, COALESCE(v_valor, 0), NEW.confirmado_por)
  ON CONFLICT (equipamento_id, data_execucao) DO NOTHING;
  RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.pmoc_registrar_faturamento() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_pmoc_exec_faturamento AFTER INSERT OR UPDATE OF status ON public.pmoc_atividades_execucoes
  FOR EACH ROW EXECUTE FUNCTION public.pmoc_registrar_faturamento();