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

---

## How to add an entry

Add one row per meaningful unit of work (a PR, a working-session outcome, a decision), newest at the bottom. Reference the PR number where one exists so the entry can be traced back to the actual diff.
