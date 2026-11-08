# TakaTick v2.0 — plan deactivation fix + merchant dashboard redesign + enroll on its own page + 3 new logo options

Siam-er 3-ta kotha ek sathe: (1) admin theke plan deactivate korle user-er dashboard-e
kichui hoto na, (2) user dashboard dekhte baje — modern, unique, minimal, aro sundor
chai, (3) pricing + enroll wizard ek page-e na — enroll alada page-e khulbe. Logo-o
change korte boleche — 3-ta notun option banano hoyeche, Siam jeta pochondo korbe
setai site-er logo hobe (ekhono replace kora hoyni).

## 1. Plan deactivation fix (asol bug)

Admin theke plan deactivate korle backend thik-i kaj korto — verify/confirm + pay page
403 `ACCOUNT_DEACTIVATED` dito — kintu merchant dashboard-e shudhu 2-ta choto line
("Account deactivated") dekhato, ar merchant-er write endpoint gulo khola chilo:
deactivated merchant number add/delete, website add/delete, settings save, API key
regenerate — sob korte parto. Tai Siam-er chokhe "kichui hoy nai" lagto.

**Server (`server.js`):** notun helper `blockIfPlanOff(merchant, res)` — status
`deactivated` hole 403 `ACCOUNT_DEACTIVATED` — diye 8-ta write route gate kora:
`POST /api/me/api-key/regenerate`, `POST /api/me/numbers`, `DELETE /api/me/numbers/:id`,
`DELETE /api/me/numbers`, `POST /api/me/websites`, `DELETE /api/me/websites/:domain`,
`DELETE /api/me/websites`, `POST /api/me/settings`. Ichha kore gate kora hoyni:
`POST /api/me/orders` (renewal khola thake — approval-e reactivate hoy) + sob read
endpoint (merchant nijer data dekhte parbe).

**Merchant dashboard (`public/dashboard.html`):** deactivated hole ekhon boro kore
dekha jay — lal-tinted box, "⛔ Plan deactivated" heading, kon plan + "verification and
payments are stopped... Contact the admin to reactivate your plan" lekha; profile card-e
"— Plan deactivated" lal span; sob form input/select/button + Regenerate button +
number Delete button disabled thake. Reactivate korle sob abar chalu hoy.

**Admin (`public/admin.html`):** merchant detail header-e ekhon "Plan: X · Plan status:
[pill] · State: [pill]" dekha jay; status control-er label "Plan status:" ar button
"Apply plan status" (value gulo ager motoi: active/pending/deactivated).

## 2. Merchant dashboard redesign (modern, unique, minimal)

- Landing-er design system-ei dashboard: deep navy + teal, Space Grotesk, sticky
  translucent header (logo + "Merchant dashboard" + Website/Log out), halka
  background, sada rounded card (soft shadow).
- Uporer dike **4-ta stat card**: Package (naam + ৳/mo ba "Plan deactivated"),
  Expires (tarikh + koto din baki ba "Deactivated"), Verifications (used / limit,
  this month), Payment numbers (koyta + method list).
- Button, input, table — sob teal accent, rounded, minimal. Sob id + JS logic
  ager motoi ache — shudhu look bodleche.

## 3. Enroll alada page-e (`public/enroll.html`)

- Pricing-er "Choose" click korle ekhon `/enroll.html?plan=<id>` khole — wizard
  ar landing-er niche boshe na. `?plan=` ba `?package=` — duitai chole, default basic.
- Enroll page: header (logo + "← Back to website" + Log in / Pricing), wizard
  ager motoi 3 step (Create account → Choose your plan → Pay by bKash) + pending
  step. Logged-in merchant signup skip kore Step 2-te jay; pricing age load hoy,
  tarpor step dekha jay (ager race nei).
- Landing (`public/index.html`): enroll section + wizard JS puropuri sorano;
  `choosePackage(id)` ekhon sudhu `/enroll.html?plan=...`-e pathay. Purono
  `/#enroll` bookmark `/enroll.html`-e redirect hoy.
- `server.js`: brand-injection middleware-e `/enroll.html` jog — `{{BRAND}}` +
  `{{SELLER_BKASH}}` (01740707570) enroll page-eo replace hoy.
- Login page-er signup redirect (`/#pricing`) ager motoi ache.

## 4. Logo — 3-ta notun option (Siam-er pochondo baki)

`~/workspace/your_files/takatick-logo-options/`:
- **A** — teal rounded-square + sada tick, "Taka" navy + "Tick" teal (minimal).
- **B** — teal coin-e ৳ + tick, "TakaTick" navy rounded (Bangladeshi, friendly).
- **C** — gradient tick-arrow + speed line, "Taka" navy + "Tick" teal (dynamic).
Siam jeta bolbe seta `public/images/logo.png` (ar favicon dorkar hole) replace kora hobe.

## Test

- **`npm test` — 51 test, 51 pass, 0 fail** (48 + 2 notun deactivation test + 1
  notun enroll-separate-page test). Purono wizard test gulo enroll-page-e sorano
  hoyeche (v1.6 wizard test, v1.7 signup-plan test, v1.8 optimistic-chip test,
  v1.9 plan-choose test, landing seller-number test).
- Notun test: (i) plan deactivated hole number/website/settings/key write sob
  403 `ACCOUNT_DEACTIVATED`, reactivate korle abar 201; (ii) dashboard-e "Plan
  deactivated" state + disabled-actions markup; (iii) landing-e wizard nei,
  Choose `/enroll.html?plan=`-e jay, enroll page-e seller number ache.
