ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS grupo_whatsapp_emergencia TEXT;

COMMENT ON COLUMN public.clientes.grupo_whatsapp_emergencia IS 'JID do grupo de WhatsApp de emergência do cliente (formato 120363xxxxxxx@g.us)';