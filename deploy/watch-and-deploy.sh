#!/bin/bash
# TakaTick — auto-deploy watcher (cron proti 2 min-e chalabe).
# GitHub main-e notun commit thakle: pull -> npm ci -> pm2 restart -> health check.
# Data kokhono chuy na (Postgres alada disk-e) — deploy-e account muchbe na.
set -e
APP_DIR="/opt/takatick"
cd "$APP_DIR" || exit 0
git fetch origin main -q || exit 0
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse origin/main)"
[ "$LOCAL" = "$REMOTE" ] && exit 0
echo "[$(date '+%F %T')] notun commit: $LOCAL -> $REMOTE, deploy cholche..."
git pull --ff-only origin main
npm ci --omit=dev
pm2 restart takatick || pm2 start ecosystem.config.js --env production
sleep 3
curl -fsS http://localhost:3000/api/health
echo "[$(date '+%F %T')] deploy sesh: $REMOTE live."
