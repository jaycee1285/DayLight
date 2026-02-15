# Android Build Instructions

## Prerequisites

Enter the nix dev shell:
```bash
nix develop
```

Ensure Android SDK is set up (the shell will show status).

## Build

```bash
bun run tauri android build
```

Output: `src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk`

## Sign (first time - create keystore)

```bash
keytool -genkey -v -keystore debug.keystore -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -storepass android -keypass android -dname "CN=Debug"
```

## Sign APK

```bash

```

## Install

```bash
adb install -r daylight-signed.apk
```

## Development (auto-signs with debug key)

```bash
bun run tauri android dev
```
~/.local/share/android-sdk/build-tools/34.0.0/apksigner sign --ks debug.keystore --ks-pass pass:android --out daylight-signed.apk src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk