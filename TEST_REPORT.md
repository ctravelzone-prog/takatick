# TEST_REPORT — TakaTick payment-verification MVP (backend)

Brand: **TakaTick**. Methods: **bKash, Nagad, Rocket, Upay** (all verified the same
SMS-app way). Money never flows through this server.

Run: `npm install` then `npm test` in `~/workspace/payment-method-mvp/`.
Node v24.22.1, npm 10.9.4. `npm install` added 83 packages, no native builds.

## Final result

- `npm test` — **22 tests, 22 pass, 0 fail** (exit 0, ~1.3s).
- `npm install` — PASS (83 packages, no native builds).

## Per-check results

| # | Check | Result |
|---|-------|--------|
| 1 | Health `GET /api/health` → `{ok:true}` | PASS |
| 2 | Brand: login page shows TakaTick from config, no `[Your Brand]` / `{{BRAND}}` left | PASS |
| 3 | Signup Basic + login (JWT issued, keys `sk_live_`/`app_`/`pay_` returned once) | PASS |
| 4 | Basic merchant adds bKash number (201) | PASS |
| 5 | Basic merchant adding Rocket number → 403 `METHOD_NOT_ALLOWED_FOR_PACKAGE` | PASS |
| 6 | Basic merchant adding Upay number → 403 `METHOD_NOT_ALLOWED_FOR_PACKAGE` | PASS |
| 7 | Basic profile: methods `["bkash","nagad"]`, verifications limit 500 | PASS |
| 8 | Signup Premium; Rocket + Upay numbers allowed (201 each) | PASS |
| 9 | Premium profile: methods `["bkash","nagad","rocket","upay"]`, verifications limit `null` (unlimited) | PASS |
| 10 | bKash SMS ingest via `x-app-key` → `{ok:true, trxid: 9AB12CD34E, method: bkash, amount: 1000}` | PASS |
| 11 | Duplicate bKash SMS ingest → `{ok:true, duplicate:true}` | PASS |
| 12 | Verify unknown TrxID → `TRANSACTION_NOT_FOUND` | PASS |
| 13 | Verify correct bKash (1000) → pending id, `senderMasked: 017******78` | PASS |
| 14 | Confirm correct bKash → `{ok:true, method: bkash, sender: 01712345678}` | PASS |
| 15 | Webhook received by local catcher for bKash confirm, `X-Signature` = 64-hex HMAC, `order_id: ORD-1` | PASS |
| 16 | Duplicate confirm → `ALREADY_USED` | PASS |
| 17 | Wrong amount verify → `AMOUNT_MISMATCH` | PASS |
| 18 | Unparseable SMS → 422 `UNPARSEABLE`; bad app key → 401 | PASS |
| 19 | **Rocket flow: ingest → verify (750) → confirm → webhook** (`ROCKET12345`, method `rocket`, transaction marked `used`) | PASS |
| 20 | Pay page (Premium): shows TakaTick, Rocket + Upay numbers grouped, method select has all 4 | PASS |
| 21 | **Upay pay-page claim** (`/pay/:payKey/claim`, method `upay`, 2000, `UPAY987654`) → "Payment confirmed" HTML + webhook | PASS |
| 22 | Parser unit tests, all 10 fixtures + 4 edge cases (see below) | PASS |

## Parser tests (test/parser.test.js, from test/fixtures/sms-samples.json)

| Fixture | Result |
|---------|--------|
| bKash received, sender `bKash` (Tk 1,000.00, `9AB12CD34E`) | PASS |
| Nagad received, sender `Nagad` (Tk 500.50, `NAGAD12345`) | PASS |
| bKash via short code `16247`, "Trx ID" with space | PASS |
| Nagad via short code `16167`, comma amount Tk 12,345.75 | PASS |
| bKash small amount, no sender number in text | PASS |
| Unparseable — no amount or TrxID → `UNPARSEABLE` | PASS |
| **Rocket received, sender `Rocket` (Tk 750.00, `ROCKET12345`)** | PASS |
| **Upay received, sender `Upay` (Tk 2,000.00, `UPAY987654`)** | PASS |
| **Rocket via short code `16216`, comma amount Tk 1,250.50** | PASS |
| **Upay via short code `16268`, "Trx ID" with space** | PASS |
| Rocket sender id case-insensitive (`ROCKET`) | PASS |
| Upay sender id case-insensitive (`upay`) | PASS |
| Unknown sender → `UNPARSEABLE` | PASS |
| Empty text → `UNPARSEABLE` | PASS |

## Manual smoke checks (live server, curl)

| Check | Result |
|-------|--------|
| `GET /api/health` → `{"ok":true}` | PASS |
| Login page title/heading: `Login — TakaTick` / `TakaTick` | PASS |
| Dashboard page title/heading: `Dashboard — TakaTick` / `TakaTick — Merchant dashboard` | PASS |
| Signup (premium) returns merchant + keys | PASS |
| `BRAND_NAME=AcmePay` override → login title `Login — AcmePay`, startup log `brand: AcmePay` (proves the brand comes from the single config/env value, not hardcoded pages) | PASS |
| No `[Your Brand]` string remains anywhere in the backend scope (grep, excl. node_modules) | PASS |
| `node --check` on `server.js`, `src/*.js`, `test/*.js` | PASS |

## Notes / deviations (honest)

1. **Test script form:** the original spec `node --test test/` does NOT work on this
   Node v24.22.1 — Node treats `test/` as a module to execute and fails with
   `Cannot find module '.../test'`. The script is therefore
   `node --test "test/**/*.test.js"` (same files, same runner, exit 0, 22/22 pass).
2. **Rocket/Upay SMS wording is unconfirmed against a real message.** The parser
   uses the sender IDs Siam supplied (Rocket `Rocket`/`16216`, Upay `Upay`/`16268`)
   with the same tolerant regexes as bKash/Nagad, and `src/smsParser.js` carries
   an explicit comment that the exact Rocket/Upay wording and sender IDs MUST be
   re-checked against a real SMS before production.
3. **Brand single source:** `config/packages.json` `brand: "TakaTick"` (or
   `BRAND_NAME` env, which overrides it). `public/login.html` and
   `public/dashboard.html` contain only the `{{BRAND}}` placeholder — no hardcoded
   brand string in any page; the server injects the configured brand when serving
   them. The hosted pay page already rendered the brand from `getBrand()`.
   The only literal `TakaTick` in code is the fallback in `src/limits.js`
   (used only if both config and env are missing) and comments.
4. No README.md / INTEGRATION.md was touched (docs owned separately). Nothing was
   zipped or deployed. No real credentials or secrets are hardcoded; all secrets
   come from env. Test DBs were temp files (removed after the run); `data/` is empty.

## Command outputs (summary)

```
$ npm install
added 83 packages in 8s

$ npm test
> payment-method-mvp@1.0.0 test
> node --test "test/**/*.test.js"
✔ health returns ok
✔ brand: login page shows TakaTick from config, no placeholder
✔ signup basic + login; Rocket/Upay numbers rejected for Basic
✔ signup premium; Rocket + Upay numbers allowed
✔ bKash flow: ingest SMS -> verify -> confirm -> webhook; error cases
✔ Rocket flow: ingest -> verify -> confirm -> webhook
✔ pay page: Premium shows Rocket + Upay numbers grouped, brand TakaTick
✔ Upay pay-page claim confirms payment
✔ parser: bKash received, sender bKash
✔ parser: Nagad received, sender Nagad
✔ parser: bKash via short code 16247, Trx ID with space
✔ parser: Nagad via short code 16167, comma amount
✔ parser: bKash small amount, no sender number in text
✔ parser: unparseable — no amount or TrxID
✔ parser: Rocket received, sender Rocket
✔ parser: Upay received, sender Upay
✔ parser: Rocket via short code 16216, comma amount
✔ parser: Upay via short code 16268, Trx ID with space
✔ parser: Rocket sender id is case-insensitive
✔ parser: Upay sender id is case-insensitive
✔ parser: unknown sender is unparseable
✔ parser: empty text is unparseable
ℹ tests 22
ℹ pass 22
ℹ fail 0
```
