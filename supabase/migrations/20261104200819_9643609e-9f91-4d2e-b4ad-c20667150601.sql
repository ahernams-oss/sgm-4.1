CREATE TABLE public.estoque_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id text, cotacao_numero integer, requisicao_id text, requisicao_numero integer,
  local_destino text NOT NULL,
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'Pendente',
  solicitante text, observacao text,
  aprovador text, data_decisao timestamptz, motivo_decisao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_transferencias TO authenticated;
GRANT ALL ON public.estoque_transferencias TO service_role;
ALTER TABLE public.estoque_transferencias ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Logados gerenciam transferencias" ON public.estoque_transferencias FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE OR REPLACE FUNCTION public.validar_decisao_transferencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'Pendente' THEN
    RAISE EXCEPTION 'Transferência deve começar como Pendente.' USING ERRCODE='42501';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status <> 'Pendente' THEN
      RAISE EXCEPTION 'Esta transferência já foi decidida.' USING ERRCODE='42501';
    END IF;
    IF auth.uid() IS NOT NULL AND NOT public.has_module('cotacoes.aprovar_transferencia') THEN
      RAISE EXCEPTION 'Você não possui permissão para aprovar transferências de estoque.' USING ERRCODE='42501';
    END IF;
    NEW.data_decisao := now();
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validar_decisao_transferencia BEFORE INSERT OR UPDATE ON public.estoque_transferencias
FOR EACH ROW EXECUTE FUNCTION public.validar_decisao_transferencia();