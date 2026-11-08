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
#   ./build-apk.sh
# Output: build-manual/TakaTickSMS.apk (signed with the TEST keystore below)
#
# Signing: this build uses a DEBUG keystore (takatick-debug.keystore,
# password "takatick-debug") — TEST-ER JONNO ONLY. Play Store release-er
# jonno alada release keystore banate hobe, ar ei file-e debug keystore-er
# bodle seta bosate hobe. Debug keystore-ta kokhono production app-er
# update-er jonno use korben na — harale/gopon na thakle keu apnar
# naam-e app sign korte parbe.
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
STORE_FILE="$APP_DIR/takatick-debug.keystore"
STORE_PASS="takatick-debug"
KEY_ALIAS="takatick"
KEY_PASS="takatick-debug"

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

echo "== 7. sign (TEST keystore) =="
"$BT/apksigner" sign --ks "$STORE_FILE" --ks-pass "pass:$STORE_PASS" \
    --key-pass "pass:$KEY_PASS" --ks-key-alias "$KEY_ALIAS" \
    --out "$BUILD/TakaTickSMS.apk" "$BUILD/app-aligned.apk"

echo "== 8. verify =="
"$BT/apksigner" verify --verbose "$BUILD/TakaTickSMS.apk" | head -4
"$BT/aapt2" dump badging "$BUILD/TakaTickSMS.apk" | head -3
ls -la "$BUILD/TakaTickSMS.apk"
echo "DONE: $BUILD/TakaTickSMS.apk"
