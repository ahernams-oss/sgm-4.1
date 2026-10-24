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

- Blank service-order previews reuse renderOS in blank mode with an in-memory order and revocable PDF blob URLs; they never persist records or consume order numbers.
- Client billing payment submissions use an authenticated server function that verifies the current SGM user's password before persisting the credit date; ordinary unpaid edits retain the existing save path.
- NFS-e tax-code selectors share CodigoTributacaoSelect and its normalized matching helper; filtering changes presentation only and preserves the original tax codes and descriptions.
- NFS-e issuance uses the Brasil NFe fiscal API through a shared payload/response adapter; persist asynchronous lot references and never automatically resend uncertain submissions to avoid duplicate invoices.
- OS classification uses a server-only aggregated historical signature dataset through an authenticated, SGM-permission-checked server function; resolve names against current category/service links and apply only on explicit acceptance to avoid exposing original orders or overwriting manual choices.
- Access-profile modules are grouped by the presentation-only mapping in gruposPermissoes; preserve permission keys and module objects so reorganizing menus never changes existing grants.
- Budget approval validates the OS approval limit and SS approval permission before saving in the shared dialog; a database trigger independently enforces the authenticated active user's stored limit, and rejected writes must not run approval callbacks.
- Service-request monetary search uses matchValorOrcamento against the same first linked budget shown in the grid; this keeps currency formats searchable without treating missing budgets as zero.
- Combined OS calculation-memory PDFs resolve unit prices from that OS's material lists through valoresMemoriaOs, normalizing numeric-only code padding; this keeps individual and batch reports aligned with the order without fetching unrelated prices.
- OS photo and calculation-memory printing refreshes only the selected order's photos and linked SS budgets through dadosImpressaoOs and signs internal storage image URLs with the browser session; this avoids stale grids and preserves private buckets.

- RLS: tabelas e arquivos internos exigem usuário logado (auth.uid() IS NOT NULL); só tabelas das páginas públicas (QR equipamento, proposta fornecedor, portal candidato, verificação de assinatura, pregão) e o bucket pregao-documentos ficam sem login — porque essas páginas leem dados sem sessão.

- Combined PMOC reports reuse renderOS with an explicit identifier and a PMOC-only data adapter, followed by the equipment maintenance sheet; this avoids matching unrelated conventional orders by number.
- Outbound email/WhatsApp server functions only send to recipients registered in the SGM (`_shared/destinatarios.ts`); prevents using the app to message arbitrary addresses.
- Login-free portals (supplier pregão room, legacy candidate link) trust only server-signed tokens (`_shared/token-assinado.ts`), never IDs sent by the browser.
- Cargos de acesso total são protegidos no banco (sgm_cargo_acesso_total + triggers em cargos/usuarios/funcionarios): só o Diretor Geral cria, renomeia ou atribui; o front apenas espelha a lista em src/lib/permissoes.ts, então mude os dois juntos.
