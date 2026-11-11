ALTER TABLE public.usuarios ADD COLUMN destinado_cliente boolean NOT NULL DEFAULT false;
ALTER TABLE public.perfis_acesso ADD COLUMN destinado_cliente boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.usuarios.destinado_cliente IS 'Marcador visual de usuário destinado a cliente; não concede permissões ou acesso a clientes.';
COMMENT ON COLUMN public.perfis_acesso.destinado_cliente IS 'Marcador visual de perfil destinado a cliente; não concede permissões ou acesso a clientes.';