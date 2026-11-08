#!/bin/bash
# TakaTick SMS app — manual APK build (no Gradle downloads needed).
#
# Why this script exists: Gradle cannot download its plugins on machines
# whose network goes through a proxy that Java's HTTP client cannot use.
# This script builds the same APK with the Android SDK tools directly —
# everything it needs is already on disk (aapt2, d8, zipalign, apksigner).
# The app is written in pure Java with no third-party libraries
# (network = HttpURLConnection), so no dependency downloads are needed at all.
#
# Usage:
#   export JAVA_HOME=$HOME/jdk17 ANDROID_HOME=$HOME/Android
#   ./build-apk.sh            # debug-signed test build (default)
#   RELEASE=1 ./build-apk.sh  # RELEASE build (v1.1): signed with the
#                             # release keystore (takatick-release.keystore).
#                             # The keystore password lives ONLY in
#                             # android-app/.release-keystore-pass (gitignored,
#                             # never in git/zips) or in RELEASE_STORE_PASS.
# Output: build-manual/TakaTickSMS.apk (debug) or
#         build-manual/TakaTickSMS-v1.2.apk (release)
#
# Signing: the debug build uses a DEBUG keystore (takatick-debug.keystore,
# password "takatick-debug") — TEST-ER JONNO ONLY. The release build uses
# the release keystore — etai Play Store / asol merchant-der jonno.
# Release keystore harale ei package-er (com.takatick.sms) ar update
# kora jabe na — keystore + password file duitai jotno kore rakhte hobe.
#
# Version bump: android:versionCode / android:versionName in
# app/src/main/AndroidManifest.xml (ar app/build.gradle-eo same rakha).
set -e
cd "$(dirname "$0")"

: "${JAVA_HOME:?set JAVA_HOME to your JDK 17 folder}"
: "${ANDROID_HOME:?set ANDROID_HOME to your Android SDK folder}"
export PATH="$JAVA_HOME/bin:$PATH"

APP_DIR="$(pwd)"
BUILD="$APP_DIR/build-manual"
BT="$ANDROID_HOME/build-tools/34.0.0"
PLATFORM="$ANDROID_HOME/platforms/android-34/android.jar"
if [ "${RELEASE:-0}" = "1" ]; then
  STORE_FILE="$APP_DIR/takatick-release.keystore"
  KEY_ALIAS="takatick"
  if [ -n "${RELEASE_STORE_PASS:-}" ]; then
    STORE_PASS="$RELEASE_STORE_PASS"
  else
    STORE_PASS="$(cat "$APP_DIR/.release-keystore-pass")"
  fi
  KEY_PASS="$STORE_PASS"
  OUT_APK="TakaTickSMS-v1.2.apk"
  echo "== RELEASE build (release keystore) -> $OUT_APK =="
else
  STORE_FILE="$APP_DIR/takatick-debug.keystore"
  STORE_PASS="takatick-debug"
  KEY_ALIAS="takatick"
  KEY_PASS="takatick-debug"
  OUT_APK="TakaTickSMS.apk"
fi

if [ ! -f "$STORE_FILE" ]; then
    echo "ERROR: debug keystore not found: $STORE_FILE"
    echo "Generate it once with:"
    echo "  keytool -genkeypair -v -keystore $STORE_FILE -alias $KEY_ALIAS \\"
    echo "    -keyalg RSA -keysize 2048 -validity 10000 \\"
    echo "    -storepass $STORE_PASS -keypass $KEY_PASS \\"
    echo "    -dname \"CN=TakaTick Test, OU=Test, O=TakaTick, C=BD\""
    exit 1
fi

rm -rf "$BUILD"
mkdir -p "$BUILD/compiled-res" "$BUILD/classes" "$BUILD/dex"

echo "== 1. aapt2 compile (resources) =="
"$BT/aapt2" compile --dir "$APP_DIR/app/src/main/res" -o "$BUILD/compiled-res.zip"

echo "== 2. aapt2 link (manifest + resources -> unsigned APK, R.java) =="
"$BT/aapt2" link -o "$BUILD/app-unsigned.apk" -I "$PLATFORM" \
    --manifest "$APP_DIR/app/src/main/AndroidManifest.xml" \
    "$BUILD/compiled-res.zip" --java "$BUILD/classes" --auto-add-overlay

echo "== 3. javac (Java sources + R.java) =="
"$JAVA_HOME/bin/javac" -encoding UTF-8 -d "$BUILD/classes" \
    -cp "$PLATFORM" -sourcepath "$BUILD/classes" \
    "$APP_DIR/app/src/main/java/com/takatick/sms/MainActivity.java" \
    "$APP_DIR/app/src/main/java/com/takatick/sms/SmsReceiver.java" \
    "$APP_DIR/app/src/main/java/com/takatick/sms/ApiClient.java" \
    "$BUILD/classes/com/takatick/sms/R.java"

echo "== 4. d8 (classes -> classes.dex) =="
"$BT/d8" --release --output "$BUILD/dex" --lib "$PLATFORM" \
    "$BUILD/classes/com/takatick/sms/"*.class

echo "== 5. add classes.dex to the APK =="
cp "$BUILD/dex/classes.dex" "$BUILD/classes.dex"
(cd "$BUILD" && zip -q app-unsigned.apk classes.dex)

echo "== 6. zipalign =="
"$BT/zipalign" -f -p 4 "$BUILD/app-unsigned.apk" "$BUILD/app-aligned.apk"

echo "== 7. sign ($([ "${RELEASE:-0}" = "1" ] && echo RELEASE || echo TEST) keystore) =="
"$BT/apksigner" sign --ks "$STORE_FILE" --ks-pass "pass:$STORE_PASS" \
    --key-pass "pass:$KEY_PASS" --ks-key-alias "$KEY_ALIAS" \
    --out "$BUILD/$OUT_APK" "$BUILD/app-aligned.apk"

echo "== 8. verify =="
"$BT/apksigner" verify --verbose "$BUILD/$OUT_APK" | head -4
"$BT/aapt2" dump badging "$BUILD/$OUT_APK" | head -3
ls -la "$BUILD/$OUT_APK"
echo "DONE: $BUILD/$OUT_APK"
