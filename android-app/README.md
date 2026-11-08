# TakaTick SMS App (Android)

Merchant-er phone-e install kora choto app. Je phone-e bKash / Nagad / Rocket / Upay payment SMS ashe, oi phone-e ei app thakbe.

**App ta ki kore:**
- Sudhu ei 4 MFS sender-er SMS pore: bKash (`bKash` / `16247`), Nagad (`Nagad` / `16167`), Rocket (`Rocket` / `16216`), Upay (`Upay` / `16268`).
- SMS aslei sathe sathe apnar TakaTick server-e forward kore (`POST /api/sms`) — apnar `appKey` diye.
- Onno kono SMS (OTP, bank, personal message) app ta poreo na, pathayo na.

**Privacy note (merchant-ke janate hobe):** App ta merchant-er NIJER phone-e, NIJER SMS, NIJER server-er jonno. SMS kokhono onno kothao jay na. Install korar somoy Android SMS permission chaibe — eta chara app kaj korbe na.

## APK banano — 2-ta upay

**Upay 1 — ei repo-er script (sohoj):**
```bash
export JAVA_HOME=$HOME/jdk17 ANDROID_HOME=$HOME/Android
./build-apk.sh
# Output: build-manual/TakaTickSMS.apk
```
Script-ta Android SDK tool (aapt2 + d8 + zipalign + apksigner) diye APK banay — Gradle download lage na. App Java-te lekha, kono third-party library nei (network = HttpURLConnection), tai dependency-o lage na.

**Upay 2 — Android Studio:**
1. Android Studio khulun → Open → ei `android-app/` folder select korun.
2. Gradle sync hote din.
3. Menu: **Build → Build App Bundle(s) / APK(s) → Build APK(s)**.
4. APK paben: `app/build/outputs/apk/debug/app-debug.apk` — phone-e copy kore install korun.
5. Release APK-er jonno signing key lagbe (Android Studio: Build → Generate Signed App Bundle / APK).

> ⚠️ `build-apk.sh` ekta **DEBUG keystore** (`takatick-debug.keystore`, password `takatick-debug`) diye sign kore — **TEST-ER JONNO ONLY**. Play Store release-er jonno alada release keystore banate hobe. Debug keystore diye sign kora APK Play Store-e tola jabe na, ar ei keystore harale test build-er update dite problem hobe na (notun debug keystore-e abar build korlei hobe — kintu purono install-er upor update hobe na, uninstall kore abar install korte hobe).

## Setup (phone-e)

1. App khulun → **Server URL** boshan (jemon `https://pay.apnar-domain.com`) ar **App Key** boshan (TakaTick dashboard theke neoa `appKey`) → Save chapen.
2. Android SMS permission allow korun (na korle app SMS porte parbe na).
3. **Test button** chapen — ekta sample bKash SMS server-e pathabe; dashboard-er Transactions-e dekhte parben.
4. Phone-er battery optimization-e app-ta "Unrestricted" rakhun, na hole Android background-e app bondho kore dite pare ar SMS miss hote pare.

## Play Store note

Google Play-te SMS permission-er jonno alada declaration lage (SMS app hisebe). Nijer merchant-der jonno APK sideload (direct install) korai sohoj rasta — Play Store-e tulte chaile SMS permission declaration + privacy policy lagbe.

## File list

- `app/src/main/AndroidManifest.xml` — permissions (RECEIVE_SMS, READ_SMS, INTERNET) + receiver
- `app/src/main/java/com/takatick/sms/SmsReceiver.kt` — SMS dhore, MFS sender check kore, forward kore
- `app/src/main/java/com/takatick/sms/ApiClient.kt` — server-e POST kore (OkHttp)
- `app/src/main/java/com/takatick/sms/MainActivity.kt` — setup screen (server URL + app key + test button)
