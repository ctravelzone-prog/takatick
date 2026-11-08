# TakaTick — v1.2 changes (2026-11-08)

## Notun — Android APK BUILT
- **TakaTickSMS v1.0 APK toiri** — `android-app/TakaTickSMS-v1.0.apk` (16 KB, md5 `c3854cf0cc638e2a53fe42b649abdef1`)
  - Signed v2+v3, package `com.takatick.sms`, versionCode 1 / versionName 1.0, target SDK 34.
  - Build kora hoyeche manual script diye (`android-app/build-apk.sh` — aapt2 + d8 + zipalign + apksigner), karon ei machine-e Gradle download hoy na.
  - App-ta **Java-te rewrite** kora hoyeche (age Kotlin + OkHttp chilo) — Kotlin stdlib ar OkHttp ei machine-e download kora jay na, tai pure Java + HttpURLConnection (built-in) use kora hoyeche. Kono third-party library nei.
  - Sign kora hoyeche **DEBUG keystore** (`android-app/takatick-debug.keystore`, password `takatick-debug`) diye — **TEST-ER JONNO ONLY**. Play Store release-er jonno alada release keystore lagbe. Keystore-ta zip-e nei (alada vabe backup rakhte hobe).
- **APK install:** phone-e khule install korun (Unknown sources / Install unknown apps allow korte hobe). Khule Server URL + App Key boshan, SMS permission din, Test button chapen.

## Ekhono baki
- **Live test preview (Render)** — deploy cholche; link aslei test kora jabe (signup → number → app → SMS → verify).
- **Asol SMS wording check** — Rocket + Upay asol SMS diye parser test kora baki (Siam-er asol SMS lagbe).
- **WooCommerce plugin live test** — WordPress-e install kore test order diye check kora baki (PHP syntax check hoyni — ei machine-e PHP nei).
- **Domain** — `takatick.com` ekhan theke nischit check kora jayni; registrar-e check korun.
