# Deploy automático do SGM 4.1: GitHub → VPS

A cada `git push` na branch `main` (ou commit feito pela Lovable, que também cai na `main`), o site na VPS é atualizado sozinho em 3 a 5 minutos.

## Como funciona

```
push na main ──► GitHub Actions builda a imagem Docker ──► publica no GHCR ──► SSH na VPS: docker compose pull && up -d
```

- **O build acontece no GitHub**, não na VPS. A VPS não precisa de Node, bun, painel nem RAM para compilar. Só roda dois contêineres: o app (Node) e o Caddy (HTTPS automático).
- **O app é TanStack Start com servidor Nitro.** Não é uma SPA estática: a rota `/api/public/edge/$name` executa no servidor as 60 funções que antes eram edge functions do Supabase. Por isso precisa de um contêiner Node, e por isso o `Dockerfile` builda com `NITRO_PRESET=node-server` (fora do sandbox da Lovable a config respeita essa variável; dentro dela é ignorada, então os builds da Lovable seguem iguais).
- **O Supabase continua no Supabase Cloud.** Nada de banco na VPS.
- **Servidor de produção:** `136.0.53.217` (Ubuntu 24.04). Enquanto não houver domínio próprio, o endereço é **https://136-0-53-217.sslip.io** (o sslip.io resolve esse nome para o próprio IP, e o Caddy emite certificado Let's Encrypt para ele).
- **Precisa de HTTPS desde o primeiro dia.** Fora de HTTPS o navegador bloqueia `crypto.randomUUID` (34 arquivos), `crypto.subtle` (hash das assinaturas), câmera e área de transferência. Por `http://IP` uploads, assinaturas e vários cadastros quebram.

Arquivos envolvidos:

| Arquivo | Papel |
|---|---|
| `Dockerfile` | bun instala e builda; imagem final `node:24-alpine` só com `.output/` |
| `.dockerignore` | mantém a imagem e o contexto enxutos |
| `.github/workflows/deploy.yml` | build da imagem, push no GHCR, deploy por SSH |
| `deploy/docker-compose.yml` | app + Caddy, limites de memória e de log |
| `deploy/Caddyfile` | proxy reverso, HTTPS automático, cache dos assets |
| `deploy/env.example` | modelo do `/opt/sgm/.env` da VPS (variáveis de runtime) |
| `deploy/vps-setup.sh` | prepara a VPS recém-instalada em um comando |
| `deploy/pg_cron_jobs.sql` | agenda as rotinas no pg_cron do Supabase apontando para a VPS |
| `package.json` | ganhou o script `start` (`node .output/server/index.mjs`) |

Validado em 28/09/2026: build local com `NITRO_PRESET=node-server` gerou `.output/` de 40 MB; o servidor respondeu `/` com o título do SGM, fallback de rotas da SPA, `/api/public/edge/...` com JSON e assets com `Cache-Control` de 1 ano.

---

## Passo a passo (VPS recém-instalada, Ubuntu 22.04/24.04)

### 1. Chave SSH exclusiva para o deploy (no seu PC, Git Bash)

```bash
ssh-keygen -t ed25519 -C "github-actions-sgm" -f ~/.ssh/sgm_deploy -N ""
```

Gera `~/.ssh/sgm_deploy` (privada, vai para o GitHub Secrets) e `~/.ssh/sgm_deploy.pub` (pública, vai para a VPS).

```bash
cat ~/.ssh/sgm_deploy.pub
```

### 2. Preparar a VPS (uma vez, como root)

```bash
ssh root@IP-DA-VPS 'curl -fsSL https://raw.githubusercontent.com/ahernams-oss/sgm-4.1/main/deploy/vps-setup.sh -o vps-setup.sh && bash vps-setup.sh "COLE-AQUI-A-CHAVE-PUBLICA" sgm.seudominio.com.br'
```

O último argumento (domínio) é opcional: sem ele o script usa `<ip-com-hifens>.sslip.io`. Também já preenche no `.env` da VPS o `SITE_ADDRESS`, o `APP_ORIGIN`/`APP_BASE_URL` e a URL e a chave publishable do Supabase (públicas, tiradas do `.env` do repositório). O script instala Docker, cria o usuário `deploy` (sem senha, sem sudo, no grupo docker), cria `/opt/sgm` com `docker-compose.yml`, `Caddyfile` e `.env`, limita logs, cria 1 GB de swap e libera só SSH, 80 e 443 no firewall.

### 3. Variáveis de runtime na VPS

Edite `/opt/sgm/.env` (modelo em `deploy/env.example`):

| Variável | O que é |
|---|---|
| `SITE_ADDRESS` | domínio do site para HTTPS automático, ou `<ip-com-hifens>.sslip.io` sem domínio próprio |
| `SUPABASE_URL` | URL do projeto no Supabase Cloud |
| `SUPABASE_PUBLISHABLE_KEY` | chave publishable/anon |
| `SUPABASE_SERVICE_ROLE_KEY` | chave service role (só no servidor, nunca no repositório) |
| `APP_ORIGIN`, `APP_BASE_URL` | URL pública do sistema, usada em links de e-mail e redirecionamentos |
| `PLUGSEND_TOKEN`, `BRASILNFE_TOKEN` | integrações WhatsApp (uazapi) e NF-e |
| `PORTAL_JWT_SECRET`, `NFE_WEBHOOK_SECRET` | assinatura dos JWTs do portal e do webhook de NF-e |
| `CRON_SECRET` | segredo que o pg_cron do Supabase manda no cabeçalho `x-cron-secret` ao chamar as rotinas diárias (ver "Rotinas agendadas") |
| `GEMINI_API_KEY` | chave do Google Gemini (IA: Duda, leitura de editais, propostas, holerites e datas de documentos, Base de Conhecimento). Passo 8 |
| `GEMINI_MODEL_RAPIDO`, `GEMINI_MODEL_AVANCADO` | opcionais: trocam os modelos sem mexer no código (vazios = `gemini-3.5-flash-lite` e `gemini-3.8-flash`) |
| `RESEND_API_KEY`, `EMAIL_FROM` | envio dos e-mails transacionais pelo Resend e remetente (`"Nome <endereco@dominio-verificado>"`, com aspas). Passo 8 |
| `RESEND_WEBHOOK_SECRET` | opcional: segredo do webhook do Resend que registra bounces e reclamações de spam |
| `SEND_EMAIL_HOOK_SECRET` | opcional: só se o hook "Send Email" do Supabase Auth for ativado |

As variáveis `VITE_*` do navegador **não** entram aqui: elas são embutidas no bundle durante o build a partir do `.env` do repositório.

### 4. Secrets no GitHub

Repositório → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Valor |
|---|---|
| `VPS_HOST` | IP da VPS |
| `VPS_USER` | `deploy` |
| `VPS_PORT` | só se a porta SSH não for 22 |
| `VPS_PATH` | só se não for `/opt/sgm` |
| `VPS_SSH_KEY` | conteúdo **completo** de `~/.ssh/sgm_deploy` (de `-----BEGIN` até `-----END`) |
| `SITE_URL` | URL pública, para o teste final (opcional) |

### 5. Imagem no GHCR

O workflow publica em `ghcr.io/ahernams-oss/sgm-4.1`. A cada deploy ele faz login no GHCR **dentro da VPS** com o token temporário da própria execução (enviado pelo stdin) e faz logout no fim. Por isso a imagem pode continuar privada e não fica credencial guardada no servidor. Se precisar puxar à mão na VPS fora do Actions, use um token clássico com escopo `read:packages`.

### 6. Primeiro deploy

Faça um push na `main` ou rode em Actions → "Build da imagem e deploy" → Run workflow. O log mostra o build, o push e a saída de `docker compose ps` na VPS. Depois disso é automático.

### 7. Trocar para domínio próprio

Aponte o DNS do domínio para o IP da VPS, troque `SITE_ADDRESS`, `APP_ORIGIN` e `APP_BASE_URL` no `/opt/sgm/.env`, atualize o secret `SITE_URL` e rode na VPS:

```bash
cd /opt/sgm && docker compose up -d --force-recreate caddy
```

O Caddy emite o certificado sozinho.

### 8. IA e e-mails (Gemini e Resend)

A IA e os e-mails usavam serviços da Lovable que só funcionam dentro da hospedagem dela. O servidor agora fala direto com o **Google Gemini** (IA) e com o **Resend** (e-mails). Cada um precisa de uma conta e de uma chave no `/opt/sgm/.env`. O código fica em [src/lib/edge/ai.ts](src/lib/edge/ai.ts) e [src/lib/email/resend.ts](src/lib/email/resend.ts); os templates de e-mail (React Email) são os mesmos de antes.

**8.1 Chave do Gemini (Google AI Studio)**

1. Entre em https://aistudio.google.com/apikey com a conta Google da empresa.
2. Clique em **Create API key** (crie ou escolha um projeto) e copie a chave (começa com `AIza`).
3. Recomendado: ative o faturamento desse projeto (**Set up billing** na mesma tela). No nível gratuito o Google pode usar o conteúdo enviado para melhorar os produtos dele, e o SGM envia holerites (CPF, salários), propostas e editais. No nível pago isso não acontece e os limites de uso são maiores.

**8.2 Conta e domínio no Resend**

1. Crie a conta em https://resend.com.
2. **Domains → Add Domain**: use um subdomínio só para os e-mails do sistema, por exemplo `mail.lasant.com.br`, região **São Paulo (sa-east-1)**. O `notify.lasant.com.br` antigo está delegado para o DNS da Lovable; para reaproveitá-lo seria preciso remover essa delegação antes.
3. O Resend mostra os registros DNS (MX e TXT de SPF em `send.mail`, TXT de DKIM em `resend._domainkey.mail`, DMARC opcional). Cadastre exatamente esses registros no painel onde o DNS de `lasant.com.br` é administrado e clique em **Verify DNS Records**. Pode levar de minutos a algumas horas até aparecer **Verified**.
4. **API Keys → Create API Key**, permissão **Sending access**. Copie a chave (começa com `re_` e só aparece uma vez).

**8.3 Colocar as chaves na VPS**

```bash
ssh root@136.0.53.217
```

```bash
cd /opt/sgm && nano .env
```

No editor, apague as linhas `LOVABLE_API_KEY=` e `LOVABLE_SEND_URL=` (se existirem) e cole no fim, com os seus valores:

```
GEMINI_API_KEY=AIza...
RESEND_API_KEY=re_...
EMAIL_FROM="SGM Lasant <noreply@mail.lasant.com.br>"
```

Salve com `Ctrl+O` e `Enter`, saia com `Ctrl+X` e recrie o app:

```bash
docker compose up -d --force-recreate app
```

**8.4 Testar**

E-mail (troque `SEU-EMAIL` pelo seu endereço):

```bash
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/public/edge/send-email-cotacao',{method:'POST',headers:{'Content-Type':'application/json',apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},body:JSON.stringify({to:'SEU-EMAIL',subject:'Teste SGM',htmlBody:'<p>Teste de envio pelo Resend</p>'})}).then(r=>r.text()).then(console.log)"
```

Tem que responder `{"success":true,"id":"..."}` e o e-mail chegar. O envio também aparece em Resend → Emails.

IA e Base de Conhecimento: o comando abaixo regera os embeddings (vetores da busca) de todos os artigos e FAQs, inclusive os salvos enquanto a IA estava parada, que ficaram sem vetor:

```bash
docker compose exec app node -e "fetch('http://127.0.0.1:3000/api/public/edge/kb-embedding',{method:'POST',headers:{'Content-Type':'application/json',apikey:process.env.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY},body:JSON.stringify({reindexar:true})}).then(r=>r.text()).then(console.log)"
```

Resposta esperada: `{"artigos":N,"faqs":N,"falhas":0}`. Depois, no sistema, abra a Duda e pergunte, por exemplo, "quantas OS estão abertas?".

**8.5 Opcional: bounces e spam (webhook do Resend)**

Resend → Webhooks → **Add Webhook**: URL `https://136-0-53-217.sslip.io/api/public/edge/handle-email-events`, eventos `email.bounced` e `email.complained`. Copie o **Signing secret** (`whsec_...`) para `RESEND_WEBHOOK_SECRET=` no `/opt/sgm/.env` e recrie o app. Os endereços que voltarem ou marcarem spam passam a ser gravados em `suppressed_emails`; o próprio Resend deixa de enviar para eles.

**8.6 Opcional: e-mails do Supabase Auth**

As telas do SGM não disparam e-mails do Supabase Auth (a senha temporária sai pelo próprio sistema). Se algum dia usar convite, link mágico ou recuperação de senha do Supabase: Supabase → Authentication → Hooks → **Send Email** → HTTPS, URL `https://136-0-53-217.sslip.io/api/public/edge/auth-email-hook`, gere o segredo e copie o valor (`v1,whsec_...`) para `SEND_EMAIL_HOOK_SECRET=` no `/opt/sgm/.env`.

Ao trocar para domínio próprio (passo 7), atualize também as URLs dos itens 8.5 e 8.6.

---

## Operação do dia a dia

```bash
ssh deploy@IP-DA-VPS 'cd /opt/sgm && docker compose ps && docker compose logs --tail=50 app'
```

- **Voltar para a versão anterior:** em `/opt/sgm/docker-compose.yml`, troque `:latest` pela tag `:<sha do commit>` que aparece no log do Actions e rode `docker compose up -d`.
- **Mudou `.env` na VPS:** `docker compose up -d --force-recreate app`.
- **Consumo esperado:** app ~200 a 400 MB de RAM (limite de 1 GB no compose), Caddy ~30 MB, imagem ~250 MB em disco. Logs limitados a 30 MB por contêiner.

## Problemas comuns

| Sintoma | Causa provável | Correção |
|---|---|---|
| `denied` ou `unauthorized` no `docker compose pull` | pacote do GHCR sem acesso pelo repositório | Packages → `sgm-4.1` → Package settings → Manage Actions access: incluir o repositório `sgm-4.1` |
| Caddy não emite o certificado | portas 80/443 bloqueadas no firewall do provedor, ou DNS não aponta para a VPS | liberar 80 e 443 no painel do provedor; `docker compose logs caddy` |
| `Permission denied (publickey)` no passo de SSH | chave pública não está no `authorized_keys` do `deploy`, ou `VPS_SSH_KEY` incompleto | refaça o passo 2, confira o secret com BEGIN/END |
| `Falta /opt/sgm/.env na VPS` | passo 3 não feito | copie `deploy/env.example` para `/opt/sgm/.env` |
| build falha em `bun install --frozen-lockfile` | `bun.lock` desatualizado em relação ao `package.json` | rode `bun install` localmente e comite o `bun.lock` |
| `.output/server/index.mjs não foi gerado` | o preset Node não foi aplicado | confira se `ENV NITRO_PRESET=node-server` continua no `Dockerfile` |
| site abre mas e-mails não saem; log com `RESEND_API_KEY não configurada` ou `EMAIL_FROM não configurado` | variáveis do passo 8 vazias, ou app não recriado | preencher no `/opt/sgm/.env` e `docker compose up -d --force-recreate app` |
| e-mail falha com `domain is not verified` | o domínio do `EMAIL_FROM` não está verificado no Resend | Resend → Domains: conferir os registros DNS e clicar em Verify |
| IA responde `GEMINI_API_KEY não configurada` ou `Chave da IA (GEMINI_API_KEY) inválida` | chave vazia, errada ou apagada no AI Studio | gerar outra no AI Studio (passo 8.1) e recriar o app |
| upload, assinatura ou novo item dá erro de `randomUUID`/`subtle` | site acessado por `http://` | usar o endereço `https://` (`SITE_ADDRESS` com domínio ou sslip.io) |
| 502 no Caddy logo após o deploy | app ainda subindo | aguarde 20 s; `docker compose logs app` |
| rotinas agendadas com `status_code` 503 em `net._http_response` | `CRON_SECRET` vazio no `/opt/sgm/.env`, ou app não recriado | "Rotinas agendadas", passo 1 |
| rotinas agendadas com `status_code` 401 | segredo do Vault diferente do `CRON_SECRET` da VPS | rode de novo o bloco 2 do `pg_cron_jobs.sql` com o valor do `.env` |
| tela logada dá "Não autorizado" ao chamar uma função | sessão do Supabase expirada ou ausente | sair e entrar de novo; se persistir, procure `[edge:auth]` em `docker compose logs app` (falha ao falar com o Auth do Supabase) |

## Quem pode chamar as funções da ponte

As funções em `src/lib/edge/fns` usam a service role e quase nenhuma confere quem chamou, então a ponte `/api/public/edge/<nome>` é a barreira de acesso. As regras ficam em [src/lib/edge/auth.ts](src/lib/edge/auth.ts):

| Nível | Exige | Funções |
|---|---|---|
| público | nada (a própria função confere assinatura ou token) | `auth-email-hook`, `handle-email-events`, `nfe-webhook`, `preview-transactional-email` |
| chave publishable | cabeçalho `apikey` com a chave publishable (o front sempre manda) | `auth-login`, `fornecedor-login`, `fornecedor-trocar-senha`, `epi-recebimento-publico`, `epi-devolucao-publico`, `portal-api` |
| rotina agendada | cabeçalho `x-cron-secret` igual ao `CRON_SECRET` do servidor | as 9 rotinas da seção abaixo |
| usuário logado (todas as outras) | JWT do Supabase com assinatura conferida (`auth.getClaims`), ou a service role (servidor para servidor) | o resto |

Uma função nova que precise ser chamada sem login entra em um dos conjuntos de `auth.ts`; sem isso ela exige usuário logado.

## Rotinas agendadas (pg_cron)

Nove rotinas só rodam se alguém as chamar: vencimento de parcelas, férias, cotação de EPIs, EPIs, NRs, exames, experiência, calibração e entrega atrasada. Antes, três delas eram disparadas pelo pg_cron do projeto Supabase antigo. O script [deploy/pg_cron_jobs.sql](deploy/pg_cron_jobs.sql) remove esses jobs antigos e cria todos apontando para `https://136-0-53-217.sslip.io`, com o cabeçalho `x-cron-secret`. A ponte recusa essas rotinas sem o segredo (401) e responde 503 enquanto o `CRON_SECRET` estiver vazio no servidor.

Faça nesta ordem, uma vez:

**1. Gerar o `CRON_SECRET` na VPS.** No seu PC (Git Bash ou PowerShell):

```bash
ssh root@136.0.53.217
```

Já dentro da VPS, cole linha por linha:

```bash
cd /opt/sgm
```

```bash
grep -q '^CRON_SECRET=.' .env || { sed -i '/^CRON_SECRET=/d' .env; printf '\nCRON_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env; }
```

(Só cria o segredo se ainda não existir; rodar de novo não troca o valor.)

```bash
docker compose up -d --force-recreate app
```

```bash
grep '^CRON_SECRET=' .env
```

Copie o valor depois do `=` (64 caracteres). Ele vai para o SQL do passo 3.

**2. Conferir a ponte.** Ainda na VPS:

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://136-0-53-217.sslip.io/api/public/edge/check-parcelas-vencimento
```

Tem que responder `401` (sem o segredo, recusado). `503` = o `CRON_SECRET` não foi lido: confira o `.env` e repita o `docker compose up -d --force-recreate app`. Esse teste não dispara a rotina.

**3. Agendar no Supabase.** Abra o SQL Editor do projeto `mbasypzxvvufavraofif`, cole o conteúdo de [deploy/pg_cron_jobs.sql](deploy/pg_cron_jobs.sql), troque `COLE_AQUI_O_CRON_SECRET` pelo valor copiado no passo 1 e rode. O segredo fica guardado no Vault do Supabase; o resultado final lista os 9 jobs `sgm-*` ativos.

**4. No dia seguinte**, rode as duas consultas comentadas no fim do SQL: as respostas da VPS devem ter `status_code` 200.

Para trocar o segredo: apague a linha `CRON_SECRET=` do `/opt/sgm/.env`, repita o passo 1 e rode no Supabase só o bloco 2 do SQL com o valor novo.

## Alternativa: painel na VPS (Coolify, Dokploy, Easypanel)

Se preferir um painel, ele consegue buildar direto deste repositório usando o `Dockerfile` (tipo de build "Dockerfile", branch `main`, porta 3000, variáveis do passo 3 como variáveis de runtime, "Auto Deploy" ligado). Nesse caso o build roda na VPS e consome RAM; o workflow do Actions pode continuar publicando a imagem e chamando o webhook do painel (secret `DEPLOY_WEBHOOK_URL`) no lugar do SSH.

## Cuidados com a Lovable

- Não reescrever histórico (`force push`, rebase/amend de commits já publicados): a Lovable perde o histórico do projeto.
- Commits na `main` sincronizam de volta para a Lovable; mantenha a branch sempre buildável.
