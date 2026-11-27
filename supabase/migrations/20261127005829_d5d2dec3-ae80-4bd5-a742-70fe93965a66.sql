INSERT INTO public.os_modelos (nome, descricao, created_at, updated_at)
SELECT 'Modelo_FioCruz', 'Layout FioCruz - O.S. com Serviços Eventuais', '2026-10-09 23:37:35+00', now()
WHERE NOT EXISTS (SELECT 1 FROM public.os_modelos WHERE lower(nome) = lower('Modelo_FioCruz'));