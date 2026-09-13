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

- **Debug** (what you build day to day): `http://localhost:3000/api` for a USB-connected device
  after `adb reverse tcp:3000 tcp:3000`; override for the emulator with
  `http://10.0.2.2:3000/api`. Cleartext to `localhost`/`10.0.2.2` is permitted only for debug
  builds — see `app/src/debug/res/xml/network_security_config.xml`.
- **Release**: intentionally points at `https://api.bantai.invalid/api`, a placeholder that
  cannot resolve, until a real backend exists — see **Deployment** below. Release builds have
  **no cleartext exception at all** (`app/src/main/res/xml/network_security_config.xml`), so
  pointing release at a LAN IP or an HTTP-only address will not work, by design.

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

## Deployment

Not yet possible end-to-end — two things need to happen first, tracked under Sprint 6 in
`docs/development/WBS.md`:

1. **Signing (WBS 6.3.1, not started).** No `signingConfigs` block exists in
   `app/build.gradle.kts`, so `assembleRelease` currently produces
   `app-release-unsigned.apk` — it cannot be installed anywhere as-is. Generating and wiring a
   release keystore is a deliberate, one-time team decision (whoever holds the keystore controls
   all future signed updates), not something to improvise per-build. **Never commit the
   keystore or its passwords to this repo** — reference them via `~/.gradle/gradle.properties`
   or environment variables in the signing config once it's added.
2. **A real backend to point at (WBS 6.3.2, not started).** `BACKEND_BASE_URL` for release is
   deliberately the non-functional placeholder above until the backend is actually deployed
   somewhere reachable over real HTTPS with a valid certificate. Once it is, update the
   `release { buildConfigField(...) }` entry in `app/build.gradle.kts` to the real address —
   self-signed certs or plain LAN IPs will not work against a release build's network security
   config as it stands.

If UAT (WBS 6.1–6.4, 20 general Android users) is happening on a **debug** build instead of a
signed release (likely, until #1 above is done): the debug-only "Simulate incoming SMS" tool in
Settings will be visible to testers (harmless, but worth knowing), and testers' devices still
need real network access to wherever the backend ends up deployed — `adb reverse`/`10.0.2.2`
only work for a USB-tethered device or an emulator, not for 20 independent phones.

Everything else — code correctness, input validation, the security fixes from this project's
pentest pass (JWT storage, tapjacking, screenshot protection, exported-receiver hardening) — is
already in place and verified (`ktlintCheck`/`detekt`/`compileDebugKotlin`/`compileReleaseKotlin`
all pass, and a minified release build assembles cleanly). The two items above are deployment
logistics, not code gaps.

---

## Authors

BS Computer Science Thesis Project, De La Salle Lipa
