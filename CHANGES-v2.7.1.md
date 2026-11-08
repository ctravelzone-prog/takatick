# TakaTick v2.7.1 — Release-signed APK v1.1 (Play Protect block-er fix)

Siam-er report: phone-e TakaTickSMS v1.0 install korte gele Google Play
Protect "App blocked to protect your device" dekhiye atke dicchilo.

Karon: v1.0 APK-ta DEBUG keystore diye sign kora chilo (test-er jonno) —
ochena developer + SMS permission + debug signature = Play Protect-er
kache sondehojonok.

## Ki bodleche
- `android-app/takatick-release.keystore` — notun release keystore
  (CN=TakaTick, OU=TakaTick, O=TakaTick, L=Dhaka, C=BD, RSA 2048, 10000
  din). Password sudhu `android-app/.release-keystore-pass` file-e —
  duitai gitignored, kokhono git/zip-e jabe na. Keystore harale ei
  package-er (com.takatick.sms) ar update kora jabe na.
- `android-app/build-apk.sh` — `RELEASE=1 ./build-apk.sh` dile release
  build hoy (password file ba RELEASE_STORE_PASS theke ney).
- APK v1.1: versionCode 2, versionName 1.1 (manifest + build.gradle),
  v2+v3 signature, zipaligned; signer CN=TakaTick (age chilo "TakaTick
  Test"); md5 `7ed9fd8fc5a6bc2a0b1d30af6a044801`.
- `server.js` + dashboard: download ekhon TakaTickSMS-v1.1.apk; dashboard-e
  Play Protect install note (Play Store → Play Protect → scanning OFF →
  install → abar ON).

## Sotyi kotha (guarantee noy)
Release signature-ta thik professional step, ar Play Store-e deoar
prerequisite — kintu Play Protect kokhono block korbe na, eita guarantee
kora jay na: ochena developer-er SMS-permission app Google nijer
hisebe flag korte pare. Play Store listing-i ekmatro purno fix, ar
TakaTick-er khetre seta somvob — Google Play-er "SMS-based financial
transactions" exception-e (verifications for financial transactions)
READ_SMS/RECEIVE_SMS eligible, review + Permissions Declaration Form
sapekkhe. Play Console account ($25) + review Siam-er siddhanto.

## Test
- `npm test` — 64/64 pass (63 + 1 notun v2.7.1 test: dashboard-e v1.1
  link + Play Protect note; download-er content-disposition-e v1.1 naam).
- `apksigner verify`: v2+v3 true; signer DN + SHA-256 digest upore.
