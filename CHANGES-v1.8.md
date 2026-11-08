# TakaTick v1.8 — master admin panel + logo + hero + home redesign

Siam-er feedback (8 Nov ~10:21–10:22 AM): ager admin panel "kono admin panel holo" na — multifunctional master admin chai (sob control alada: user koto jon, kon package koto jon); kono logo chilo na; hero section-e kono picture chilo na; home page generic lagchilo. Eitar sathe v1.5 live verification-er ekta bug-o dhukeche: signup-er por header-e profile chip reload na korle ashto na.

## Ki notun (v1.8)

### A. Logo + favicon
- `public/images/logo.png` — teal checkmark (navy rounded square) + "TakaTick" wordmark, navy/teal. Header-e bosano (landing, login, dashboard, admin).
- `public/favicon.png` — tick mark only (64×64 PNG). Sob page-e `<link rel="icon">`.
- Logo-r text generation-e thik eseche ("TakaTick" banan thik, check korechi).

### B. Hero picture + two-column hero
- `public/images/hero.png` — flat illustration: phone-e payment SMS → arrow → boro teal checkmark "confirmed", dashboard card + coin, teal/navy, text-free (garbled text nei).
- Hero ekhon desktop-e two-column (headline + CTA bame, hero image dane), mobile-e stacked.

### C. Home page redesign (unique look)
- Deep navy + teal palette, Space Grotesk display font (Google Fonts, system-ui fallback), sticky translucent header (blur), dark navy hero + soft teal glow, hover-lift feature card, Premium card navy highlight, numbered how-it-works, styled FAQ, dark navy footer.
- **Functional id + JS logic untouched** — enroll wizard flow exactly ager moto (Choose plan → Step 1 account → Step 2 plan → Step 3 bKash payment). Shudhu ekta choto JS change: pricing template-e `/mo`-er inline color `#666` → `opacity:.65` (navy Premium card-eo readable hoy).

### D. Master admin panel (`public/admin.html` + server.js)
Sidebar + 6 section:
- **Dashboard (overview):** stat card — total merchants, active, pending approval, expired, deactivated, pending orders, verifications this month, approved revenue this month (৳). Merchants per package table (live count + price + limits) + expiry-state breakdown (active/grace/expired/expiring-soon/no-expiry).
- **Merchants:** search (name/email) + package filter + status filter; row-e click korle detail panel — profile, package + expiry + state, numbers, websites, verifications this month, orders (approve/reject soho), package change + status change action. NEW `GET /api/admin/merchants/:id` (read-only).
- **Orders:** ager moto list + approve/reject, pending first.
- **Packages:** 3 package-er live merchant count + limits; edit form (name, price, numbers, websites, verifications/mo, methods, webhook/WooCommerce/priority toggles) — NEW `POST /api/admin/packages/:id`: validate kore `config/packages.json` lekhe + in-memory config reload kore — **restart chara live apply hoy** (test-e verify kora). Grace days editor-o ekhane (soba package-e apply hoy).
- **Transactions:** NEW `GET /api/admin/transactions` — latest 100 SMS transaction + verification, merchant email soho, newest first.
- **Settings:** read-only — seller bKash number, grace days, brand, packages (env/config theke change korte hoy, panel theke noy).
- Sob notun route `adminAuth` diye protected; merchant token-e 403 (test-e verify kora). Admin login flow ager motoi (ADMIN_EMAIL/ADMIN_PASSWORD env).

### E. Optimistic profile chip (v1.5 live bug fix)
- Signup-er por age header-e "Log in / Sign up" dekhacchilo jotokkhon `/api/me/profile` fetch na ashe — chip sudhu reload-er por ashto.
- Ekhon `setProfileChip(name, packageName, stateLabel)` function — signup success-er sathe sathe signup data theke (naam + chosen plan + "Waiting for approval") chip boshe jay, API fetch-er jonno wait kore na. Porer page load-e `updateNav()` ager moto API diye validate kore (eki function use kore).

## Test
- `npm test`: **47/47 pass** (v1.7-er 40 + 7 notun v1.8 test):
  - logo + hero + favicon file exist + sob page reference kore
  - optimistic chip (`setProfileChip` + signup call + "Waiting for approval")
  - extended stats (per-package 2/1/2, per-status 4/1/0, revenue ৳3000, verifications 3 — test DB-er deterministic state)
  - merchant detail endpoint (404 + merchant 403)
  - transactions endpoint (SMS + verification, merchant email soho; merchant 403)
  - package editing live (650 → pricing-e 650, invalid 400, unknown 404, merchant 403, tarpor 600-e restore)
  - admin.html-e 6 section (Dashboard/Merchants/Orders/Packages/Transactions/Settings)
- Local E2E smoke: test suite-er moddhei full merchant flow (signup → pending → order → approve → verify) + landing curl check (200, logo + hero reference).

## Note
- `config/packages.json` ekhon pretty-printed (2-space) — package-edit endpoint JSON.stringify(..., 2) diye lekhe; value same, sudhu formatting change.
- Feature image gulo ager motoi (`public/images/feature-*.png`).
- Deploy: Render-e manual deploy (auto-deploy OFF) — Render dashboard → takatick service → Manual Deploy → Deploy latest commit.
