# TakaTick v2.8 (revised) — APK v1.4: RECEIVE_SMS full-auto + retry + content-based payment recognition; dashboard SMS paste

## Keno revised
v2.8-er prothom plan (APK v2.0, SMS User Consent API) Siam reject koreche —
proti payment SMS-e ekbar Allow tap kora auto noy, product-er mane-i thake
na. Sideload v1.3-i (RECEIVE_SMS, puro automatic) thakbe; consent app-er
code repo theke sorano hoyeche.

## Asol phone-e v1.3 keno fail korlo
Asol bKash SMS (TrxID DK848KW31K, Tk 10.00, 8 Nov 23:20) phone-e eseche,
permission deoa chilo, settings save chilo — tobuo v1.3 app server-e
pathayni (server direct POST-e thik ache, curl diye promanito).
Duto sombhabbo karon:
1. Ekbar-er POST: Render free tier ghumale prothom request connect
   timeout-e (10s) fail kore — ar kono retry chilo na, SMS-ta harie jeto.
2. Sender filter: sender recognized MFS list-e na thakle purono code
   SMS-ta chupchap fele dito — body dekheo na.

## APK v1.4 — fix
- Retry: `ApiClient.postSmsTo` ekhon 3 bar chesta kore (2s gap) — POST
  fail ba non-2xx hole abar pathay. Duijon caller-i (SmsReceiver ar
  Test button) background thread theke dake, tai sleep safe.
- Content-based payment recognition (`SmsReceiver.looksLikePaymentSms`):
  sender ID ja-i hok, body-r bhasha diye payment SMS chena hoy —
  "received" + "Tk" + amount (Tk 10.00) + "TrxID", ba bKash/Nagad/
  Rocket/Upay-er naam thakleo forward hoy. Vul forward holeo khoti nei —
  server-e parse na hole 422 UNPARSEABLE hoye sms_unparsed-e jabe,
  transaction banbe na.
- Inbox pora hoy NA (READ_SMS nei) — manifest receiver protita SMS
  live-ei dhore, tai notun payment SMS sobsomoy paoa jay; inbox reading
  anle Play Protect block fire asbe.
- APK v1.4: versionCode 5, versionName 1.4, eki release keystore
  (signer CN=TakaTick, SHA-256 b2afc07e28f5e7c0194407b14eefb7ebb8178517df3ec993c11c96a95f3ce36c,
  v2+v3), md5 `eeeee5557283b132053a79b1db307027`, 16,811 bytes.
  Permissions: RECEIVE_SMS + INTERNET shudhu (aapt2 diye verify).

## No-app fallback: dashboard-e SMS paste (v2.8 theke rakha)
Merchant chaile app charai cholbe: messaging app theke payment SMS copy
kore dashboard-er "Received SMS transactions" box-e paste korle server
seta parse kore transaction banay — tarpor verify/confirm ager motoi
chole. Endpoint: `POST /api/me/sms-paste` (auth + plan-off block;
duplicate TrxID block; 422 UNPARSEABLE).
- Parser tolerant: method na bojha geleo amount + TrxID thik thakle
  method 'unknown' hisebe rakha hoy (verify TrxID + amount diyei hoy,
  method sudhu display/record-er jonno).

## Test
- `npm test` — 65/65 pass (64 + 1 paste test: 401/400/422,
  bkash paste, duplicate, unknown-method paste, verify+confirm full loop).
- `aapt2 dump badging`: versionCode 5 / 1.4, permissions RECEIVE_SMS +
  INTERNET shudhu. `apksigner verify`: v2+v3 true.
- Asol phone-e v1.4-er live test ekhono baki — Siam-er phone-e asol
  payment SMS diye prothom test hobe (deploy-er por).
