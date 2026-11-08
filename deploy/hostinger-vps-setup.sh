#!/bin/bash
# TakaTick — Hostinger VPS one-time setup (Ubuntu 24.04, Nexora-r moto).
# Eta ekbar chalalei hoy: Node + PM2 + PostgreSQL + Caddy + auto-deploy cron.
#
# Usage (VPS-e root hisebe):
#   git clone https://github.com/ctravelzone-prog/takatick /opt/takatick
#   cd /opt/takatick
#   DOMAIN=takatick.com ./deploy/hostinger-vps-setup.sh
#   DOMAIN na dile (ekhono domain kena hoy ni) Caddy skip hobe —
#   app cholbe http://<VPS-IP>:3000-e, domain kinle pore Caddy bosano jabe.
#
# Ja ja hoy:
#   - Node 24 + PM2 install
#   - PostgreSQL 16 install + `takatick` DB/user (password .env-e, sudhu ekhanei)
#   - .env toiri (ADMIN_EMAIL/PASSWORD, JWT_SECRET, seller numbers, DATABASE_URL)
#   - start.sh diye PM2-te app chalu (port 3000)
#   - DOMAIN thakle Caddy reverse proxy + auto HTTPS
#   - UFW: 22/80/443 khola
#   - cron: proti 2 min deploy/watch-and-deploy.sh — GitHub main-e notun
#     commit aslei auto pull + restart + health check (Nexora-r moto auto)
#
# Data: Postgres VPS-er disk-e thake — deploy/restart-e account kokhono
# muchbe na (Render free tier-er moto noy). Keystore VPS-e LAGE NA —
# APK amar/Siam-er machine-e build hoye repo-te commit hoy, deploy-e
# dashboard theke auto serve hoy.
set -e
APP_DIR="/opt/takatick"
cd "$APP_DIR"

echo "== 1. system packages =="
apt-get update -qq
apt-get install -y -qq curl git ufw postgresql > /dev/null

echo "== 2. Node 24 + PM2 =="
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash - > /dev/null
  apt-get install -y -qq nodejs > /dev/null
fi
npm install -g pm2 > /dev/null 2>&1 || true
node --version

echo "== 3. PostgreSQL: DB + user =="
DB_PASS="$(openssl rand -hex 16)"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='takatick'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE ROLE takatick LOGIN PASSWORD '$DB_PASS'"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='takatick'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE takatick OWNER takatick"

echo "== 4. .env (na thaklei toiri hobe) =="
if [ ! -f .env ]; then
  ADMIN_PASS="$(openssl rand -hex 8)"
  JWT_SECRET="$(openssl rand -hex 32)"
  cat > .env <<EOF
NODE_ENV=production
PORT=3000
BRAND_NAME=TakaTick
ADMIN_EMAIL=admin@takatick.local
ADMIN_PASSWORD=$ADMIN_PASS
JWT_SECRET=$JWT_SECRET
DATABASE_URL=postgres://takatick:$DB_PASS@localhost:5432/takatick
SELLER_BKASH_NUMBER=01883042132
SELLER_NAGAD_NUMBER=01883042132
SELLER_UPAY_NUMBER=01883042132
EOF
  chmod 600 .env
  echo "!! ADMIN LOGIN (ekbar-i dekhabe — jotno kore rekhe dao):"
  echo "   email:    admin@takatick.local"
  echo "   password: $ADMIN_PASS"
else
  echo ".env agei ache — kichu bodlano hoy ni."
fi

echo "== 5. app install + PM2 start =="
npm ci --omit=dev
pm2 start ecosystem.config.js --env production || pm2 restart takatick
pm2 save
pm2 startup systemd -u root --hp /root > /dev/null 2>&1 || true

echo "== 6. Caddy (DOMAIN dile tobei) =="
if [ -n "${DOMAIN:-}" ]; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https > /dev/null
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list > /dev/null
  apt-get update -qq && apt-get install -y -qq caddy > /dev/null
  cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  reverse_proxy localhost:3000
}
EOF
  systemctl reload caddy
  echo "Site: https://$DOMAIN"
else
  echo "DOMAIN deoa hoy ni — Caddy skip. App: http://$(hostname -I | awk '{print $1}'):3000"
fi

echo "== 7. firewall + auto-deploy cron =="
ufw allow 22/tcp > /dev/null 2>&1 || true
ufw allow 80/tcp > /dev/null 2>&1 || true
ufw allow 443/tcp > /dev/null 2>&1 || true
ufw --force enable > /dev/null 2>&1 || true
( crontab -l 2>/dev/null | grep -v watch-and-deploy; echo "*/2 * * * * $APP_DIR/deploy/watch-and-deploy.sh >> /var/log/takatick-deploy.log 2>&1" ) | crontab -

echo "== 8. health check =="
sleep 3
curl -s http://localhost:3000/api/health || echo "health check ekhono asche na — pm2 logs takatick dekho"
echo
echo "DONE. Erpor theke GitHub main-e push dile 2 min-er moddhe VPS-e auto live hobe."
