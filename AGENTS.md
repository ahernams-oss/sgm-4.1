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
- Contract invoice text is an optional string stored in the existing clientes.contratos JSON save path, with an empty fallback for legacy contracts; NFS-e recipient/contract selection copies it through textoContratoNfse into the editable service description, never submits invoices or overwrites description on unrelated rerenders.
- NFS-e tax-code selectors share CodigoTributacaoSelect and its normalized matching helper; filtering changes presentation only and preserves the original tax codes and descriptions.
- NFS-e recipient selection uses TomadorSelect with normalized name/document matching; filtering is presentation-only and selection retains the original client ID.
- NFS-e grid client filters reuse TomadorSelect with an optional all-clients choice; keep invoice filtering by original client ID and reset pagination on selection or clearing.
- NFS-e ISS defaults resolve through issContratoNfse from the selected client's contract; auto-select only a unique contract and normalize decimals to the form's Brazilian parser to avoid stale or inflated rates.
- NFS-e environment selection persists through the existing nfse_config save path, mirrors the emission endpoint's module authorization, and confirms production activation before saving; the issuance payload uses the same saved environment to avoid mismatched display and submission.
- NFS-e recipient and construction municipalities are resolved from their own city/UF against the bundled IBGE-code municipality dataset before creating a draft, without network dependencies; missing matches return recoverable validation results. The adapter rejects absent or zero codes and never substitutes the provider municipality, avoiding invalid or geographically incorrect XML. Keep dataset provenance and license alongside the data.
- NFS-e issuance uses the Brasil NFe fiscal API through a shared payload/response adapter; persist asynchronous lot references and never automatically resend uncertain submissions to avoid duplicate invoices. DPS numbering remains database-generated under a per-company/environment/series advisory lock; cast numeric lock-key components to text before using empty-text fallbacks to prevent draft insertion errors.
- Brasil NFe emission dates and default competence dates use the shared fiscal-day formatter in America/Sao_Paulo and the documented YYYY-MM-DD contract; date-only provider responses are stored at Brazilian midnight and legacy UTC-midnight civil dates are displayed without a day shift, while true authorization timestamps remain unchanged.
- NFS-e numbering starts at the configured per-company/environment/series floor under the existing advisory lock and never falls below the next recorded number; the server resolves the saved series before generating both draft and provider payload.
- Federal NFS-e taxes use documented Brasil NFe ConfiguracaoImposto switches, keeping own-assessment highlight separate from withholding; reject unsupported CST/rates/bases before drafting rather than inventing undocumented payload fields.
- CSLL display uses valorCsllNfse independently of withholding; retencaoIncluiCsll exclusively controls retained totals and submission so a displayed amount never activates an unselected tax.
- NFS-e PDF buttons retrieve the unmodified official Brasil NFe Base64Doc through an authenticated, module-authorized server function and user-scoped read; validate reference, RPS, provider CNPJ, environment and PDF signature, never fall back to local representations or resend invoices. When JSON omits issuer CNPJ, resolve it only from emit in the same response's authorized XML and cross-check fiscal number, DPS and environment. Store the provider lot in servico.brasilNfe.codLote separately from the municipal protocol for subsequent read-only queries.
- OS classification uses a server-only aggregated historical signature dataset through an authenticated, SGM-permission-checked server function; resolve names against current category/service links and apply only on explicit acceptance to avoid exposing original orders or overwriting manual choices.
- Access-profile modules are grouped by the presentation-only mapping in gruposPermissoes; preserve permission keys and module objects so reorganizing menus never changes existing grants.
- Billing submenu rows in access profiles use expandirSubmenusFaturamento as display aliases of existing keys; keep the authorization catalog and sidebar restrictions unchanged to preserve saved grants.
- Shared permission helpers receive the authenticated cargo name and enforce administrative restrictions before total-access bypass; Gerencial keys always require explicit profile grants, mirrored by SQL permission helpers so browser, server actions and database writes agree.
- Budget approval validates the OS approval limit and SS approval permission before saving in the shared dialog; a database trigger independently enforces the authenticated active user's stored limit, and rejected writes must not run approval callbacks.
- Service-request monetary search uses matchValorOrcamento against the same first linked budget shown in the grid; this keeps currency formats searchable without treating missing budgets as zero.
- Combined OS calculation-memory PDFs resolve unit prices from that OS's material lists through valoresMemoriaOs, normalizing numeric-only code padding; this keeps individual and batch reports aligned with the order without fetching unrelated prices.
- OS photo and calculation-memory printing refreshes only the selected order's photos and linked SS budgets through dadosImpressaoOs and signs internal storage image URLs with the browser session; this avoids stale grids and preserves private buckets.

- RLS: tabelas e arquivos internos exigem usuário logado (auth.uid() IS NOT NULL); só tabelas das páginas públicas (QR equipamento, proposta fornecedor, portal candidato, verificação de assinatura, pregão) e o bucket pregao-documentos ficam sem login — porque essas páginas leem dados sem sessão.

- Combined PMOC reports reuse renderOS with an explicit identifier and a PMOC-only data adapter, followed by the equipment maintenance sheet; this avoids matching unrelated conventional orders by number.
- Outbound email/WhatsApp server functions only send to recipients registered in the SGM (`_shared/destinatarios.ts`); prevents using the app to message arbitrary addresses.
- Login-free portals (supplier pregão room, legacy candidate link) trust only server-signed tokens (`_shared/token-assinado.ts`), never IDs sent by the browser.
- Cargos de acesso total são protegidos no banco (sgm_cargo_acesso_total + triggers em cargos/usuarios/funcionarios): só o Diretor Geral cria, renomeia ou atribui; o front apenas espelha a lista em src/lib/permissoes.ts, então mude os dois juntos.
- Purchase-quotation stock transfers are stored as approval requests in estoque_transferencias; stock moves only via transferirEntreLocais after a permitted user approves, and a DB trigger enforces the cotacoes.aprovar_transferencia permission and one-time decision.
- Home-screen installation uses the root head and the existing manifest with local brand icons, without app-shell service workers or offline caches; preserve module-specific manifest overrides and the stable app identity/start URL to avoid breaking installed shortcuts.
