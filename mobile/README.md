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
`app/build.gradle.kts`) — defaults to `http://localhost:3000/api` for a USB-connected device
after `adb reverse tcp:3000 tcp:3000`; override for the emulator with
`http://10.0.2.2:3000/api`. Only `localhost`/`10.0.2.2` are cleartext-permitted — see
`app/src/main/res/xml/network_security_config.xml` before pointing at a LAN address.

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

## Authors

BS Computer Science Thesis Project, De La Salle Lipa
