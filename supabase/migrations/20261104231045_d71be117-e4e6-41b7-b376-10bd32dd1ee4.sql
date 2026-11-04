CREATE OR REPLACE FUNCTION public.sgm_cargo_bloqueia_administracao(_nome text, _chave text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT public.sgm_normaliza_cargo(_nome) IN ('coordenador técnico lasant','coordenador tecnico lasant','coordenador administrativo lasant','gerente executivo lasant','gerente executivo')
 AND split_part(_chave,'.',1) IN ('usuarios','perfis_acesso')
$$;
CREATE OR REPLACE FUNCTION public.sgm_modulo_exige_perfil(_chave text)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
 SELECT split_part(_chave,'.',1) = 'monitor_tv' OR left(split_part(_chave,'.',1),10) = 'gerencial_'
$$;
CREATE OR REPLACE FUNCTION public.sgm_tem_permissao(_chave text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.usuarios u
 LEFT JOIN public.cargos c ON c.id::text = u.cargo_id
 LEFT JOIN public.perfis_acesso p ON p.id::text = u.perfil_acesso_id
 WHERE u.auth_user_id = auth.uid() AND u.ativo IS DISTINCT FROM false
 AND NOT public.sgm_cargo_bloqueia_administracao(c.nome,_chave)
 AND ((public.sgm_cargo_acesso_total(c.nome) AND NOT public.sgm_modulo_exige_perfil(_chave))
 OR coalesce(p.permissoes ->> _chave,'') = 'true'))
$$;
CREATE OR REPLACE FUNCTION public.has_module(_modulo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT public.sgm_tem_permissao(_modulo)
$$;
CREATE OR REPLACE FUNCTION public.has_module_prefix(_prefixo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT EXISTS (
 SELECT 1 FROM public.usuarios u
 LEFT JOIN public.cargos c ON c.id::text = u.cargo_id
 LEFT JOIN public.perfis_acesso p ON p.id::text = u.perfil_acesso_id
 WHERE u.auth_user_id = auth.uid() AND u.ativo IS DISTINCT FROM false
 AND NOT public.sgm_cargo_bloqueia_administracao(c.nome,_prefixo)
 AND ((public.sgm_cargo_acesso_total(c.nome) AND NOT public.sgm_modulo_exige_perfil(_prefixo))
 OR EXISTS (SELECT 1 FROM jsonb_each_text(coalesce(p.permissoes,'{}'::jsonb)) kv
 WHERE (kv.key = _prefixo OR starts_with(kv.key,_prefixo || '.')) AND kv.value = 'true')))
$$;