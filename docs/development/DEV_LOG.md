# BantAI Development Log

## Project Modules

| Module | Description |
|--------|-------------|
| **Backend** | NestJS API server (Prisma + PostgreSQL) for SMS analysis, model inference, and data storage |
| **Dashboard** | React + Vite web dashboard for monitoring detections and system management |
| **Android** | Kotlin Android app with real-time on-device smishing detection |
| **ML** | Machine learning model training, evaluation, and export pipeline |
| **Datasets** | SMS datasets (raw, processed, labeled) used for model training |

---

## Progress Log

| Date | Module | What was done | Done by |
|------|--------|---------------|---------|
| 2026-07-03 | All | Initial commit: monorepo structure (`mobile/`, `web/`, `backend/`, `ai/`, `docs/`) + Android app phases 1–7 (onboarding flow, main screens, SMS receivers, local keyword-based detection) | Gio |
| 2026-07-09 | Backend | Backend framework setup: NestJS project scaffold, module skeletons (`sms`, `users`, `campaigns`, `reports`, `analytics`, `ai`, `health`), Prisma + PostgreSQL wiring, initial schema/migration (`User`, `SmsMessage`, `Classification`, `Alert`) | Reymark De Castro |
| 2026-07-15 | Backend | User authentication module (v1): password-based auth with Prisma and bcrypt, `auth_user` migration (PR #2, #4) | Reymark De Castro |
| 2026-07-16 | Backend | Auth v2: replaced password login with phone OTP flow (`register`, `request-otp`, `verify-otp`), JWT issuance on verification, `otp_auth` migration adding `OtpCode` model and dropping `passwordHash` (PR #5) | Reymark De Castro |
| 2026-07-17 | Dashboard | Web dashboard UI (hardcoded/mock data): landing, login, 2FA, request-access pages; client dashboard (overview, messages, campaigns, analytics, export, help, settings); admin dashboard (overview, reports, model, concept drift, dataset, classification, FP/FN, campaigns, timeline, users, export, server/API/DB logs, tips, settings) (PR #7) | Daryl De Castro |
| 2026-07-17 | Backend | Auth integration fixes: installed missing JWT/passport dependencies in `backend/` workspace, regenerated stale Prisma client, applied pending `otp_auth` migration, added `PassportModule` import, added protected `GET /auth/me` endpoint, documented `JWT_SECRET`/`JWT_EXPIRES_IN` in `.env.example`. Full OTP → JWT → protected-route flow smoke-tested end to end against a live server | Gio |
| 2026-07-17 | Docs | Documentation baseline: filled in progress log, added agile process document (`AGILE_PROCESS.md`) and auth API reference (`docs/api/auth.md`) | Gio |
| 2026-07-17 | Android | Connected mobile app to backend auth: new `AuthApi` HTTP client (request-otp, verify-otp), OTP screens registered into onboarding nav flow (Default SMS → Confirm Number → Enter Code → Profile), JWT + phone saved to DataStore, loading/error states on auth screens, INTERNET permission + dev-only cleartext config for localhost/10.0.2.2 | Gio |
| 2026-07-17 | Backend | Profile sync: implemented `users` module with JWT-guarded `PUT /users/me` (updates firstName/lastName/email), registered `UsersModule` in app module | Gio |
| 2026-07-17 | Android | Profile screen syncs name to backend on Continue using stored JWT, so the `User` row is fully populated (phone + names). Verified end to end on a physical device (Huawei VOG-L29 via USB + `adb reverse`): OTP login recorded the phone number and profile names in Postgres | Gio |
| 2026-07-18 | Android | Onboarding restyle to match interior iOS-minimal look: new shared components (`OnboardingComponents.kt` — PrimaryButton, PillTextField, OnboardingHeader, GroupedCard, AccentIconTile, FeatureListRow); all five active onboarding screens converted to full-bleed black, 32sp large titles, muted uppercase eyebrows, borderless pill inputs, grouped SurfaceElevated cards with hairline dividers, sentence-case buttons. Default-SMS screen rebuilt from floating card to full-bleed page. Verified full flow on device | Gio |
| 2026-07-18 | Android | Sender avatars replaced with neutral iOS-style silhouette (`SenderAvatar.kt`): gray person placeholder everywhere (system senders like GLOBE always get it); shows the contact's photo only when one is set (new `READ_CONTACTS` permission + cached ContactsContract lookup). Applied in Messages list, Home recent messages, and conversation bubbles | Gio |
| 2026-07-18 | Android | Conversation detail upgrades: unknown-classification threads show "Suspicious messages detected — tap to report" banner routing to the report flow; AI Summary button now always visible on every conversation (legit included), opening `AISummaryBottomSheet` with a verdict variant ("Suspicious 68%" vs "Looks safe 92%" — content still mock, pending backend AI wiring) | Gio |
| 2026-07-18 | Docs | Doc sync for earlier pushes that shipped without doc updates: rewrote `backend/README.md` (password-auth era → current OTP/JWT auth, users endpoint, correct Docker port 5433 + `--schema` migration commands, JWT env vars), linked users API reference from root README | Gio |
| 2026-07-18 | Android | Collapsing tab bar (`MainScreen.kt`): the floating glass bar now rests as a single extra-translucent pill showing only the active tab (with alert dot when off the Alerts tab); tapping the pill expands the full four-tab bar, selecting a tab navigates and collapses it again, and tapping outside the expanded bar dismisses it. Animated with `animateContentSize`; state survives rotation. Verified on device | Gio |
| 2026-07-20 | Docs | SMS ingestion API contract (`docs/api/sms.md`): defined `POST /api/sms/ingest` request/response shape, routing rules (≥0.90 blocked · 0.50–0.89 alert · <0.50 inbox), and error responses | Reymark De Castro |
| 2026-07-20 | Backend | `MessageFeature` Prisma model added to schema: stores `normalizedBody` and `maskedBody` per SMS for ML auditability; migration `add_message_features` | Reymark De Castro |
| 2026-07-20 | Backend | SMS ingestion endpoint implemented (`POST /api/sms/ingest`, JWT-guarded): stores raw SMS, runs placeholder preprocessing + keyword classifier, writes `MessageFeature` + `Classification` rows, returns label/score/action; `SmsModule` registered in `AppModule` | Reymark De Castro |
| 2026-07-20 | Backend | Fixed Prisma ↔ Docker DB connectivity: diagnosed three-layer bug (UTF-8 BOM in pg_hba.conf blocking all reloads, auth method mismatch scram-sha-256 vs md5, and native Windows postgres.exe on port 5433 intercepting connections before Docker); changed Docker port mapping to `5434:5432`, updated `.env` and `.env.example`; `PrismaService` now passes `DATABASE_URL` explicitly via constructor override. Full auth→ingest flow smoke-tested end-to-end | Reymark De Castro |
| 2026-07-21 | Backend | Backend audit, bug fixes, and unit test suite (49 tests, all passing). Bugs fixed: (1) old OTPs not invalidated on re-request — added `updateMany` to mark previous codes verified before issuing a new one, preventing OTP replay; (2) `[URL]` keyword in placeholder classifier was uppercase while comparison ran on lowercase input, making "Likely Smishing" label unreachable — corrected to `[url]`; (3) `@prisma/client` moved from devDependencies to dependencies (was missing from production installs); (4) added `@MaxLength(64)` to `IngestSmsDto.sender`. Unit tests written for `AuthService` (register, requestOtp, verifyOtp, getMe), `SmsService` (ingest, preprocess, classify, route — including all threshold boundary cases), `UsersService` (updateMe), and all three controllers (AuthController, SmsController, UsersController) | Reymark De Castro |

---

## How to add an entry

Add one row per meaningful unit of work (a PR, a working-session outcome, a decision), newest at the bottom. Reference the PR number where one exists so the entry can be traced back to the actual diff.
