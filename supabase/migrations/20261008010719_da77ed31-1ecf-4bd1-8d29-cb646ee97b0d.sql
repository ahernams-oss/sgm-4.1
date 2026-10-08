-- Fecha o acesso anônimo às tabelas do pregão. A sala do fornecedor agora
-- passa por funções de servidor (service role) que validam a participação.

-- pregao_lances
drop policy if exists app_acesso_pregao_lances on public.pregao_lances;
drop policy if exists pregao_lances_select on public.pregao_lances;
drop policy if exists pregao_lances_insert on public.pregao_lances;
drop policy if exists pregao_lances_update_auth on public.pregao_lances;
drop policy if exists pregao_lances_delete_auth on public.pregao_lances;
drop policy if exists pregao_lances_anon_insert on public.pregao_lances;
drop policy if exists pregao_lances_auth on public.pregao_lances;
create policy pregao_lances_auth on public.pregao_lances
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- pregao_mensagens
drop policy if exists pregao_msg_all on public.pregao_mensagens;
drop policy if exists pregao_mensagens_anon_insert on public.pregao_mensagens;
drop policy if exists pregao_mensagens_auth on public.pregao_mensagens;
create policy pregao_mensagens_auth on public.pregao_mensagens
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- pregao_itens
drop policy if exists pregao_itens_all on public.pregao_itens;
drop policy if exists pregao_itens_auth on public.pregao_itens;
create policy pregao_itens_auth on public.pregao_itens
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- pregoes
drop policy if exists pregoes_all on public.pregoes;
drop policy if exists pregoes_auth on public.pregoes;
create policy pregoes_auth on public.pregoes
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- pregao_participantes
drop policy if exists pregao_part_all on public.pregao_participantes;
drop policy if exists pregao_participantes_anon_insert on public.pregao_participantes;
drop policy if exists pregao_participantes_auth on public.pregao_participantes;
create policy pregao_participantes_auth on public.pregao_participantes
  for all to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Remove os grants do papel anon (acesso do fornecedor é via servidor)
revoke all on public.pregao_lances from anon;
revoke all on public.pregao_mensagens from anon;
revoke all on public.pregao_itens from anon;
revoke all on public.pregoes from anon;
revoke all on public.pregao_participantes from anon;