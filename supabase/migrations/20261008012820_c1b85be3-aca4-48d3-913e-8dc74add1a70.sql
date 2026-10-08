-- Permissão por prefixo de módulo (ex.: 'pregao' cobre 'pregao.visualizar').
CREATE OR REPLACE FUNCTION public.has_module_prefix(_prefixo text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_acesso_total() OR EXISTS (
    SELECT 1 FROM public.usuarios u
    JOIN public.perfis_acesso p ON p.id::text = u.perfil_acesso_id
    CROSS JOIN LATERAL jsonb_each_text(COALESCE(p.permissoes, '{}'::jsonb)) kv
    WHERE u.auth_user_id = auth.uid()
      AND (kv.key = _prefixo OR kv.key LIKE _prefixo || '.%')
      AND kv.value = 'true'
  )
$$;
REVOKE ALL ON FUNCTION public.has_module_prefix(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_module_prefix(text) TO authenticated, service_role;

-- Lances: só a equipe do módulo Pregão grava pelo sistema (fornecedor usa o servidor).
DROP POLICY IF EXISTS pregao_lances_auth ON public.pregao_lances;
CREATE POLICY pregao_lances_select_auth ON public.pregao_lances FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY pregao_lances_insert_equipe ON public.pregao_lances FOR INSERT TO authenticated WITH CHECK (public.has_module_prefix('pregao'));
CREATE POLICY pregao_lances_update_equipe ON public.pregao_lances FOR UPDATE TO authenticated USING (public.has_module_prefix('pregao')) WITH CHECK (public.has_module_prefix('pregao'));
CREATE POLICY pregao_lances_delete_equipe ON public.pregao_lances FOR DELETE TO authenticated USING (public.has_module_prefix('pregao'));

-- Validação no banco: lance só em item em disputa, participante do pregão e menor que o melhor lance.
CREATE OR REPLACE FUNCTION public.validar_pregao_lance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text; v_melhor numeric;
BEGIN
  IF NEW.valor IS NULL OR NEW.valor <= 0 THEN RAISE EXCEPTION 'Valor de lance inválido'; END IF;
  SELECT status INTO v_status FROM public.pregao_itens WHERE id = NEW.item_id AND pregao_id = NEW.pregao_id;
  IF v_status IS NULL THEN RAISE EXCEPTION 'Item não pertence ao pregão'; END IF;
  IF replace(v_status, ' ', '') <> 'EmDisputa' THEN RAISE EXCEPTION 'Item não está em disputa'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.pregao_participantes WHERE id = NEW.participante_id AND pregao_id = NEW.pregao_id) THEN
    RAISE EXCEPTION 'Participante não pertence ao pregão';
  END IF;
  SELECT min(valor) INTO v_melhor FROM public.pregao_lances WHERE item_id = NEW.item_id AND COALESCE(cancelado, false) = false;
  IF v_melhor IS NOT NULL AND NEW.valor >= v_melhor THEN RAISE EXCEPTION 'O lance deve ser menor que o melhor lance atual'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validar_pregao_lance ON public.pregao_lances;
CREATE TRIGGER trg_validar_pregao_lance BEFORE INSERT ON public.pregao_lances FOR EACH ROW EXECUTE FUNCTION public.validar_pregao_lance();

-- Destinatários cadastrados (usados pelo servidor antes de enviar e-mail/WhatsApp).
CREATE OR REPLACE FUNCTION public.destinatario_email_cadastrado(_email text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH e AS (SELECT lower(trim(_email)) v)
  SELECT length((SELECT v FROM e)) >= 5 AND (
       EXISTS (SELECT 1 FROM public.usuarios t, e WHERE lower(t::text) LIKE '%' || e.v || '%')
    OR EXISTS (SELECT 1 FROM public.funcionarios t, e WHERE lower(coalesce(t.email,'')) LIKE '%' || e.v || '%')
    OR EXISTS (SELECT 1 FROM public.clientes t, e WHERE lower(concat_ws(' ', t.email, t.email_compras, t.email_engenharia, t.email_os_cc, t.email_os_bcc, t.email_ss_cc, t.email_ss_bcc, t.contato)) LIKE '%' || e.v || '%')
    OR EXISTS (SELECT 1 FROM public.empresa t, e WHERE lower(t::text) LIKE '%' || e.v || '%')
    OR EXISTS (SELECT 1 FROM public.juridico_contatos_notificacao t, e WHERE lower(coalesce(t.email,'')) LIKE '%' || e.v || '%')
    OR EXISTS (SELECT 1 FROM public.comunicacao_grupos t, e WHERE lower(t::text) LIKE '%' || e.v || '%')
  )
$$;

CREATE OR REPLACE FUNCTION public.destinatario_telefone_cadastrado(_digitos text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH d AS (
    SELECT CASE WHEN length(x) IN (12, 13) AND x LIKE '55%' THEN substr(x, 3) ELSE x END v
    FROM (SELECT regexp_replace(coalesce(_digitos,''), '\D', '', 'g') x) s
  )
  SELECT length((SELECT v FROM d)) >= 8 AND (
       EXISTS (SELECT 1 FROM public.usuarios t, d WHERE regexp_replace(coalesce(t.telefone,''), '\D', '', 'g') LIKE '%' || d.v || '%')
    OR EXISTS (SELECT 1 FROM public.funcionarios t, d WHERE regexp_replace(concat_ws(' ', t.telefone, t.telefone_whatsapp), '\D', '', 'g') LIKE '%' || d.v || '%')
    OR EXISTS (SELECT 1 FROM public.clientes t, d WHERE regexp_replace(concat_ws('|', t.celulares::text, t.telefones::text, t.telefones_whatsapp::text, t.telefone_celular::text, t.grupo_whatsapp::text, t.contato::text), '[^0-9|]', '', 'g') LIKE '%' || d.v || '%')
    OR EXISTS (SELECT 1 FROM public.empresa t, d WHERE regexp_replace(t::text, '[^0-9,]', '', 'g') LIKE '%' || d.v || '%')
    OR EXISTS (SELECT 1 FROM public.juridico_contatos_notificacao t, d WHERE regexp_replace(coalesce(t.telefone_whatsapp,''), '\D', '', 'g') LIKE '%' || d.v || '%')
    OR EXISTS (SELECT 1 FROM public.licitacoes_telefones_notificacao t, d WHERE regexp_replace(coalesce(t.telefone,''), '\D', '', 'g') LIKE '%' || d.v || '%')
    OR EXISTS (SELECT 1 FROM public.comunicacao_grupos t, d WHERE regexp_replace(t::text, '[^0-9,]', '', 'g') LIKE '%' || d.v || '%')
  )
$$;
REVOKE ALL ON FUNCTION public.destinatario_email_cadastrado(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.destinatario_telefone_cadastrado(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.destinatario_email_cadastrado(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.destinatario_telefone_cadastrado(text) TO service_role;