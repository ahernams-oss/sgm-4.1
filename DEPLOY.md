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
| `LOVABLE_API_KEY`, `LOVABLE_SEND_URL` | gateway de IA e e-mail da Lovable. O valor não é obtível fora da Lovable; serão substituídos por `GEMINI_API_KEY` e `RESEND_API_KEY` |

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
| site abre mas e-mails não saem | `LOVABLE_API_KEY`/`LOVABLE_SEND_URL` vazios | preencher no `.env` da VPS ou trocar o envio por SMTP/Resend |
| upload, assinatura ou novo item dá erro de `randomUUID`/`subtle` | site acessado por `http://` | usar o endereço `https://` (`SITE_ADDRESS` com domínio ou sslip.io) |
| 502 no Caddy logo após o deploy | app ainda subindo | aguarde 20 s; `docker compose logs app` |

## Rotinas agendadas (pg_cron)

Nove rotinas só rodam se alguém as chamar: vencimento de parcelas, férias, EPIs, NRs, exames, experiência, calibração e entrega atrasada. Antes, três delas eram disparadas pelo pg_cron do projeto Supabase antigo. O script [deploy/pg_cron_jobs.sql](deploy/pg_cron_jobs.sql) remove esses jobs antigos e cria todos apontando para a VPS. Rode no SQL Editor do projeto atual depois do primeiro deploy, trocando o domínio e a chave publishable no início do bloco 2.

Atenção: a ponte `/api/public/edge/<nome>` aceita a chave publishable (e qualquer token no formato JWT) para essas rotinas, e duas delas não exigem credencial nenhuma. Em um servidor público isso permite que terceiros disparem avisos de WhatsApp. A correção prevista é um cabeçalho `x-cron-secret` conferido pela ponte, a ser feito junto com a troca de IA/e-mail.

## Alternativa: painel na VPS (Coolify, Dokploy, Easypanel)

Se preferir um painel, ele consegue buildar direto deste repositório usando o `Dockerfile` (tipo de build "Dockerfile", branch `main`, porta 3000, variáveis do passo 3 como variáveis de runtime, "Auto Deploy" ligado). Nesse caso o build roda na VPS e consome RAM; o workflow do Actions pode continuar publicando a imagem e chamando o webhook do painel (secret `DEPLOY_WEBHOOK_URL`) no lugar do SSH.

## Cuidados com a Lovable

- Não reescrever histórico (`force push`, rebase/amend de commits já publicados): a Lovable perde o histórico do projeto.
- Commits na `main` sincronizam de volta para a Lovable; mantenha a branch sempre buildável.
