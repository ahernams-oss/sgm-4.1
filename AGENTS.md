<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- RLS: tabelas e arquivos internos exigem usuário logado (auth.uid() IS NOT NULL); só tabelas das páginas públicas (QR equipamento, proposta fornecedor, portal candidato, verificação de assinatura, pregão) e o bucket pregao-documentos ficam sem login — porque essas páginas leem dados sem sessão.

- Combined PMOC reports reuse renderOS with an explicit identifier and a PMOC-only data adapter, followed by the equipment maintenance sheet; this avoids matching unrelated conventional orders by number.
- Outbound email/WhatsApp server functions only send to recipients registered in the SGM (`_shared/destinatarios.ts`); prevents using the app to message arbitrary addresses.
- Login-free portals (supplier pregão room, legacy candidate link) trust only server-signed tokens (`_shared/token-assinado.ts`), never IDs sent by the browser.
- Cargos de acesso total são protegidos no banco (sgm_cargo_acesso_total + triggers em cargos/usuarios/funcionarios): só o Diretor Geral cria, renomeia ou atribui; o front apenas espelha a lista em src/lib/permissoes.ts, então mude os dois juntos.
