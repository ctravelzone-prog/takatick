# TakaTick v2.8 — APK v2.0: KONO SMS permission nei (Consent API) + dashboard SMS paste

Siam-er kotha: eto pain niye keu app nite chaibe na, product sell hobe
na. Thik — sideload + Play Protect + restricted settings + permission
dialog — ei rasta-ta merchant-der jonno cholbe na.

## Onno way (v2.0 app)
SMS User Consent API (Google Play Services): app SMS permission-i chay
na. Payment SMS asle Android nije ekta dialog dekhay ("Allow TakaTick
SMS to read this message?") — merchant ekbar Allow chaplei oi SMS-ta
server-e jay.
- Install sadharon app-er moto: Play Protect-er SMS block nei (manifest-e
  SMS permission-i nei), restricted settings nei, permission dialog nei.
- Foreground service listening chalu rakhe (notification dekhabe);
  phone restart hole BootReceiver abar chalu kore.
- Play Services library compile-e lage na — reflection-e daka hoy, tai
  manual aapt2/d8 build-e kono extra AAR lage na.
- APK v2.0: versionCode 5, versionName 2.0, eki release keystore
  (signer CN=TakaTick, v2+v3), md5 `c12f36059325f03b442cd575aa90ab6c`.
  Permissions: INTERNET + FOREGROUND_SERVICE(+DATA_SYNC) +
  RECEIVE_BOOT_COMPLETED — SMS permission SHUNNO (aapt2 diye verify).

## Tradeoff (sotyi kotha)
Puro automatic ar na — proti payment SMS-e ekbar Allow tap korte hobe.
Kintu install-er pain SHUNNO, ar ekbar tap kora proti payment-e merchant-er
jonno choto kaj. Eita-i Google-er sanctioned rasta SMS porar jonno.

## No-app fallback: dashboard-e SMS paste
Merchant chaile app charai cholbe: messaging app theke payment SMS copy
kore dashboard-er "Received SMS transactions" box-e paste korle server
seta parse kore transaction banay — tarpor verify/confirm ager motoi
chole. Endpoint: `POST /api/me/sms-paste` (auth + plan-off block;
duplicate TrxID block; 422 UNPARSEABLE).
- Consent API SMS-er sender dey na, sudhu text dey — tai parser bodlano:
  method na bojha geleo amount + TrxID thik thakle method 'unknown'
  hisebe rakha hoy (verify TrxID + amount diyei hoy).

## Test
- `npm test` — 65/65 pass (64 + 1 notun paste test: 401/400/422,
  bkash paste, duplicate, unknown-method paste, verify+confirm full loop).
- `aapt2 dump badging`: versionCode 5 / 2.0, SMS permission nei.
  `apksigner verify`: v2+v3 true.
- Consent dialog-er asol phone flow (Allow tap → forward) ekhane test
  kora jay na (phone + Play Services lage) — Siam-er phone-ei prothom
  live test hobe; paste path-ta server test-e puropuri verify kora.
