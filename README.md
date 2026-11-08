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

## Project tree

```
payment-method-mvp/
├── README.md            # ei file — owner-er jonno overview
├── INTEGRATION.md       # website owner-der integration guide
├── TEST_REPORT.md       # test result (22/22 pass)
├── .env.example         # env variable-er sample (BRAND_NAME=TakaTick)
├── package.json         # Node.js project, dependencies
├── server.js            # Express app entry — auth, me, sms, verify, pay
├── config/
│   └── packages.json    # brand + tier limits (Basic/Standard/Premium)
├── src/
│   ├── db.js            # SQLite setup
│   ├── smsParser.js     # bKash/Nagad/Rocket/Upay SMS parser
│   ├── webhook.js       # HMAC-signed webhook sender
│   └── limits.js        # tier limit checks
├── public/
│   ├── login.html       # login page (brand config theke ase)
│   └── dashboard.html   # merchant dashboard
└── test/
    ├── parser.test.js   # SMS parser unit tests
    ├── api.test.js      # end-to-end API tests (live server + webhook catcher)
    └── fixtures/
        └── sms-samples.json  # 10 ta sample SMS
```

> ⚠️ `android-app/` (SMS forward kora Android app) ei project-e **nei** — app ta banano hoyni. Backend + docs complete; Android app chara SMS server-e pathanor upay ekhon curl / test chara nei.

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

- **Packages:** `config/packages.json` — tier limits (number/website count, monthly verification limit, webhook on/off). Ekhane bodlale dashboard + verify limit — duitai bodle jabe.
- **Brand:** `TakaTick` — `BRAND_NAME` env (default `TakaTick`) ba `config/packages.json` theke ase; dashboard/pay page-e config theke inject hoy. Ek jayga theke bodlano jay — page-er moddhe brand naam hardcode kora hoy na.

## Security notes

- **Sob key env-e, code-e kokhono na** — `JWT_SECRET`, API key, `appKey`, `webhookSecret` kokhono git-e ba code-e hardcode kora jabe na. Signup-er somoy key gulo **ekbar-i** dekhano hoy.
- **Webhook HMAC** — prottek webhook-e `X-Signature` header thake (raw body-r HMAC-SHA256, key = merchant-er `webhookSecret`). Merchant-der signature verify korte bolte hobe — INTEGRATION.md Section 6 dekhun.
- **Duplicate TrxID block** — ek TrxID ekbar confirm hole ar kokhono verify hobe na. Eta payment fraud-er main protection.
- **Exact-amount rule** — 1 taka kom/beshi holeo `AMOUNT_MISMATCH`. Amount kokhono "kacha-kachi" hisebe neoa jabe na.
- **API key server-side-e rakhte hobe** — browser JavaScript-e ba public repo-te API key gele je keu verify/confirm call korte parbe.
- **SMS ingest auth** — `/api/sms` shudhu valid `x-app-key` header thakle accept kore. Key chara keu fake SMS inject korte parbe na.

## Ki test kora hoyeche

**`npm test` — 22 test, 22 pass, 0 fail** (Node v24.22.1, ~1.2s). Puro result: [TEST_REPORT.md](./TEST_REPORT.md). Coordinator nijeo `npm test` chaliye 22/22 pass verify koreche, ar server nije start kore health check koreche (`GET /api/health` → `{"ok":true}`, brand TakaTick).

Ja pass koreche: signup/login + JWT, tier limit (Basic-e Rocket/Upay number 403, Premium-e allowed), bKash + Rocket full flow (ingest → verify → confirm → webhook HMAC), Upay pay-page claim, duplicate confirm `ALREADY_USED`, bhul amount `AMOUNT_MISMATCH`, unknown TrxID `TRANSACTION_NOT_FOUND`, duplicate SMS `duplicate:true`, 422 `UNPARSEABLE`, 401 bad app key, parser 10 fixture + 4 edge case (4 method-i, case-insensitive sender).

**Code theke ja verify kora geche:** `config/packages.json`-er tier limits (Basic ৳300/1/1/500/no-webhook/bKash+Nagad, Standard ৳600/3/3/2000/webhook/bKash+Nagad, Premium ৳900/unlimited/webhook/all-4 + WooCommerce + priority support); `src/smsParser.js` 4 method-er SMS theke `Tk X.XX` amount + `TrxID` parse kore; amount DB-te integer poisha hisebe store hoy; `src/webhook.js` HMAC-SHA256 hex signature (`X-Signature`) dey, 5s timeout, **ekbar-i try kore, kono retry nei**; `src/db.js`-e TrxID `UNIQUE` (duplicate block) ar `sms_transactions.status` (`received`/`used`) ache.

## Ki test kora HOYNI (ekhono baki)

- ❌ Asol SMS asol phone-e — 4 method-er kono tar asol SMS wording diye parser check kora hoyni (Rocket/Upay sender ID + wording bisesh kore re-check korte hobe).
- ❌ Android app — **app-ta bananoi hoyni** (source/build nei). Asol phone-e install kore SMS forward kora hoyni.
- ❌ Production deploy — server local-e choleche, production-e deploy kora hoyni.
- ❌ Asol payment — asol taka diye end-to-end payment test kora hoyni.
- ❌ WooCommerce plugin — plugin file-i ekhono nei; eta porer step (INTEGRATION.md Section 8 dekhun).
