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
- EPI catalog classification and unit fields are mapped through EpisCatalogoContext alongside the existing fields, preserving legacy records with empty-string fallbacks.
- EPI classification selectors derive options from saved catalog entries and current-form additions; subgroups follow the selected group, and new names persist with the EPI through the existing save path.
- EPI catalog group/subgroup filters are presentation-only and reuse filtrarEpisPorClassificacao (accent/case-insensitive, empty filter means "all"); choosing a group resets the subgroup choice and the list page, and never changes stored classification.
- EPI catalog column headers are sortable buttons driven by ordenarEpis (accent/case-insensitive text, numeric validade, blank values always last); sorting is presentation-only, resets to the first page and never changes stored records.
- I0 dashboard aggregates all loaded I0 rows by catalog table type, month and year through resumirI0; unmatched or ambiguous codes remain unidentified so totals are preserved without inventing table associations.
- Client billing payment submissions use an authenticated server function that verifies the current SGM user's password before persisting the credit date; ordinary unpaid edits retain the existing save path.
- NFS-e tax-code selectors share CodigoTributacaoSelect and its normalized matching helper; filtering changes presentation only and preserves the original tax codes and descriptions.
- NFS-e recipient selection uses TomadorSelect with normalized name/document matching; filtering is presentation-only and selection retains the original client ID.
- NFS-e recipient and construction municipalities are resolved from their own city/UF against the bundled IBGE-code municipality dataset before creating a draft, without network dependencies; missing matches return recoverable validation results. The adapter rejects absent or zero codes and never substitutes the provider municipality, avoiding invalid or geographically incorrect XML. Keep dataset provenance and license alongside the data.
- NFS-e issuance uses the Brasil NFe fiscal API through a shared payload/response adapter; persist asynchronous lot references and never automatically resend uncertain submissions to avoid duplicate invoices. DPS numbering remains database-generated under a per-company/environment/series advisory lock; cast numeric lock-key components to text before using empty-text fallbacks to prevent draft insertion errors.
- Brasil NFe emission dates and default competence dates use the shared fiscal-day formatter in America/Sao_Paulo and the documented YYYY-MM-DD contract, preventing UTC rollover from producing future DPS dates; explicit competence and returned authorization timestamps remain unchanged.
- NFS-e local PDF representations reuse a browser-side generator for issued/cancelled records, derive fiscal numbers only from authorized XML rather than DPS numbering, and explicitly distinguish themselves from official DANFSe; exporting never sends or persists an invoice.
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
