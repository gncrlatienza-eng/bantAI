# BantAI — Work Breakdown Structure

**Project:** BantAI - AI-Based Campaign Intelligence and Incoming SMS Triage System
**Project ID:** THESONE-Group-7
**Version:** 1.0

Status key: `[x]` Complete · `[-]` In Progress · `[ ]` Not Started

---

## Sprint 1: Foundation & Core Backend
> Jun 26 – Jul 16, 2026 · All members

- [x] **1** Sprint 1: Foundation & Core Backend

  - [x] **1.1** Analysis: refine backlog for Sprint 1, clarify acceptance criteria
    - [x] **1.1.1** Confirm scope of core backend, database, and app scaffold for Sprint 1 *(All members)*
    - [x] **1.1.2** Finalize Prisma schema requirements for core tables *(Track A — Backend)*

  - [x] **1.2** Design: technical specifications and interface designs for Sprint 1 items
    - [x] **1.2.1** Monorepo structure design *(All members)*
    - [x] **1.2.2** Docker Compose service topology *(Track A — Backend)*
    - [x] **1.2.3** NestJS module layout *(Track A — Backend)*
    - [x] **1.2.4** Onboarding UX flow spec *(Track C — Mobile)*

  - [x] **1.3** Build: implement Sprint 1 work packages
    - [x] **1.3.1** Monorepo scaffold *(All members)*
    - [x] **1.3.2** Docker Compose: PostgreSQL + pgAdmin services *(Track A — Backend)*
    - [x] **1.3.3** Environment variables & secrets *(Track A — Backend)*
    - [x] **1.3.4** Prisma schema: User, OtpCode, SmsMessage, Classification, Alert *(Track A — Backend)*
    - [x] **1.3.5** NestJS project scaffold + OpenAPI setup *(Track A — Backend)*
    - [x] **1.3.6** Authentication endpoints (mobile number + 6-digit OTP) *(Track A — Backend)*
    - [x] **1.3.7** FastAPI ML service scaffold *(Track B — AI/ML)*
    - [x] **1.3.8** XLM-RoBERTa fine-tuning environment (dataset loading, SentencePiece) *(Track B — AI/ML)*
    - [x] **1.3.9** Draft regex privacy masking (URL/PHONE/OTP/AMOUNT) + NFKC *(Track B — AI/ML)*
    - [x] **1.3.10** Android Studio project (Kotlin) *(Track C — Mobile)*
    - [x] **1.3.11** Onboarding screens (8 screens: Loading → Default SMS App → Allow Access → Confirm Number → Enter Code → Terms & Privacy → Profile Setup → Protected) *(Track C — Mobile)*
    - [x] **1.3.12** React + Vite dashboard scaffold + Admin 2FA page *(Track D — Web Dashboard)*

  - [x] **1.4** Test: sprint-level unit and integration testing
    - [x] **1.4.1** Smoke test: end-to-end onboarding + auth flow *(All members)*
    - [x] **1.4.2** Smoke test: Prisma migrations apply cleanly *(Track A — Backend)*

  - [x] **1.5** Sprint Review & Retrospective
    - [x] **1.5.1** Sprint 1 demo (working onboarding + DB up) *(All members)*
    - [x] **1.5.2** Sprint 1 retrospective *(All members)*

---

## Sprint 2: Classification Pipeline & Mobile Inbox
> Jul 17 – Jul 24, 2026 · All members

- [x] **2** Sprint 2: Classification Pipeline & Mobile Inbox

  - [x] **2.1** Analysis: refine backlog for Sprint 2, clarify acceptance criteria
    - [x] **2.1.1** Refine classification pipeline requirements *(All members)*
    - [x] **2.1.2** Confirm confidence-threshold routing rules (0.90 / 0.50) *(Track B — AI/ML)*

  - [x] **2.2** Design: technical specifications and interface designs for Sprint 2 items
    - [x] **2.2.1** SMS ingestion API contract *(Track A — Backend)*
    - [x] **2.2.2** Classification service API design *(Track B — AI/ML)*
    - [x] **2.2.3** Mobile inbox information architecture *(Track C — Mobile)*

  - [x] **2.3** Build: implement Sprint 2 work packages
    - [x] **2.3.1** Classification API endpoint (NestJS) *(Track A — Backend)*
    - [x] **2.3.2** Message_Features + Classifications tables (Prisma models) *(Track A — Backend)*
    - [x] **2.3.3** Complete privacy masking + NFKC pipeline *(Track B — AI/ML)*
    - [x] **2.3.4** Fine-tune XLM-RoBERTa on Philippine smishing dataset (80/20 split) *(Track B — AI/ML)*
    - [x] **2.3.5** Softmax classification head (Likely Smishing / Suspicious / Unknown) *(Track B — AI/ML)*
    - [x] **2.3.6** Confidence threshold routing (≥0.90 auto-block · 0.50–0.90 alert · <0.50 inbox) *(Track B — AI/ML)*
    - [x] **2.3.7** Android SMS broadcast receiver (default SMS app) *(Track C — Mobile)*
    - [x] **2.3.8** Home Screen + Messages: Inbox screens *(Track C — Mobile)*
    - [x] **2.3.9** Suspicious Filter + Suspicious Message Detail screens *(Track C — Mobile)*
    - [x] **2.3.10** Unsafe Link + Take Action Selection screens *(Track C — Mobile)*
    - [x] **2.3.11** Admin Overview + Classification Log pages *(Track D — Web Dashboard)*

  - [x] **2.4** Test: sprint-level unit and integration testing
    - [x] **2.4.1** Unit test: privacy masking & NFKC normalization *(Track B — AI/ML)*
    - [x] **2.4.2** Unit test: threshold routing boundary cases *(Track B — AI/ML)*
    - [x] **2.4.3** Integration test: mobile → backend → ML service round trip *(All members)*

  - [x] **2.5** Sprint Review & Retrospective
    - [x] **2.5.1** Sprint 2 demo (live SMS → classification → inbox routing) *(All members)*
    - [x] **2.5.2** Sprint 2 retrospective *(All members)*

---

## Sprint 3: Clustering, Explainability, Alerts & Campaigns
> Jul 25 – Jul 31, 2026 · All members

- [x] **3** Sprint 3: Clustering, Explainability, Alerts & Campaigns

  - [x] **3.1** Analysis: refine backlog for Sprint 3, clarify acceptance criteria
    - [x] **3.1.1** Refine clustering + explainability requirements *(All members)*
    - [x] **3.1.2** Confirm SHAP indicator tag dictionary contents *(Track B — AI/ML)*

  - [x] **3.2** Design: technical specifications and interface designs for Sprint 3 items
    - [x] **3.2.1** Campaign clustering data flow spec *(Track B — AI/ML)*
    - [x] **3.2.2** Explainability output format for mobile & dashboard *(Track B — AI/ML)*
    - [x] **3.2.3** Alerts + Campaigns mobile UX spec *(Track C — Mobile)*

  - [x] **3.3** Build: implement Sprint 3 work packages
    - [x] **3.3.1** Campaign_Cluster + Explainable_Indicator + Sender_Verification_Cache tables *(Track A — Backend)*
    - [x] **3.3.2** Sender verification endpoint *(Track A — Backend)*
    - [x] **3.3.3** Link suppression API logic *(Track A — Backend)*
    - [x] **3.3.4** Cosine similarity module (threshold 0.85 against active centroids) *(Track B — AI/ML)*
    - [x] **3.3.5** HDBSCAN offline re-clustering (min_cluster_size = 5) *(Track B — AI/ML)*
    - [x] **3.3.6** SHAP integration + indicator tag mapping via curated dictionary *(Track B — AI/ML)*
    - [x] **3.3.7** Scam awareness tip lookup by cluster ID *(Track B — AI/ML)*
    - [x] **3.3.8** Alert Screen + Suspicious Alert Screen *(Track C — Mobile)* — wired to `GET /sms/alerts` + `GET /sms/:messageId/indicators`, committed (PR #33, #34). Campaign-link field on both detail screens has no backend source yet (see DEV_LOG); dropped rather than faked
    - [x] **3.3.9** Campaign Screen + Active/Inactive Campaign screens + Modal *(Track C — Mobile)* — Active + Inactive both wired to real backend (`GET /campaigns`, `GET /campaigns/inactive`, `GET /campaigns/:id`), committed
    - [x] **3.3.10** Notification screens (Threat Alert · Weekly Report · Smishing Alert · Weekly Alert) *(Track C — Mobile)* — Threat alerts tab wired to `GET /sms/alerts`; Weekly digest tab intentionally stays a labeled preview (no backend weekly-report generation exists — not a Sprint 3 item)
    - [x] **3.3.11** Settings: Scam Awareness Tips + Tip Details screens *(Track C — Mobile)* — `ScamAwarenessViewModel` derives per-user relevant tips from real `GET /sms/alerts` data; tip educational content itself is static reference text (no backend source for that content exists or is needed)
    - [x] **3.3.12** Admin Concept Drift + Campaign + Campaign Timeline pages *(Track D — Web Dashboard)*
    - [x] **3.3.13** Admin Dataset Management page *(Track D — Web Dashboard)*

  - [x] **3.4** Test: sprint-level unit and integration testing
    - [x] **3.4.1** Unit test: cosine similarity threshold logic *(Track B — AI/ML)*
    - [x] **3.4.2** Unit test: HDBSCAN grouping stability *(Track B — AI/ML)*
    - [x] **3.4.3** Integration test: SHAP output flows from ML service to mobile display *(All members)*

  - [x] **3.5** Sprint Review & Retrospective
    - [x] **3.5.1** Sprint 3 demo (grouped campaign alert with explainable indicators) *(All members)*
    - [x] **3.5.2** Sprint 3 retrospective *(All members)*

---

## Sprint 4: Web Dashboard, Report Pipeline & Retraining
> Aug 1 – Aug 7, 2026 · All members

- [-] **4** Sprint 4: Web Dashboard, Report Pipeline & Retraining

  - [-] **4.1** Analysis: refine backlog for Sprint 4, clarify acceptance criteria
    - [ ] **4.1.1** Refine report feedback pipeline requirements *(All members)*
    - [x] **4.1.2** Confirm retraining trigger thresholds (50 samples · F1 drop 5% · Page-Hinkley) *(Track B — AI/ML)*

  - [-] **4.2** Design: technical specifications and interface designs for Sprint 4 items
    - [ ] **4.2.1** Report feedback state machine (Pending / Validated / Rejected / Resolved) *(Track A — Backend)*
    - [x] **4.2.2** Retraining workflow architecture *(Track B — AI/ML)*
    - [x] **4.2.3** Model promotion + rollback design *(Track B — AI/ML)*

  - [-] **4.3** Build: implement Sprint 4 work packages
    - [ ] **4.3.1** UserReports table + report intake endpoint *(Track A — Backend)*
    - [ ] **4.3.2** Admin validate/reject endpoints *(Track A — Backend)*
    - [ ] **4.3.3** Hourly retraining trigger service (cron) *(Track A — Backend)*
    - [ ] **4.3.4** ModelVersions table + promotion/rollback logic *(Track A — Backend)*
    - [ ] **4.3.5** Automated retraining pipeline (snapshot + AdamW fine-tune) *(Track B — AI/ML)*
    - [x] **4.3.6** Reservoir sampling (Vitter's Algorithm R) *(Track B — AI/ML)*
    - [x] **4.3.7** McNemar test + F1 floor promotion gate *(Track B — AI/ML)*
    - [-] **4.3.8** Campaign evolution tracking *(Track B — AI/ML)*
    - [x] **4.3.9** TF-IDF summarization pipeline (unread threads) *(Track B — AI/ML)*
    - [-] **4.3.10** Compose Message + Unknown Filter screens *(Track C — Mobile)* — `ComposeScreen.kt` fully built (real send via `SmsManager`, drafts, outbox/sent/failed states); the "Unknown Filter" half has no `MessageFilter.UNKNOWN` case or screen yet
    - [-] **4.3.11** AI Message Summary display *(Track C — Mobile)* — `AISummaryBottomSheet.kt` wired into `MessageDetailScreen.kt` off a real suspicious/unknown signal, but verdict text + confidence % are still 100% hardcoded; no mobile client calls the AI service's `POST /summarize` (no `SummarizeApi.kt`), and the NestJS backend has no proxy route for it either (mirrors how `/classify` is proxied)
    - [-] **4.3.12** Settings: Blocked Numbers screen *(Track C — Mobile)* — `BlockedNumbersScreen.kt`/`BlockedNumbersViewModel.kt` fully built but purely device-local (`BlockedNumberContract` via `BlockHelper.kt`); not synced to the backend's `BlockedNumber` table
    - [x] **4.3.13** Admin: User Reports + FP/FN Review + Model Performance pages *(Track D — Web Dashboard)* — all three built in `web/src/pages/admin.tsx` (`AdminReportsPage`, `AdminFpFnPage`, `AdminModelPage`), routed in `AppRoutes.tsx`; mock data only, same as other already-complete admin pages (see 3.3.12/3.3.13) — web↔backend wiring is a separate, not-yet-scheduled effort
    - [x] **4.3.14** Admin: Registered Users + Export Hub + Server Monitoring + API Logs + DB Storage pages *(Track D — Web Dashboard)* — all five built (`AdminUsersPage`, `AdminExportPage`, `AdminServerPage`, `AdminApiLogsPage`, `AdminDbStoragePage`), routed; mock data only
    - [x] **4.3.15** Admin: Scam Tips + Settings + Notifications pages *(Track D — Web Dashboard)* — built (`AdminTipsPage`, `AdminSettingsPage` reused for Notifications), routed; mock data only

  - [-] **4.4** Test: sprint-level unit and integration testing
    - [ ] **4.4.1** Unit test: report intake → dataset append flow *(Track A — Backend)*
    - [x] **4.4.2** Unit test: retraining trigger evaluation logic *(Track B — AI/ML)*
    - [ ] **4.4.3** Integration test: full retraining round trip (report → validate → retrain → deploy) *(All members)*

  - [ ] **4.5** Sprint Review & Retrospective
    - [ ] **4.5.1** Sprint 4 demo (retraining trigger fires end-to-end) *(All members)*
    - [ ] **4.5.2** Sprint 4 retrospective *(All members)*

---

## Sprint 5: Integration, Hardening & Stretch Features
> Aug 8 – Aug 14, 2026 · All members

- [-] **5** Sprint 5: Integration, Hardening & Stretch Features

  - [ ] **5.1** Analysis: refine backlog for Sprint 5, clarify acceptance criteria
    - [ ] **5.1.1** Review integration issues surfaced during Sprints 2–4 *(All members)*
    - [ ] **5.1.2** Identify stretch features & remaining tech debt *(All members)*

  - [ ] **5.2** Design: technical specifications and interface designs for Sprint 5 items
    - [ ] **5.2.1** Hardening plan (security + performance) *(Track A — Backend)*
    - [ ] **5.2.2** Model refinement plan using S2–S4 collected data *(Track B — AI/ML)*

  - [-] **5.3** Build: implement Sprint 5 work packages
    - [ ] **5.3.1** End-to-end integration hardening across all seams *(All members)*
    - [x] **5.3.2** API security review + rate limiting *(Track A — Backend)*
    - [ ] **5.3.3** Performance pass on hot paths (classification, dashboard queries) *(All members)*
    - [ ] **5.3.4** Manual retraining trigger endpoint (fallback if auto is unstable) *(Track A — Backend)*
    - [ ] **5.3.5** XLM-RoBERTa refinement on data collected during S2–S4 *(Track B — AI/ML)*
    - [ ] **5.3.6** Re-evaluate HDBSCAN thresholds against real campaign data *(Track B — AI/ML)*
    - [ ] **5.3.7** Polish SHAP indicator tag dictionary based on observed outputs *(Track B — AI/ML)*
    - [ ] **5.3.8** Mobile bug bash (edge cases, low-end devices, mixed-language) *(Track C — Mobile)*
    - [ ] **5.3.9** Mobile UI polish based on dogfooding *(Track C — Mobile)*
    - [ ] **5.3.10** *(Stretch)* Client licensing/payment portal pages *(Track D — Web Dashboard)*
    - [ ] **5.3.11** Dashboard UX polish + carryover pages from earlier sprints *(Track D — Web Dashboard)*

  - [ ] **5.4** Test: sprint-level unit and integration testing
    - [ ] **5.4.1** Regression pass across all Sprint 1–4 functionality *(All members)*
    - [ ] **5.4.2** Load test: backend + ML service *(Track A — Backend)*
    - [ ] **5.4.3** Cross-device compatibility test (Android 11+) *(Track C — Mobile)*

  - [ ] **5.5** Sprint Review & Retrospective
    - [ ] **5.5.1** Sprint 5 demo (hardened, integrated build) *(All members)*
    - [ ] **5.5.2** Sprint 5 retrospective *(All members)*

---

## Sprint 6: Testing, Limited Deployment & Defense Readiness
> Aug 15 – Aug 31, 2026 · All members (deployment ~Aug 14; UAT complete by Aug 31; defense prep/buffer Sep 1 – Oct 18; final defense 3rd week of Oct)

- [ ] **6** Sprint 6: Testing, Limited Deployment & Defense Readiness

  - [ ] **6.1** Analysis: refine backlog for Sprint 6, clarify acceptance criteria
    - [ ] **6.1.1** Recruit 20 UAT participants (general Android users) *(All members)*
    - [ ] **6.1.2** Recruit 5 expert validators (IT/cybersec/software) *(All members)*
    - [ ] **6.1.3** Plan Phase-1 Limited Deployment scope *(All members)*

  - [ ] **6.2** Design: technical specifications and interface designs for Sprint 6 items
    - [ ] **6.2.1** UAT session protocol + scenarios *(All members)*
    - [ ] **6.2.2** Expert Validation protocol *(All members)*
    - [ ] **6.2.3** Deployment rollout checklist *(Track A — Backend)*
    - [ ] **6.2.4** Defense demo storyboard *(All members)*

  - [ ] **6.3** Build: implement Sprint 6 work packages
    - [ ] **6.3.1** APK signing + release build *(Track C — Mobile)*
    - [ ] **6.3.2** Backend production deployment *(Track A — Backend)*
    - [ ] **6.3.3** Dashboard production deployment *(Track D — Web Dashboard)*
    - [ ] **6.3.4** Admin credentials issuance (secure) *(Track A — Backend)*
    - [ ] **6.3.5** Quick-start guide (PDF) *(All members)*
    - [ ] **6.3.6** Defense slide deck *(All members)*

  - [ ] **6.4** Test: sprint-level unit and integration testing
    - [ ] **6.4.1** Unit testing (all modules) *(All members)*
    - [ ] **6.4.2** Integration testing across all component seams *(All members)*
    - [ ] **6.4.3** System testing: full end-to-end SMS → output flow *(All members)*
    - [ ] **6.4.4** User Acceptance Testing with 20 Android users *(All members)*
    - [ ] **6.4.5** Expert Validation with 5 experts *(All members)*
    - [ ] **6.4.6** False Positive/Negative confusion matrix on 20% held-out set *(Track B — AI/ML)*

  - [ ] **6.5** Sprint Review, Defense & Deployment
    - [ ] **6.5.1** Phase-1 Limited Deployment rollout to test group *(All members)*
    - [ ] **6.5.2** Track precision, recall, F1 in the wild *(Track B — AI/ML)*
    - [ ] **6.5.3** Live demo rehearsal (3×) *(All members)*
    - [ ] **6.5.4** Panel Q&A preparation *(All members)*
    - [ ] **6.5.5** **Final defense** — target 3rd week of Oct 2026 (Oct 19–23) *(All members)*
