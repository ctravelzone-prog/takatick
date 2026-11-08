# TakaTick — v1.1 changes (2026-11-08)

v1.0 theke ja add holo (Siam: "aigula sob banie felo"):

## Notun
- **WooCommerce plugin** — `woocommerce-plugin/` (2 file: `takatick-gateway.php` + `class-wc-gateway-takatick.php`)
  - Checkout-e TakaTick payment method, hosted payment page-e redirect, signed webhook-e order auto paid, amount check, idempotent handling.
  - ⚠️ Live test hoyni: ei machine-e PHP nei, tai syntax check-o kora jayni. WordPress + WooCommerce-e install kore ekta test order diye check korun.
- **Android SMS app source** — `android-app/` (Kotlin + manifest + gradle + README)
  - Sudhu 4 MFS sender-er SMS forward kore (bKash 16247, Nagad 16167, Rocket 16216, Upay 16268) — onno SMS poreo na, pathayo na.
  - Setup screen (server URL + app key), SMS permission, test button.
  - ⚠️ APK build hoyni: ei machine-e Android SDK / Java nei. Android Studio-te khule Build APK korte hobe (README-te step ache).
- **INTEGRATION.md update** — Android app section + WooCommerce section ekhon asol file-er dike dekhay.

## Ekhono baki (Siam-er kache theke lagbe / pore korte hobe)
- **Asol SMS wording check** — Rocket + Upay (ar bKash/Nagad) asol SMS diye parser test kora baki. Ekta asol received-SMS-er text (number/TrxID X diye mask kore dileo cholbe) pathale miliye dibo.
- **Domain check** — `takatick.com` ekhan theke nischit vabe check kora jayni (sandbox DNS thik uttor dey na). Domain kenar somoy Hostinger/Namecheap-e check korun.
- **Live test** — asol phone + asol payment diye end-to-end test (app install → SMS → verify → confirm → webhook).

## v1.0 theke (ager motoi)
- Backend API + dashboard + hosted payment page + verify/confirm API + webhook — `npm test` 22/22 pass (v1.0-te nije verify korechi).
- Package: Basic ৳300 / Standard ৳600 / Premium ৳900; methods: bKash, Nagad, Rocket, Upay.
