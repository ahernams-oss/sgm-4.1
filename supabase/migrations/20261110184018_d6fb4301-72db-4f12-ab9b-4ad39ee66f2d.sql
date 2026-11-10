DELETE FROM public.usuarios WHERE id = 'fab1fb72-c752-4ca0-af25-1907eea6c895';
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_lower_unique ON public.usuarios (lower(email));