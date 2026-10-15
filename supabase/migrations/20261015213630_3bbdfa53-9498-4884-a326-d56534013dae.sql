ALTER TABLE public.pmoc_precos_btu ADD COLUMN IF NOT EXISTS cliente_id text;
CREATE INDEX IF NOT EXISTS pmoc_precos_btu_cliente_idx ON public.pmoc_precos_btu(cliente_id);
CREATE OR REPLACE FUNCTION public.pmoc_registrar_faturamento()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v_eq record; v_btu integer; v_valor numeric;
BEGIN
  IF NEW.status <> 'Confirmada' OR NEW.equipamento_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'Confirmada' THEN RETURN NEW; END IF;
  SELECT * INTO v_eq FROM public.equipamentos WHERE id = NEW.equipamento_id;
  v_btu := NULLIF(regexp_replace(COALESCE(v_eq.capacidade_btu, ''), '[^0-9]', '', 'g'), '')::integer;
  SELECT valor INTO v_valor FROM public.pmoc_precos_btu
    WHERE v_btu IS NOT NULL AND v_btu BETWEEN btu_min AND btu_max
      AND (cliente_id IS NULL OR cliente_id = v_eq.cliente_id::text)
    ORDER BY (cliente_id IS NULL), btu_max ASC LIMIT 1;
  INSERT INTO public.pmoc_faturamento_itens
    (equipamento_id, data_execucao, execucao_id, equipamento_nome, cliente_nome, local_descricao, capacidade_btu, valor, confirmado_por)
  VALUES (NEW.equipamento_id, (NEW.data_execucao AT TIME ZONE 'America/Sao_Paulo')::date, NEW.id,
    COALESCE(v_eq.equipamento, NEW.equipamento_nome), v_eq.cliente_nome, v_eq.local_descricao, v_btu, COALESCE(v_valor, 0), NEW.confirmado_por)
  ON CONFLICT (equipamento_id, data_execucao) DO NOTHING;
  RETURN NEW;
END; $function$;