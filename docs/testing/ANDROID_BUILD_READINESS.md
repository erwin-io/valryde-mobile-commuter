# Android Build Readiness

**Scope:** Agent C / mandatory mobile quality gate

**Evidence date:** 2026-10-22, Asia/Manila

**Base:** `origin/main` `131944f6576c71f28b797977805b264c729f4e59`

## Native project baseline

- Capacitor core, CLI, and Android are pinned to `8.5.3`.
- The generated project uses application ID `com.valryde.commuter`, which remains explicitly provisional pending owner confirmation.
- Android `minSdkVersion` is 24; compile and target SDK are 36.
- The native plugins discovered by `npx cap sync android` are Geolocation `8.2.4`, Preferences `8.0.1`, and Secure Storage `0.13.0`.
- Secure Storage `0.13.0` declares Capacitor 8 support and compiled in the real Gradle build. Native backup is disabled so refresh-token storage is not included in Android backup/transfer.
- Only `INTERNET`, `ACCESS_NETWORK_STATE`, `ACCESS_COARSE_LOCATION`, and `ACCESS_FINE_LOCATION` appear in the merged debug manifest. There is no background-location permission. The location belongs to the commuter phone and is not vehicle telemetry.

## Verified local toolchain

| Tool | Observed value | Result |
|---|---|---|
| Node.js | 24.19.0 | Meets Capacitor 8 Node 22+ minimum |
| npm | 10.9.1 | Repository package-manager line |
| Android SDK | API 32–36 installed; build-tools 35.0.0 available | API 36 build succeeded |
| Android Studio | build `251.26094.121.0` | Installed, but older than Capacitor 8's documented Android Studio 2025.2.1 minimum |
| Build JDK | Android Studio JBR 21.0.7 | Gradle build succeeded |
| Gradle wrapper | 8.14.3 | Build succeeded |
| Android Gradle Plugin | 8.13.0 | Build succeeded |

The machine-wide `ANDROID_HOME` and `ANDROID_SDK_ROOT` variables were unset and `JAVA_HOME` pointed to JDK 17. Verification used process-scoped values only:

```powershell
$env:ANDROID_HOME = 'C:\Users\Erwin\AppData\Local\Android\Sdk'
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME
$env:JAVA_HOME = 'C:\Program Files\Android\Android Studio\jbr'
$env:Path = "$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:ANDROID_HOME\cmdline-tools\latest\bin;$env:Path"

npm ci
npm run build
npx cap sync android
Set-Location android
.\gradlew.bat assembleDebug
```

The 2026-10-22 debug build completed successfully. The generated APK was `5,737,304` bytes with SHA-256 `F0A90797D2C3B91F05014699E1EDB3ED7520A13A1344C6FEE1B89340A50BFA7E`. Build outputs remain ignored and are not committed.

## Configuration and release gates

- The browser development configuration uses `/api` through the Angular proxy. A native WebView cannot use that as the production API origin. Before emulator or physical-device integration, configure an approved reachable API origin and matching backend CORS policy; no production host was invented here.
- No production secrets, test credentials, signing keys, OAuth configuration, or deep-link redirects were added.
- The default debug keystore is suitable only for local debug builds. Owner-controlled release signing remains unconfigured.
- Android Studio must be upgraded to at least the Capacitor 8 documented minimum before IDE support is claimed, even though the command-line Gradle build succeeds.
- `com.valryde.commuter`, launcher art, and store-facing version metadata require owner confirmation before release packaging.
- Physical-device installation, location-permission behavior, secure-storage persistence, background/restore behavior, and real API connectivity remain exclusively owner-operated under the pending canonical mobile-testing policy. No device result is claimed.
