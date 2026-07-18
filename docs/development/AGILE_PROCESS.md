# BantAI Agile Process

This document records how the team works and serves as proof of process for the project. It is kept up to date as the process evolves.

**Team:** Group 7 — DLSL CITE
**Methodology:** Agile (Scrum-style iterations with feature-branch Git workflow)

---

## 1. Workflow

### Branching strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, production-ready code. Only receives merges from `develop` or reviewed PRs. |
| `develop` | Integration branch. Feature work is merged here first and tested together. |
| `feature/xxx` | New features (e.g. `feature/website-dashboard-hardcoded`). |
| `bugfix/xxx` | Bug fixes. |

### Definition of done

A work item is considered done when:

1. Code compiles/type-checks with no errors.
2. The affected flow has been exercised end to end (not just unit tests) — e.g. the OTP auth flow was verified by running the server and driving `request-otp` → `verify-otp` → `GET /auth/me` with a real token.
3. Database schema changes ship as a Prisma migration, applied and verified.
4. The change is merged via pull request into `develop`, then to `main`.
5. A row is added to [DEV_LOG.md](DEV_LOG.md) describing what was done and by whom.

### Documentation rule

Every process/iteration produces an artifact:

- **DEV_LOG.md** — one row per unit of work (the running proof-of-work record).
- **docs/api/** — endpoint reference for anything the frontend/mobile teams consume.
- **docs/research/** — ML experiments, dataset notes.
- This file — updated when the process itself changes.

---

## 2. Iteration record (to date)

### Iteration 0 — Project setup & mobile UI (Jul 3, 2026)

**Goal:** establish repo structure and the Android app foundation.

- Monorepo created: `mobile/`, `web/`, `backend/`, `ai/`, `docs/`.
- Android app phases 1–7: splash + onboarding (terms, phone confirmation, OTP code entry, permissions, default-SMS-app setup, profile, protected), main screens (home, messages, alerts, campaigns, threat analysis, blocked numbers, compose), SMS infrastructure (`SmsReceiver`, `WapPushReceiver`, `HeadlessSmsSendService`), local keyword-based detection heuristics.

### Iteration 1 — Backend foundation (Jul 9, 2026)

**Goal:** stand up the API server and data model.

- NestJS backend scaffold with module skeletons: `sms`, `users`, `campaigns`, `reports`, `analytics`, `ai`, `health`.
- Prisma + PostgreSQL integration; initial schema: `User`, `SmsMessage`, `Classification`, `Alert`.
- Merged via PR #2/#3.

### Iteration 2 — Authentication (Jul 15–16, 2026)

**Goal:** working user authentication for the mobile app and dashboard.

- v1 (Jul 15): password-based auth with bcrypt (PR #4).
- v2 (Jul 16): pivoted to phone-OTP authentication — passwords removed as the product targets mobile users identified by phone number. Endpoints: `POST /auth/register`, `POST /auth/request-otp`, `POST /auth/verify-otp` issuing a JWT. `OtpCode` model added, `passwordHash` dropped (PR #5).
- **Decision:** OTP delivery is `console.log` only during development to avoid SMS costs; a provider (Semaphore/Twilio) will be integrated behind an env flag before launch.

### Iteration 3 — Dashboard UI & auth hardening (Jul 17, 2026)

**Goal:** complete dashboard UI shell; make backend auth actually runnable for frontend integration.

- Web dashboard implemented with hardcoded mock data (React 19 + Vite + React Router): public pages, full client dashboard, full admin dashboard (~25 routes) (PR #7).
- Backend auth integration fixes: JWT/passport dependencies installed in the correct workspace, Prisma client regenerated, pending `otp_auth` migration applied, protected `GET /auth/me` endpoint added, JWT env vars documented. Flow verified end to end against a live server.
- Documentation baseline created (this file, DEV_LOG entries, auth API reference).

### Iteration 4 — Mobile auth integration (Jul 17, 2026)

**Goal:** connect the Android app's onboarding to the backend so a real device login is recorded in the database.

- New `AuthApi` client in the app (plain `HttpURLConnection`, no added dependencies) calling `request-otp` / `verify-otp`; JWT and phone number persisted in DataStore.
- Discovered the OTP screens (`OnboardingConfirmNumberScreen`, `OnboardingEnterCodeScreen`) existed but were never registered in `NavGraph` — registered them into the flow: Default SMS → Confirm Number → Enter Code → Profile → Protected.
- Added loading spinners and server error messages to the auth screens; "Resend code" wired up.
- Manifest: INTERNET permission; network security config allows cleartext only for `localhost` / `10.0.2.2` (dev machines).
- Backend: implemented the `users` module — JWT-guarded `PUT /users/me` updating `firstName`/`lastName`/`email`; the app's Profile screen now syncs the entered name to the backend, so the `User` row is fully populated instead of phone-only.
- **Verified on a physical device** (Huawei VOG-L29, USB + `adb reverse tcp:3000 tcp:3000`): OTP generated, verified, JWT issued, user row created/updated in Postgres with phone and names.
- **Dev workflow note:** apps reach the local backend via `adb reverse` (USB) or `10.0.2.2` (emulator); OTP codes are read from the backend console.

### Iteration 5 — Mobile UI polish & doc sync (Jul 18, 2026)

**Goal:** make the whole app read as one product (onboarding vs main screens), improve conversation-level affordances, and bring stale docs back in line with the code.

- Onboarding restyled to match the interior screens' iOS-minimal look: new shared composables in `ui/components/OnboardingComponents.kt` (PrimaryButton, PillTextField, OnboardingHeader, GroupedCard, AccentIconTile, FeatureListRow); all five active onboarding screens converted to full-bleed black with 32sp large titles, muted uppercase eyebrows, borderless pill inputs, and grouped cards with hairline dividers. The Default-SMS screen was rebuilt from a floating dialog-style card into a full-bleed page.
- Sender avatars: colored initials replaced by a neutral gray person-silhouette placeholder (`SenderAvatar.kt`). Contact photos are shown only when the user actually set one (new `READ_CONTACTS` permission + cached `ContactsContract` lookup); system senders (GLOBE, NDRRMC, shortcodes) always get the placeholder.
- Conversation detail: unknown-classification threads now show a "Suspicious messages detected — tap to report" banner routing into the existing report flow; the AI Summary button is always visible on every conversation and opens `AISummaryBottomSheet` with a verdict variant (suspicious vs looks-safe). Sheet content is still mock text pending backend AI integration.
- **Doc sync:** `backend/README.md` had drifted badly (still documented password auth and register/login endpoints several pushes after the OTP pivot) — rewritten to current state (OTP/JWT endpoints, users endpoint, Docker port 5433, `--schema` Prisma commands, JWT env vars). Root README links both API references.
- **Verified on device:** full onboarding flow re-run after `pm clear`; avatars, report banner, and both AI-summary verdicts screenshotted on the Huawei VOG-L29.

### Next iteration (planned)

- Wire the web dashboard login to the real auth API (`/auth/request-otp` → `/auth/verify-otp`, store JWT, validate via `/auth/me`).
- Collect email during onboarding or profile edit and sync via `PUT /users/me`.
- Begin `sms` module (message ingestion) and AI service integration (currently a stub returning a fixed classification); back the AI Summary sheet with real per-conversation analysis.
- Integrate a real SMS provider for OTP delivery behind an env flag before launch.

---

## 3. Pull request log

| PR | Date | Branch | Summary |
|---|---|---|---|
| #2/#3 | 2026-07-09 | `develop` → `main` | Backend framework setup |
| #4 | 2026-07-15 | `develop` → `main` | Password-based auth module |
| #5 | 2026-07-16 | — | OTP authentication, password login removed |
| #6 | 2026-07-17 | `develop` → `main` | Integration merge |
| #7 | 2026-07-17 | `feature/website-dashboard-hardcoded` → `main` | Hardcoded website dashboard |
