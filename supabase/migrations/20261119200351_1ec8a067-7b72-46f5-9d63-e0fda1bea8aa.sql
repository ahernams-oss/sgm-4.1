CREATE TABLE public.usuario_passkeys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
  credential_id text NOT NULL UNIQUE,
  public_key text NOT NULL,
  counter bigint NOT NULL DEFAULT 0,
  transports text,
  device_type text,
  nome text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  ultimo_uso timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.usuario_passkeys TO authenticated;
GRANT ALL ON public.usuario_passkeys TO service_role;

ALTER TABLE public.usuario_passkeys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_passkeys_dono" ON public.usuario_passkeys
  FOR ALL TO authenticated
  USING (usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()))
  WITH CHECK (usuario_id IN (SELECT id FROM public.usuarios WHERE auth_user_id = auth.uid()));

CREATE INDEX usuario_passkeys_usuario_idx ON public.usuario_passkeys (usuario_id);