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
