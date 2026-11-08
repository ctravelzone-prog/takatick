#!/bin/bash
# TakaTick start wrapper — PM2 ei file diye app chalabe.
# .env theke variable load kore `node server.js` chalai.
cd "$(dirname "$0")"
set -a
[ -f .env ] && . ./.env
set +a
exec node server.js
