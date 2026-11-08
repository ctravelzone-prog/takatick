# TakaTick — Hostinger auto-deploy (Nexora-r moto)

**Ek kothay:** Hostinger VPS kinle, ekbar setup script chalalei hoy। Erpor
GitHub `main`-e push dile **2 min-er moddhe VPS-e auto live** — kono manual
deploy, kono zip upload, kono extra pain nei। Nexora VPS-e jemon chole,
ekhaneo thik temon।

## 1. Hosting — VPS lagbe, shared hosting-e cholbe na

- **Hostinger KVM VPS** (Nexora-r moto KVM 1-i jothesto)।
- Shared hosting-e (hPanel) persistent Node.js + PM2 chole na — tai
  TakaTick okhane auto cholbe na। VPS-i nite hobe।
- OS: **Ubuntu 24.04**।

## 2. Ekbar-er setup (VPS-e root hisebe, 10 min)

```bash
git clone https://github.com/ctravelzone-prog/takatick /opt/takatick
cd /opt/takatick
chmod +x deploy/*.sh start.sh
DOMAIN=takatick.com ./deploy/hostinger-vps-setup.sh
```

`DOMAIN` na dile (domain ekhono kena hoy ni) Caddy skip hobe — app cholbe
`http://<VPS-IP>:3000`-e। Domain kinle pore Caddy bosano jabe।

Script-ta ja ja kore:
1. Node 24 + PM2 install
2. PostgreSQL 16 install + `takatick` DB/user (password sudhu `.env`-e)
3. `.env` toiri — admin login + JWT secret + seller numbers + `DATABASE_URL`
   (`.env` na thaklei toiri hoy; thakle kichu bodlay na)
4. `npm ci` + PM2-te app chalu (port 3000) + reboot-e auto-start
5. `DOMAIN` thakle Caddy reverse proxy + auto HTTPS
6. UFW: 22/80/443
7. cron: proti 2 min `deploy/watch-and-deploy.sh`

**Admin login setup-er seshe ekbar dekhabe** — jotno kore rekhe dao
(pore `sudo cat /opt/takatick/.env` diyeo dekha jay)।

## 3. Erpor update kivabe auto hobe

1. Ami (ba Siam) code/APK bodle GitHub `main`-e push kori।
2. VPS-er cron proti 2 min-e GitHub check kore — notun commit thakle
   auto `pull` → `npm ci` → `pm2 restart` → health check।
3. Live — kichu korte hoy na।

**APK update:** notun APK build hoye repo-te commit hoy
(`android-app/TakaTickSMS-vX.Y.apk`) — deploy-er por dashboard theke
notun version-i download hobe। **Keystore VPS-e kokhono jay na** —
APK build hoy amar/Siam-er machine-e, keystore sudhu okhanei thake।

## 4. Data — deploy-e kokhono muchbe na

- Data thake VPS-er disk-er PostgreSQL-e — Render free tier-er moto
  deploy/restart-e muche jay na।
- Neon-er dorkar nei (Neon lagto Render-er jonno; VPS-e nijer Postgres-i
  ache)।
- Backup (optional, weekly): `pg_dump takatick > backup.sql`
  — cron-e bosiye nilei hoy।

## 5. Jodi kichu na chole

- `pm2 logs takatick` — app-er log
- `pm2 status` — app cholche kina
- `tail /var/log/takatick-deploy.log` — auto-deploy-er log
- `curl localhost:3000/api/health` — `{"ok":true}` aslei app thik
- `cat /opt/takatick/.env` — env/admin login (root-i dekhte pare)
