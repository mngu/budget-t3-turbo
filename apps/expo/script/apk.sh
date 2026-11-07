#!/bin/sh
# Builds a sideloadable release APK against the production API (`.env.production`).
# Signed with the debug keystore: fine for installing on your own phone, not for a store.
set -eu
cd "$(dirname "$0")/.."

export JAVA_HOME="${JAVA_HOME:-/opt/homebrew/opt/openjdk/libexec/openjdk.jdk/Contents/Home}"
export ANDROID_HOME="${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}"

# `prebuild` rewrites the start scripts to native builds; keep the Expo Go ones.
cp package.json /tmp/jar-package.json
npx expo prebuild -p android --clean --no-install
cp /tmp/jar-package.json package.json

(cd android && ./gradlew assembleRelease)
echo "APK : $(pwd)/android/app/build/outputs/apk/release/app-release.apk"
