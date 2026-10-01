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
- **Release**: intentionally points at `https://api.bantai.invalid/api`, a placeholder that
  cannot resolve, until a real backend exists — see **Deployment** below. Release builds have
  **no cleartext exception at all** (`app/src/main/res/xml/network_security_config.xml`), so
  pointing release at a LAN IP or an HTTP-only address will not work, by design.

---

## Firebase Setup (required to build)

Phone-number sign-in uses Firebase Phone Authentication (the backend's `POST /auth/mobile/firebase`
verifies the resulting ID token — see `docs/api/auth.md`). This means, unlike Crashlytics,
**`google-services.json` is now required for `mobile/` to compile at all**, not just for a feature
to work — `OnboardingViewModel.kt` references Firebase Auth classes unconditionally.

1. Get `mobile/app/google-services.json` for the shared `bantai-f5eed` Firebase project from
   whoever holds/distributes it (ask Gio) — it's per-project config, not a secret, but is
   intentionally gitignored so it isn't hardcoded per environment. Place it at `mobile/app/`.
2. Its `project_id` must match the backend's `FIREBASE_PROJECT_ID` env var exactly, or every
   phone-auth token exchange will 401 even though both sides look individually correct.
3. For local dev without burning real SMS: add test phone numbers + fixed codes under Firebase
   Console → Authentication → Sign-in method → Phone → "Phone numbers for testing" (e.g.
   `+639171234567` → `123456`). Entering that number/code pair always succeeds without Firebase
   sending anything.
4. Real-device testing needs the app's signing certificate's SHA-1 (and ideally SHA-256) added to
   the Firebase Android app config (Firebase Console → Project settings → Your apps) — required
   for Play Integrity–based silent verification. Add the debug keystore's SHA-1 at minimum
   (`keytool -list -v -keystore ~/.android/debug.keystore`, password `android`); add release
   signing's SHA before any release build ships real phone auth.

Without `google-services.json` present, `:app:compileDebugKotlin` fails with "Unresolved
reference" errors on `FirebaseAuth`/`PhoneAuthProvider`/etc. — this is expected, not a bug.

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
