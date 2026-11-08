# TakaTick v2.7.2 — APK v1.2: READ_SMS permission sorano (Install anyway-r dike)

Siam-er kotha: onno third-party app install korle "Install anyway"
dilei hoy, Play Protect off kora lage na — amader-tao omon kore dao.

## Keno amader-ta hard block khacchilo
Play Protect-er 2 rokom verdict ache:
- **Warning** — "Install anyway" button thake (beshirvag third-party app).
- **Hard block** — sudhu "Got it", install-i hoy na (amader v1.0).

Amader-ta hard block khawar 2-ta karon chilo:
1. **Debug signature** (v1.0) — v2.7.1-e release signature-e thik hoyeche.
2. **READ_SMS permission** — "tomar sob SMS porar" permission; Play
   Protect-er warning-e je "sensitive data / identity theft" kothata
   thake, seta muloto ei permission-er jonnoi.

## Ki bodleche (v1.2)
- **READ_SMS sorano — app-ta asole inbox porei na.** SmsReceiver SMS
  sudhu broadcast theke ney (`Telephony.Sms.Intents.getMessagesFromIntent`),
  kothao `content://sms` query nei. Tai READ_SMS lagto na, sudhu
  chawa hocchilo.
- Ekhn permission sudhu **RECEIVE_SMS + INTERNET** (aapt2 badging diye
  verify kora). MainActivity sudhu RECEIVE_SMS-i chay.
- APK v1.2: versionCode 3, versionName 1.2, eki release keystore
  (signer CN=TakaTick, v2+v3), md5 `69d68d65424a9939791a2238e9cd9185`.
- `server.js` + dashboard: download ekhon TakaTickSMS-v1.2.apk.

## Sotyi kotha (guarantee noy)
Ei duita bodol (release signature + READ_SMS bad) app-take onno
third-party app-er moto profile-e niye eseche — "Install anyway"
ashar somvabona ekhon onek beshi. Kintu 100% guarantee dite parbo na:
Google notun developer + SMS permission-er upor nijer hisebe
siddhanto ney. Phone-e v1.2 install kore dekhlei bujha jabe —
"Install anyway" asle fix, hard block asle Play Store listing-i
sesh upay (SMS-based financial transactions exception-e eligible,
review sapekkhe — Siam-er siddhanto).

## Test
- `npm test` — 64/64 pass (v2.7.2 test: dashboard-e v1.2 link + Play
  Protect note; download-er content-disposition-e v1.2 naam).
- `aapt2 dump badging`: versionCode 3 / 1.2, permissions sudhu
  RECEIVE_SMS + INTERNET. `apksigner verify`: v2+v3 true.
