# TakaTick — Payment Verification MVP

> ZiniPay-er moto payment-automation service: customer apnar nijer personal number-e (bKash, Nagad, Rocket ba Upay) pay korbe, ar ei system SMS pore TrxID + amount verify korbe. **Taka kokhono ei system diye jay na** — shudhu verification.

## Kar jonno

Bangladesh-er choto/majhari website owner, jara bKash, Nagad, Rocket ba Upay-te payment nen kintu prottek order-er TrxID haate check korte chan na. Customer pay korbe apnar number-e, system auto verify korbe, apnar website confirm kore order deliver korbe.

## Kivabe kaj kore (sangkhepe)

1. Customer apnar hosted payment page (`/pay/:payKey`) theke apnar number-e (bKash, Nagad, Rocket ba Upay) pay kore, TrxID dey.
2. Apnar phone-e payment SMS (bKash, Nagad, Rocket, Upay) ashe → Android app SMS ta server-e pathay (`POST /api/sms`).
3. Apnar website `POST /api/v1/verify` diye check kore: TrxID ache? Amount exact mile? Age use hoyni?
4. `POST /api/v1/confirm` korle TrxID permanently used hoye jay, webhook jay, order paid hoy.

Puro integration guide: **[INTEGRATION.md](./INTEGRATION.md)** — website owner-ra oitai porbe.

## Website (landing page) + selling

The root `/` is the TakaTick website: hero, features, how-it-works, pricing, FAQ and the enroll flow. A buyer picks a package, signs up, pays the monthly fee by bKash **Send Money to 01740707570** (SELLER_BKASH_NUMBER env, same number as the fallback default), submits the TrxID + sender number, and the order sits pending until the admin approves it. New signups are **pending** — verify/confirm and the hosted pay page return `403 PACKAGE_NOT_ACTIVE` until approval, and the dashboard shows a 'Waiting for approval' banner with the pending order. On approval the package activates for **30 days** (fresh from approval, never stacked).

**Renewal + grace:** after the 30 days, the package gets a **3-day grace period** (`graceDays` in `config/packages.json`, changeable) — verify/confirm and the hosted pay page keep working, the dashboard shows a "Grace period — X din baki, renew koro" banner. After grace ends, verify/confirm return `403 PACKAGE_EXPIRED` and the pay page shows an expired notice. Renewal (new order → approve) sets a fresh 30 days from approval and reuses the same API keys — nothing is deleted on expiry. The dashboard shows the package, expiry date and grace/renew state prominently, with a Renew button.

**Admin panel:** `/admin.html` + `/api/admin/*`. Admin account is created from `ADMIN_EMAIL` / `ADMIN_PASSWORD` env on first boot; if unset, admin login answers `ADMIN_NOT_CONFIGURED`. The panel lists merchants (package, status, expiry date, expiry state: pending / active / expiring-soon / grace / expired / no-expiry, usage) and orders (pending first) with approve/reject; it can also change a merchant's package manually (activates with a fresh 30 days) and deactivate/activate a merchant (deactivated → verify/confirm `403 ACCOUNT_DEACTIVATED`).

**Downloads (dashboard):** TakaTick SMS app APK (`/download/app.apk`, v1.0) and the WooCommerce plugin zip (`/downloads/takatick-woocommerce-plugin.zip`).

## Project tree

```
payment-method-mvp/
├── README.md            # ei file — owner-er jonno overview
├── INTEGRATION.md       # website owner-der integration guide
├── TEST_REPORT.md       # test result (36/36 pass)
├── CHANGES-v1.3.md      # v1.3 changelog (storefront + admin + landing)
├── .env.example         # env variable-er sample (BRAND_NAME=TakaTick)
├── package.json         # Node.js project, dependencies
├── server.js            # Express app entry — auth, me, sms, verify, pay, orders, admin
├── config/
│   └── packages.json    # brand + tier limits (Basic/Standard/Premium) + graceDays
├── src/
│   ├── db.js            # SQLite setup + orders/admins tables
│   ├── smsParser.js     # bKash/Nagad/Rocket/Upay SMS parser
│   ├── webhook.js       # HMAC-signed webhook sender
│   └── limits.js        # tier limit checks + grace days
├── public/
│   ├── index.html       # landing page (website: hero, features, pricing, FAQ, enroll)
│   ├── login.html       # login page (brand config theke ase)
│   ├── dashboard.html   # merchant dashboard (package banner, downloads, orders)
│   ├── admin.html       # admin panel (merchants, orders, approve/reject)
│   └── downloads/
│       └── takatick-woocommerce-plugin.zip  # WooCommerce plugin, ready to upload
├── android-app/         # SMS forward kora Android app (Java, APK v1.5 built)
│   ├── TakaTickSMS-v1.5.apk
│   └── build-apk.sh     # manual APK build (aapt2 + d8, no Gradle download)
├── woocommerce-plugin/  # WooCommerce gateway source (2 PHP file)
└── test/
    ├── parser.test.js   # SMS parser unit tests
    ├── api.test.js      # end-to-end API tests (live server + webhook catcher)
    ├── storefront.test.js # landing, orders, admin, expiry + grace tests
    └── fixtures/
        └── sms-samples.json  # 10 ta sample SMS
```

## Local-e run kora

```bash
npm install
cp .env.example .env
npm start
```

Tarpor browser-e dashboard khulun (default `http://localhost:3000` — `PORT` env diye bodlano jay).

**Env variables (`.env`):**

| Variable | Kaj |
|---|---|
| `PORT` | Server kon port-e cholbe (default 3000) |
| `JWT_SECRET` | Login JWT sign korar secret — strong random value dite hobe |
| `BRAND_NAME` | Brand naam — default `TakaTick` (Siam-er decide kora brand; ek jayga theke bodlano jay) |
| `DB_PATH` | SQLite database file-er path |
| `SELLER_BKASH_NUMBER` | Buyer-ra je bKash number-e Send Money korbe — Siam-er number `01740707570` (public, landing page-e dekhano hoy; env-e na dile ei number-tai fallback) |
| `ADMIN_EMAIL` | Admin panel login email — first boot-e admin account banay |
| `ADMIN_PASSWORD` | Admin panel login password — strong password dite hobe; na dile admin login bondho thakbe (`ADMIN_NOT_CONFIGURED`) |

## Packages

| Package | Price | Number | Website | Verification/month | Methods | Webhook |
|---|---|---|---|---|---|---|
| Basic | ৳300/month | 1 | 1 | 500 | bKash + Nagad | Na |
| Standard | ৳600/month | 3 | 3 | 2,000 | bKash + Nagad | Ha |
| Premium | ৳900/month | Unlimited | Unlimited | Unlimited | All 4 — bKash, Nagad, Rocket, Upay | Ha (+ WooCommerce plugin, priority support) |

Limit gulo `config/packages.json`-e thake — code change charai bodlano jay. **Price kokhono doc-e ba code-e nijer moto bodlaben na** — package change hole Siam-er sathe confirm kore tarpor update korun.

## End-to-end curl test

> Server local-e cholche dhore (`http://localhost:3000`). Age signup kore key gulo save korun.

```bash
BASE=http://localhost:3000

# 1. Signup — merchant + apiKey + appKey + payKey + webhookSecret ekbar-i dekhabe, save korun
curl -X POST $BASE/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Merchant","email":"test@example.com","password":"secret123","package":"standard"}'

# 2. Login — JWT paben (7 din valid)
curl -X POST $BASE/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"secret123"}'

# 3. Sample SMS pathan (Android app-er bodle curl diye) — TrxID + amount parse hobe
curl -X POST $BASE/api/sms \
  -H "Content-Type: application/json" \
  -H "x-app-key: YOUR_APP_KEY" \
  -d '{"sender":"bKash","text":"You have received Tk 500.00 from 01XXXXXXXXX. TrxID 9HX7K2M4P1 at 08:30 08/11/2026","receivedAt":"2026-11-08T08:30:00.000Z"}'

# 4. Verify — ok:true + id asha korun
curl -X POST $BASE/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"YOUR_API_KEY","amount":500,"transactionId":"9HX7K2M4P1"}'

# 5. Confirm — ok:true + full data + webhook asha korun
curl -X POST $BASE/api/v1/confirm \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"YOUR_API_KEY","amount":500,"transactionId":"9HX7K2M4P1","id":12}'

# 6. Abar verify — ALREADY_USED asha korun (duplicate block-er proman)
curl -X POST $BASE/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"YOUR_API_KEY","amount":500,"transactionId":"9HX7K2M4P1"}'

# 7. Bhul amount — AMOUNT_MISMATCH asha korun
curl -X POST $BASE/api/v1/verify \
  -H "Content-Type: application/json" \
  -d '{"apiKey":"YOUR_API_KEY","amount":501,"transactionId":"9HX7K2M4P1"}'
```

> ⚠️ Step 3-er SMS text ta **sample format**. Asol SMS-er wording (4 method-er je kono ta) diye parse kora ekhono check kora hoyni.

## Configuration

- **Packages:** `config/packages.json` — tier limits (number/website count, monthly verification limit, webhook on/off) + `graceDays` (expiry-er por koto din verify cholbe — ekhon 3). Ekhane bodlale dashboard + verify limit — duitai bodle jabe.
- **Brand:** `TakaTick` — `BRAND_NAME` env (default `TakaTick`) ba `config/packages.json` theke ase; dashboard/pay page-e config theke inject hoy. Ek jayga theke bodlano jay — page-er moddhe brand naam hardcode kora hoy na.

## Security notes

- **Sob key env-e, code-e kokhono na** — `JWT_SECRET`, API key, `appKey`, `webhookSecret` kokhono git-e ba code-e hardcode kora jabe na. Signup-er somoy key gulo **ekbar-i** dekhano hoy.
- **Webhook HMAC** — prottek webhook-e `X-Signature` header thake (raw body-r HMAC-SHA256, key = merchant-er `webhookSecret`). Merchant-der signature verify korte bolte hobe — INTEGRATION.md Section 6 dekhun.
- **Duplicate TrxID block** — ek TrxID ekbar confirm hole ar kokhono verify hobe na. Eta payment fraud-er main protection.
- **Exact-amount rule** — 1 taka kom/beshi holeo `AMOUNT_MISMATCH`. Amount kokhono "kacha-kachi" hisebe neoa jabe na.
- **API key server-side-e rakhte hobe** — browser JavaScript-e ba public repo-te API key gele je keu verify/confirm call korte parbe.
- **SMS ingest auth** — `/api/sms` shudhu valid `x-app-key` header thakle accept kore. Key chara keu fake SMS inject korte parbe na.

## Ki test kora hoyeche

**`npm test` — 73 test, 73 pass, 0 fail** (Node v24.22.1). Puro result: [TEST_REPORT.md](./TEST_REPORT.md). v1.3-e notun: landing page, order create (wrong amount / duplicate TrxID), admin approve (package + fresh 30-day expiry) / reject, expired merchant `403 PACKAGE_EXPIRED` + pay page block, grace (1 day past expiry verify OK, 4 days past 403), deactivated merchant `403 ACCOUNT_DEACTIVATED`, admin merchants list expiry state, renewal during grace resets expiry to approval + 30d, admin login wrong password 401 + merchant token admin route-e 403 + no-admin 503. v1.5-e notun: signup pending (verify `403 PACKAGE_NOT_ACTIVE` + pay page blocked until admin approves, dashboard 'Waiting for approval' banner, reject keeps pending), admin manual package change activates with fresh 30 days, landing logged-in profile chip (avatar + name + package/state, click → dashboard) + login auto-redirect. v1.6-e notun: enroll step wizard (hidden until a plan is chosen → signup → plan select → payment). v1.7-e notun: standard signup (account creation-e kono plan/price field nei — login page + landing signup step, duitai). v1.8-e notun: logo + hero + favicon (landing/login/dashboard/admin — file exist + reference), optimistic profile chip (`setProfileChip` signup data theke), master admin — extended stats (per-package/per-status counts, revenue this month, verifications this month), merchant detail endpoint (404 + merchant 403), transactions endpoint (SMS + verifications, merchant 403), package editing live (validate + restore, merchant 403), admin.html-e 6 section. v1.9-e notun: Step 2 plan-choose 3-card picker (Premium featured navy + Most Popular ribbon, Selected badge, method chips, hidden radio `name="plan"`). v2.0-e notun: plan deactivation fix (deactivated merchant-er sob write 403 `ACCOUNT_DEACTIVATED` + dashboard-e boro 'Plan deactivated' state + form disabled), merchant dashboard redesign (stat cards: package/expiry/verifications/numbers, navy+teal, Space Grotesk, sticky header), enroll alada page-e (`/enroll.html?plan=`, wizard ar landing-e nei). v2.1-e notun: FINAL logo (wallet + asol bold ৳) site-e — `logo.png` + `favicon.png` (wallet icon crop), kono code change nei. v2.2-e notun: key sudhu purchase-er pore — signup-e kono key nei (pending `pending_` placeholder), admin approve/manual-activate-e key issue hoy (`keysIssued`), key endpoint + APK/plugin download active merchant chara 403, dashboard-e pending-der 🔒 Locked box, notun `GET /api/me/api-key` (Show API key). v2.2.1-e notun: dashboard-er prothom paint-e ar download link/key button-er jholok nei — static HTML-ei lukano, `load()` key thakle tobei dekhay. v2.2.2-e notun: webhook secret-o dashboard-er Keys card-e (masked + Show button, approve-er age 403). v2.3-e notun: login ar signup alada page — header/hero Sign up /signup.html-e jay, login page-e sudhu login. v2.4-e notun: signup-e phone number (required) + admin dashboard-e Phone column (tel: link soho). v2.5-e notun: meyad sesh howar 1 din age dashboard-e reminder + expired hole boro lal box (ki ki bondho) ar form/server — sob freeze, renewal khola. v2.6-e notun: kichu na kinle dashboard-e 'No package yet' — order-er plan-i waiting hisebe dekhay. v2.6.1-e enroll page-er header chip-eo eki niyom. v2.7-e notun: admin merchant-er expiry date sorasori bosate parbe (demo/correction-er jonno, otit-er date-o chole). v2.7.1-e notun: SMS app-er release-signed APK v1.1 (Play Protect block komate) + dashboard-e install note. v2.7.2-e notun: APK v1.2 — READ_SMS permission sorano (app inbox pore na, sudhu broadcast theke SMS ney), sudhu RECEIVE_SMS — Play Protect block aro komate. v2.7.3-e notun: APK v1.3 — SMS permission restricted hole button ar chup thake na, App info khule 'Allow restricted settings' ON korar poth dekhay. v2.8-e notun (revised): APK v1.4 — RECEIVE_SMS full-auto (consent v2.0 bad), POST 3 bar retry + body-r bhasha diye payment SMS chena (received + Tk + amount + TrxID ba MFS naam) + inbox safety net (READ_SMS — app khulle miss kora payment SMS inbox theke khuje pathay); ar dashboard-e SMS paste koreo verify kora jay (app chara). Local E2E smoke (fresh DB): signup → order → admin approve → verify → confirm — 18/18 pass; v1.5 pending-flow smoke: 12/12 pass. v2.8.1-e notun: dashboard-e APK v1.5 serve kore — foreground service + proti 2s inbox scan + BACKGROUND CHALU RAKHO button (battery exemption); live phone test PASS (Tk 10 DK848M3KEM 11:59 PM-e background-e eseche, app na khulei). v2.9-e notun: auto-approve (dogfooding) — storefront order payment SMS aslei nije theke approve hoy (TrxID + exact amount match, global; SMS 'used' hoy; order age toiri hole ingest-e, SMS age asle order create-e, paste-eo — 3 jaygatei matcher; prothom order-e ekhono manual admin approval lage, oi approval-ei app key ase); enroll-e auto-approved hole success dekhay (pending noy); buyer copy plain language-ei — enroll-e 'Admin'/'SMS'/mechanism-er kono ullekh nei, order error-e raw API code-er bodle generic friendly Banglish (FRIENDLY_ERRORS map) — API code bodlay ni। Landing page-eo mechanism lukano — hero/How-it-works/FAQ-te 'forwarded SMS', 'TrxID + exact amount', 'manual approval', 'Admin approves' ar nei; 'Who approves my package' FAQ ekhon plain language-e, stale 'manual' dabio nei।

Ja pass koreche: signup/login + JWT, tier limit (Basic-e Rocket/Upay number 403, Premium-e allowed), bKash + Rocket full flow (ingest → verify → confirm → webhook HMAC), Upay pay-page claim, duplicate confirm `ALREADY_USED`, bhul amount `AMOUNT_MISMATCH`, unknown TrxID `TRANSACTION_NOT_FOUND`, duplicate SMS `duplicate:true`, 422 `UNPARSEABLE`, 401 bad app key, parser 10 fixture + 4 edge case (4 method-i, case-insensitive sender).

**Code theke ja verify kora geche:** `config/packages.json`-er tier limits (Basic ৳300/1/1/500/no-webhook/bKash+Nagad, Standard ৳600/3/3/2000/webhook/bKash+Nagad, Premium ৳900/unlimited/webhook/all-4 + WooCommerce + priority support); `src/smsParser.js` 4 method-er SMS theke `Tk X.XX` amount + `TrxID` parse kore; amount DB-te integer poisha hisebe store hoy; `src/webhook.js` HMAC-SHA256 hex signature (`X-Signature`) dey, 5s timeout, **ekbar-i try kore, kono retry nei**; `src/db.js`-e TrxID `UNIQUE` (duplicate block) ar `sms_transactions.status` (`received`/`used`) ache.

## Ki test kora HOYNI (ekhono baki)

- ❌ Asol SMS asol phone-e — 4 method-er kono tar asol SMS wording diye parser check kora hoyni (Rocket/Upay sender ID + wording bisesh kore re-check korte hobe).
- ✅ Android app asol phone-e PASS — APK v1.5 (foreground service + 2s scan): Tk 10 DK848M3KEM 11:59 PM-e background-e eseche, app na khulei; v1.4-er broadcast-miss + inbox-scan-sudhu-app-khulle samasya fix.
- ❌ Production deploy — v1.3 code GitHub-e push kora hoyeche, kintu Render-e manual deploy kora hoyni (auto-deploy OFF).
- ❌ Asol payment — asol taka diye end-to-end payment test kora hoyni.
- ❌ WooCommerce plugin — plugin-er PHP syntax OK (`php -l` pass), kintu WordPress + WooCommerce-e live test kora hoyni.
