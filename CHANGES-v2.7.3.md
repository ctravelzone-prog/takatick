# TakaTick v2.7.3 — APK v1.3: restricted SMS permission-er poth dekhay

Siam-er phone-er screenshot: SMS permission chaple "App was denied
access" dialog ashe — "Access to this permission can put your personal
and financial info at risk... Learn how to allow access" — ar button
ar kichu kore na.

## Karon
Android 13+ sideload kora app-er SMS permission-ke "restricted
permission" dhore. Ekbar deny hole system ar Allow/Deny dialog dekhay
na — sorasori ei denied dialog dekhay. Ager button (`requestPermissions`
sorasori) tokhon chupchap kichu na kore boshe thakto.

## Ki bodleche (v1.3, MainActivity)
- `requestSmsPermission()` helper: permission deoa thakle status-e ✅;
  prothombar hole normal dialog chay; deny howar por abar chaple
  (restricted / permanently denied) App info page khule dey
  (`ACTION_APPLICATION_DETAILS_SETTINGS`) ar status-e exact poth
  likhe dey: Settings → Apps → TakaTick SMS → ⋮ → "Allow restricted
  settings" ON koro, tarpor SMS Allow koro.
- `onRequestPermissionsResult`: grant hole ✅ status, deny hole
  Settings-er poth status-e.
- APK v1.3: versionCode 4, versionName 1.3, eki release keystore
  (signer CN=TakaTick, v2+v3), md5 `4ed6f44aaebda5a2ad2b75d9e350c6e1`;
  permission ager motoi sudhu RECEIVE_SMS + INTERNET.
- `server.js` + dashboard: download ekhon TakaTickSMS-v1.3.apk.

## Siam-er phone-e ekhon-i korar steps (v1.3 charao chole)
1. Dialog-ta Close koro.
2. Settings → Apps → TakaTick SMS khulo.
3. Uporer dane ⋮ (3 dot) → **Allow restricted settings** → Allow.
4. Permissions → SMS → **Allow**.
5. App-e fire eshe "Test SMS pathan" chaple server-e test SMS jabe.

## Test
- `npm test` — 64/64 pass (v2.7.3 test: dashboard-e v1.3 link + Play
  Protect note; download-er content-disposition-e v1.3 naam).
- `aapt2 dump badging`: versionCode 4 / 1.3, permissions sudhu
  RECEIVE_SMS + INTERNET. `apksigner verify`: v2+v3 true.
- Phone-er asol restricted dialog-er flow (Settings theke Allow)
  code-e handle kora, kintu asol phone-e v1.3 diye verify kora baki —
  Siam install kore janabe.
