# TakaTick — v1.3 changes (2026-11-08)

## Notun — Storefront: landing page + enroll/buy + admin panel

### Landing page = TakaTick-er website (`/`)
- Root `/` ekhon **puro landing page** (age `/login.html`-e redirect hoto): hero ("bKash, Nagad, Rocket & Upay payments — verified automatically"), features (6 ta: 4 MFS SMS app, verify+confirm API, hosted pay page, HMAC webhook, WooCommerce plugin, per-merchant API keys), how-it-works 3 steps, pricing cards, enroll flow, FAQ, footer.
- **Kono banano testimonial/stats/customer count nei** — sudhu asol facilities.
- Nav-e Login / Sign up link; `/pricing.html` → `/#pricing`-e redirect hoy.
- Footer-e Siam-er bKash number **nei** (sudhu product info + link) — number-ta shudhu enroll-er pay instructions-e dekhay.

### Enroll / buy flow
- Landing theke package choose → signup (naam/email/password) → **bKash Send Money 01740707570** (SELLER_BKASH_NUMBER env; na dile ei number-tai fallback default) → TrxID + sender number submit → order `pending` → "admin approve korle package active hobe".
- Dashboard-e **"Upgrade / Renew package"** button — logged-in merchant-der jonno eki pay + TrxID flow.
- Order-er TrxID duplicate hole `409 DUPLICATE_TRXID`; amount package price-er sathe exact na mille `400 AMOUNT_MISMATCH`.

### Admin panel (`/admin.html` + `/api/admin/*`)
- Admin account **env theke seed** hoy first boot-e: `ADMIN_EMAIL` / `ADMIN_PASSWORD` (bcrypt hash DB-te). Env na dile admin login `503 ADMIN_NOT_CONFIGURED`.
- Features: sob merchant-er list (package, status, expiry date, expiry state, usage), order list (pending age) + approve/reject, merchant-er package manually bodlano, deactivate/activate kora.
- **Approve → package + expiry = approval time + 30 din** (fresh, ager expiry-er sathe jog hoy na — new buy, renew, upgrade, grace-er moddhe renew — sob khetrei eki). **Reject → merchant-er purono package-i thake.**
- Deactivated merchant-er verify/confirm `403 ACCOUNT_DEACTIVATED`.

### Package expiry + 3 din grace
- `merchants.package_expires_at` (nullable) + `status` column; `orders` + `admins` table notun.
- **NULL = no expiry (grandfathered)** — v1.3-er age toiri account gulo chirokal cholbe. Notun signup-e 30 din-er window (signup theke); prothom approved order-e clock-ta approval + 30 din-e reset hoy.
- Grace: `graceDays: 3` — `config/packages.json`-e bodlano jay, route logic-e hardcode nei. Expiry-er por 3 din verify/confirm + pay page normal cholbe; dashboard-e **"Grace period — X din baki, renew koro"** banner + Renew button; admin list-e "grace" state + baki din.
- Grace sesh hole hard block: verify/confirm `403 PACKAGE_EXPIRED`, pay page-e expired notice, claim neoa hoy na. **Expired hole API keys/data delete hoy na** — renewal eki key reuse kore.
- Dashboard-e package + expiry date boro kore dekhay (Active / Grace / Expired — Renew koro banner).

### Downloads (dashboard)
- TakaTick SMS app APK v1.0: `/download/app.apk` (android-app-er APK-tai serve kore).
- WooCommerce plugin zip: `/downloads/takatick-woocommerce-plugin.zip` (2 PHP file, syntax `php -l` pass).

## Test
- **`npm test` — 36/36 pass** (22 ager + 14 notun storefront test): landing page, pricing API, order create (wrong amount / duplicate TrxID), approve (package + fresh 30-day expiry) / reject, expired verify 403 + pay page block, grace (1 din past expiry verify OK, 4 din past 403), deactivate/reactivate, admin merchants list expiry state, grace-er moddhe renewal-e approval + 30d (not stacked), admin login wrong password 401 + merchant token admin route-e 403 + no-admin 503.
- **Local E2E smoke (fresh temp DB) — 18/18 pass:** landing → pricing → signup → order → duplicate TrxID block → admin approve → profile expiry ~30d → SMS ingest → verify → confirm → APK + plugin zip download → admin/dashboard page load.

## Ekhono baki (ager motoi)
- **Render manual deploy baki** — auto-deploy OFF, tai notun code live korte Render dashboard → takatick service → Manual Deploy korte hobe. Deploy-er somoy env set korte hobe: `SELLER_BKASH_NUMBER=01740707570`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (Siam-er admin password — chat-e pathaben na, Render dashboard-e bosaben).
- Asol SMS wording check (Rocket/Upay), WooCommerce plugin live WordPress test, asol phone-e APK test, asol taka diye end-to-end test.
- **Stated policy (Siam chaile bodlate parbe):** approve howar age order cancel kora jay (admin ke janate hobe); approve hoye package active hole monthly fee refund nei.

## Note
- `public/downloads/takatick-woocommerce-plugin.zip` plugin source theke ekbar generate kora — plugin file bodle gele abar generate korte hobe.
- `*.keystore` ekhon `.gitignore`-e — debug keystore kokhono commit hobe na.
