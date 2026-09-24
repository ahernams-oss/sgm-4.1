DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='fin_contas_pagar') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.fin_contas_pagar;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='pedidos_compra') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos_compra;
  END IF;
END $$;