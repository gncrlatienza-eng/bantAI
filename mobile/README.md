# BantAI Android App

The **BantAI** Android app — Kotlin + Jetpack Compose. Registers as the device's default SMS
handler so incoming messages are classified before the user ever sees them, using the backend's
`/sms/ingest` endpoint (with an on-device keyword heuristic as a fallback when the backend or AI
service is unreachable).

---

## Tech Stack

- Kotlin, Jetpack Compose
- Plain `HttpURLConnection` for networking (`data/remote/*Api.kt`) — no Retrofit/OkHttp
- Jetpack DataStore for local persistence (JWT, drafts, soft-deletes, per-message
  classification cache)

---

## Getting Started

Open in Android Studio, or from the command line:

```bash
./gradlew.bat :app:compileDebugKotlin   # or assembleDebug for a full build
```

The backend base URL is injected at build time (`BACKEND_BASE_URL` in
`app/build.gradle.kts`) and now differs by build type:

- **Debug** (what you build day to day): `http://<laptop LAN IP>:3000/api`, with the IP
  **detected automatically at build time** (the build prints `bantAI debug backend URL: …`).
  A real phone on the **same wifi** reaches the backend with no USB or `adb reverse`. That
  covers OTP, Alerts, Campaigns, and everything else. The cleartext allowlist is generated
  from the same host (`app/src/debug/network_security_config.template.xml`), so the two
  can't drift apart. Overrides:
  `-PbantaiBackendUrl=http://localhost:3000/api` (USB + `adb reverse tcp:3000 tcp:3000`) or
  `-PbantaiBackendUrl=http://10.0.2.2:3000/api` (emulator).
  - The IP is baked into the APK. **After switching networks, rebuild and reinstall.**
  - To check what the phone can reach, go to Settings → Developer Tools → **Backend connection**.
    Or open `http://<laptop IP>:3000/api/health` in the phone's browser.
  - If it's unreachable while the backend is running, Windows Firewall is probably blocking
    Node on port 3000. This often happens when the wifi is set as a "Public" network. Switch
    it to Private, or allow Node through the firewall.
  - Campus or guest wifi often has client isolation, which blocks phone-to-laptop traffic
    completely. No app change can fix that. Use a phone hotspot instead, or Tailscale:
    `-PbantaiBackendUrl=http://<laptop tailscale IP>:3000/api`. That host is added to the
    allowlist automatically.
- **Release**: requires an explicit deployed HTTPS URL and signing identity — see
  **Student test release** below. The placeholder default is rejected during packaging. Release builds have
  **no cleartext exception at all** (`app/src/main/res/xml/network_security_config.xml`), so
  pointing release at a LAN IP or an HTTP-only address will not work, by design.

---

## Authentication and optional Firebase configuration

Mobile onboarding uses a Philippine number and a six-digit Semaphore SMS code through
`/auth/request-otp` and `/auth/verify-otp`, including resend. Numbers are normalized to
`+63` format. Successful verification stores the JWT and verified phone number and
clears the previous mobile email identity. The app contains no provider API key.

Configure the backend with `MOBILE_OTP_DELIVERY=sms`, `SEMAPHORE_API_KEY`,
`SEMAPHORE_SENDER_NAME` (approved sender: `BANTAIPH`), and `OTP_HASH_SECRET`.
The Semaphore account needs credits and an active sender. Web/admin email OTP remains
separate; its Gmail configuration is retained. Phone sign-in does not automatically
transfer an existing email-only account's server data.

The Google Services and Crashlytics plugins are applied only when
`mobile/app/google-services.json` exists. Obtain that project configuration from the
team if enabling crash reporting; it remains gitignored. The current SMS OTP
flow does not require a Firebase phone-auth certificate registration.

---

## Project Structure

```
app/src/main/java/com/bantai/
├── data/           SmsRepository, local/ (DataStore-backed stores), remote/ (*Api.kt clients)
├── receiver/        SmsReceiver.kt, WapPushReceiver.kt — SMS interception
├── navigation/       NavGraph.kt, Screen.kt
├── permissions/      runtime permission helpers
├── ui/               screens/ (onboarding, main, settings), components/, theme/
├── util/             BlockHelper, NotificationHelper, SmsSender, etc.
└── viewmodel/         one ViewModel per screen/feature area
```

---

## Code Quality & Security

```bash
./gradlew.bat :app:ktlintFormat    # formatting, auto-fixes what it can
./gradlew.bat :app:ktlintCheck     # formatting, check-only
./gradlew.bat :app:detekt          # static analysis
```

Config: `.editorconfig` (ktlint), `app/detekt.yml` + `app/detekt-baseline.xml` (detekt).

Two things worth knowing before you touch either config:

- **`@Composable` functions are exempted from ktlint's naming rule** (PascalCase is the Compose
  convention — `MessageDetailScreen()`, used like a widget). This is set in `.editorconfig` and
  is a permanent, correct exception — don't remove it.
- **detekt runs against a baseline** (`app/detekt-baseline.xml`, ~340 entries) — everything
  already in the codebase when detekt was first added is grandfathered in, so only *new* issues
  in future PRs fail the build. If you fix one of the baselined issues, regenerate the baseline
  with `./gradlew.bat :app:detektBaseline` so it doesn't silently drift out of sync with the
  code.

No dependency-vulnerability scan is wired up yet — Gradle has no zero-config equivalent to
`npm audit`; adding one (e.g. OWASP dependency-check) is a deliberate follow-up, not an
oversight.

---

## Student test release

The first signed student-test artifacts were built on 2026-10-05 as `com.bantai` version 1.0
(`versionCode` 1). They use the deployed HTTPS API:

```text
https://bantai-student-backend.calmsand-1a6d5c6b.eastasia.azurecontainerapps.io/api
```

Release packaging fails closed if that URL is missing/invalid or if signing credentials are
absent. The signing key and its DPAPI-protected password are stored outside the repository in:

```text
C:\Users\MJ De Castro\AppData\Local\BantAI-deploy-tools\android-student-test-signing
```

This is a new **student-test distribution lineage**, because no prior team release keystore or
signed APK/AAB was found. Preserve the `.p12` file and password: Android updates to an installed
copy must use this same certificate. The `.clixml` password file is encrypted for the current
Windows user on this machine; copying it to a different account or machine is not a recoverable
backup. Run `Copy-BantAISigningPassword.ps1` in that directory to put the password on the
clipboard, then save it in the team's password manager and clear the clipboard. Never commit the
keystore, password, or `keystore.properties`.

To rebuild from this Windows account, run `Build-StudentRelease.ps1` in the signing
directory. It uses the hash-bound `ai/models/android_student_model_c_u8u8` bundle, imports the protected credential, temporarily sets the four
`BANTAI_RELEASE_*` environment variables and SDK path, and runs both release tasks
against the HTTPS URL above. It restores the previous environment afterward. See
`docs/deployment/ANDROID_RELEASE_EVIDENCE_2026-10-05.md` for the exact verified artifacts,
checksums, signer fingerprint, and remaining device-test boundary.

The completed 1.1 / version-code 2 student APK and AAB are distributed in
`C:\Users\MJ De Castro\Documents\bantAI Releases\2026-10-07`. The signed APK upgraded 1.0
and saved a native incoming-SMS result without an active network on the owned API 34 emulator.
Install the APK directly on Android 8 or later; the AAB requires bundle tooling. No USB or PC
connection is needed after installation. Select bantAI as the default SMS app and grant SMS
permissions; internet is required for account authentication and cloud verification.

The 1.1 student release adds real on-device Model C inference with the SentencePiece tokenizer
and a portable INT8 U8U8 model. Incoming messages first receive a quick heuristic result when
cloud verification is unavailable; WorkManager then performs local model inference. Signed-out
history scans also run the local model. Raw message text stays on the device; cloud requests
use masked text. Local results retain model version, SHA-256 and score, and cannot overwrite
cloud classifications or a user's blocked decision. Confident Scam results remain high-risk
review rather than automatically blocking a sender.

The bundle is approved for student testing only. Its evaluation reused the frozen holdout and
does not establish an independent final evaluation. See
`docs/deployment/ANDROID_OFFLINE_RELEASE_EVIDENCE_2026-10-06.md` for final build, native regression and semantic parity,
signing and device evidence. The old dummy-token `OnnxBenchmark` remains a developer tool and
is separate from `ModelCRuntime`.

---

## Authors

BS Computer Science Thesis Project, De La Salle Lipa
