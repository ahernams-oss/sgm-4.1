#!/usr/bin/env bash
# Prepara uma VPS Ubuntu 22.04/24.04 recém-instalada para rodar o SGM em Docker,
# recebendo deploys automáticos do GitHub Actions.
#
# Uso (como root, na VPS):
#   curl -fsSL https://raw.githubusercontent.com/ahernams-oss/sgm-4.1/main/deploy/vps-setup.sh -o vps-setup.sh
#   sudo bash vps-setup.sh "ssh-ed25519 AAAA...chave-publica-do-deploy..." [dominio]
#
# Sem domínio, o site sobe em https://<ip-com-hifens>.sslip.io (DNS público que resolve para o
# próprio IP), com certificado Let's Encrypt. Acesso só por http://IP não serve: o navegador bloqueia
# crypto.randomUUID, crypto.subtle, câmera e área de transferência fora de HTTPS, e o SGM usa todos.
#
# O que faz (pode rodar mais de uma vez):
#   1. instala Docker (com o plugin compose) e ferramentas básicas
#   2. cria o usuário "deploy" (sem senha, sem sudo, no grupo docker) e autoriza a chave
#   3. cria /opt/sgm com docker-compose.yml, Caddyfile e um .env para você preencher
#   4. limita logs (journald e docker) e cria 1 GB de swap se não houver
#   5. abre só SSH, 80 e 443 no firewall (ufw)
# Não instala Node, bun, painel nem banco: o build acontece no GitHub e o Supabase é o da nuvem.
set -euo pipefail

PUBKEY="${1:?Uso: sudo bash vps-setup.sh \"<chave publica do deploy>\" [dominio]}"
DOMAIN="${2:-}"
DEPLOY_USER="deploy"
APP_DIR="/opt/sgm"
RAW="https://raw.githubusercontent.com/ahernams-oss/sgm-4.1/main/deploy"

[ "$(id -u)" -eq 0 ] || { echo "Rode como root: sudo bash $0 ..."; exit 1; }
case "$PUBKEY" in ssh-ed25519\ *|ssh-rsa\ *|ecdsa-sha2-*) ;; *) echo "A chave pública deve começar com ssh-ed25519 ou ssh-rsa"; exit 1;; esac

export DEBIAN_FRONTEND=noninteractive
echo ">> Pacotes básicos"
apt-get update -qq
apt-get install -y -qq ca-certificates curl ufw >/dev/null

echo ">> Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh >/dev/null
fi
systemctl enable --now docker >/dev/null 2>&1 || true
docker compose version >/dev/null 2>&1 || { echo "docker compose (plugin) não encontrado"; exit 1; }

echo ">> Logs enxutos"
mkdir -p /etc/docker
if [ ! -f /etc/docker/daemon.json ]; then
  cat > /etc/docker/daemon.json <<'JSON'
{ "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
JSON
  systemctl restart docker
fi
mkdir -p /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' > /etc/systemd/journald.conf.d/sgm.conf
systemctl restart systemd-journald || true

echo ">> Swap (1 GB, só se não existir)"
if ! swapon --show | grep -q .; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo ">> Usuário $DEPLOY_USER"
id -u "$DEPLOY_USER" >/dev/null 2>&1 || adduser --disabled-password --gecos "" "$DEPLOY_USER"
usermod -aG docker "$DEPLOY_USER"
install -d -m 700 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "/home/$DEPLOY_USER/.ssh"
AUTH="/home/$DEPLOY_USER/.ssh/authorized_keys"
touch "$AUTH"
LINE="no-port-forwarding,no-agent-forwarding,no-X11-forwarding $PUBKEY"
grep -qF -- "$PUBKEY" "$AUTH" || echo "$LINE" >> "$AUTH"
chmod 600 "$AUTH"; chown "$DEPLOY_USER:$DEPLOY_USER" "$AUTH"

PUBLIC_IP=$(curl -4 -fsS --max-time 5 https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
if [ -z "$DOMAIN" ]; then
  DOMAIN="$(echo "$PUBLIC_IP" | tr . -).sslip.io"
fi

echo ">> Pasta $APP_DIR"
install -d -m 755 -o "$DEPLOY_USER" -g "$DEPLOY_USER" "$APP_DIR"
for f in docker-compose.yml Caddyfile; do
  [ -f "$APP_DIR/$f" ] || curl -fsSL "$RAW/$f" -o "$APP_DIR/$f"
done
if [ ! -f "$APP_DIR/.env" ]; then
  curl -fsSL "$RAW/env.example" -o "$APP_DIR/.env"
  sed -i "s|^SITE_ADDRESS=.*|SITE_ADDRESS=$DOMAIN|; s|^APP_ORIGIN=.*|APP_ORIGIN=https://$DOMAIN|; s|^APP_BASE_URL=.*|APP_BASE_URL=https://$DOMAIN|" "$APP_DIR/.env"
  # URL e chave publishable do Supabase são públicas e já estão no .env do repositório.
  REPO_ENV=$(curl -fsSL "https://raw.githubusercontent.com/ahernams-oss/sgm-4.1/main/.env" 2>/dev/null || true)
  for k in URL PUBLISHABLE_KEY; do
    v=$(grep "^VITE_SUPABASE_$k=" <<<"$REPO_ENV" | head -1 | cut -d= -f2- | tr -d '"\r' || true)
    if [ -n "$v" ]; then sed -i "s|^SUPABASE_$k=.*|SUPABASE_$k=$v|" "$APP_DIR/.env"; fi
  done
fi
chown -R "$DEPLOY_USER:$DEPLOY_USER" "$APP_DIR"
chmod 600 "$APP_DIR/.env"

echo ">> Firewall"
SSH_PORT=$(grep -Ei '^\s*Port\s+' /etc/ssh/sshd_config 2>/dev/null | awk '{print $2}' | head -1)
ufw allow "${SSH_PORT:-22}/tcp" >/dev/null
ufw allow 80/tcp >/dev/null
ufw allow 443/tcp >/dev/null
ufw allow 443/udp >/dev/null
ufw --force enable >/dev/null

cat <<MSG

Pronto. Endereço do site: https://$DOMAIN (sobe no primeiro deploy do GitHub Actions)
Próximos passos:
  1. Edite $APP_DIR/.env e preencha SUPABASE_SERVICE_ROLE_KEY e os tokens das integrações:
       nano $APP_DIR/.env
     (SITE_ADDRESS, APP_ORIGIN, SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY já vieram preenchidos.)
  2. Secrets no GitHub (Settings > Secrets and variables > Actions):
       VPS_HOST=$PUBLIC_IP   VPS_USER=$DEPLOY_USER   VPS_SSH_KEY=<chave PRIVADA do par>
       SITE_URL=https://$DOMAIN
     (VPS_PORT só se o SSH não estiver na 22: hoje está na ${SSH_PORT:-22}.)
  3. Actions > "Build da imagem e deploy" > Run workflow. Depois disso cada push na main publica sozinho.
MSG
