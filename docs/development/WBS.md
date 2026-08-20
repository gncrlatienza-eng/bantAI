# BantAI — Work Breakdown Structure

**Project:** BantAI - AI-Based Campaign Intelligence and Incoming SMS Triage System
**Project ID:** THESONE-Group-7
**Version:** 1.0

Status key: `[x]` Complete · `[-]` In Progress · `[ ]` Not Started

Track ownership: Track A — Backend (Reymark De Castro) · Track B — AI/ML (Maxene) · Track C — Mobile (Gio) · Track D — Web Dashboard (Daryl De Castro)

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

- [x] **4** Sprint 4: Web Dashboard, Report Pipeline & Retraining

  - [x] **4.1** Analysis: refine backlog for Sprint 4, clarify acceptance criteria
    - [x] **4.1.1** Refine report feedback pipeline requirements *(All members)* — never formally run as its own pass, but its scope was fully absorbed by downstream work that shipped without it: the Pending/Validated/Rejected/Resolved state machine (4.2.1) and the intake/validate/reject endpoints (4.3.1) both landed and have been exercised live end to end (4.4.3/4.5.1) with no unresolved requirements gap surfacing. Retroactively closed 2026-08-18 rather than left open with nothing left to refine
    - [x] **4.1.2** Confirm retraining trigger thresholds (50 samples · F1 drop 5% · Page-Hinkley) *(Track B — AI/ML)*

  - [x] **4.2** Design: technical specifications and interface designs for Sprint 4 items
    - [x] **4.2.1** Report feedback state machine (Pending / Validated / Rejected / Resolved) *(Track A — Backend)* — built as a 3-state machine (`Pending → Validated | Rejected`, `schema.prisma` line 181, `ReportsController`'s `validate`/`reject`); the fourth state named in this task's own title, `Resolved`, was never implemented — no such endpoint or status value exists anywhere in `reports.*`. Not treated as unfinished: the 3-state version is what 4.3.1/4.3.2 actually shipped, and it's the version exercised live end to end (4.4.3/4.5.1). Flagged here rather than silently left as a mismatch between the task title and the code
    - [x] **4.2.2** Retraining workflow architecture *(Track B — AI/ML)*
    - [x] **4.2.3** Model promotion + rollback design *(Track B — AI/ML)*

  - [x] **4.3** Build: implement Sprint 4 work packages
    - [x] **4.3.1** UserReports table + report intake endpoint *(Track A — Backend)* — `UserReport` Prisma model + migration, `ReportsModule` (`POST /api/reports`, `GET /api/reports`, `GET /api/reports/pending`), landed PR #39 (`2168c28`), merged to `develop` 2026-08-12
    - [x] **4.3.2** Admin validate/reject endpoints *(Track A — Backend)* — `PATCH /api/reports/:id/validate` + `PATCH /api/reports/:id/reject`, same PR
    - [x] **4.3.3** Hourly retraining trigger service (cron) *(Track A — Backend)* — `RetrainingModule` with `@Cron(EVERY_HOUR)` checking the 50-report/F1-drop/Page-Hinkley conditions, same PR
    - [x] **4.3.4** ModelVersions table + promotion/rollback logic *(Track A — Backend)* — `ModelVersion` Prisma model + migration, `ModelsModule` (`POST /api/models`, `GET /api/models`, `GET /api/models/active`, `POST /api/models/:id/activate`, `POST /api/models/:id/rollback`), same PR
    - [x] **4.3.5** Automated retraining pipeline (snapshot + AdamW fine-tune) *(Track B — AI/ML)* — complete end to end. **Report ingestion reads the live table:** `DatabaseReportSource` hits `GET /api/reports` (ApiKeyGuard) and keeps `status == "Validated"`, mapping `message.body`→text, `reportedLabel`→label, `id`→report_id, `updatedAt`→validated_at; it drops in behind the existing `fetch`/`describe` interface with zero change to `snapshot.py` or `pipeline.py`, which is what that seam was for. Verified against a running backend, not just stubs: three seeded reports (one Validated, one Pending, one Rejected) produced `1 of 3` and the snapshot's Scam count rose by exactly one, and a wrong API key failed loudly rather than reporting zero. Three deliberate choices, each documented at its site: the Validated filter runs **client-side** (`ReportsService` has only `findAll()`/`findPending()`); `validated_at` is really Prisma's `@updatedAt`, a proxy exact only if Track A adds a `validatedAt` column; and **failures raise rather than degrade**, the opposite of `centroid_source.py`, because an empty report list is indistinguishable from "no corrections were filed". **First real GPU fine-tune run 2026-08-17** (Colab T4, `ai/evaluation/retraining_run_2026-08-17.json`): 14,928 rows, 0 reports, gate says **promote** — macro-F1 0.9520 → 0.9648, 97 fixes vs 44 regressions, p=0.0000095. **Nothing was promoted** — that is a separate decision now with the adviser, because campaign centroids are tied to the checkpoint that made them and a swap invalidates every Sprint 5 threshold number (see 5.3.6). Merged to `develop` via PR #52 (`75310ad`), 2026-08-18
    - [x] **4.3.6** Reservoir sampling (Vitter's Algorithm R) *(Track B — AI/ML)*
    - [x] **4.3.7** McNemar test + F1 floor promotion gate *(Track B — AI/ML)*
    - [x] **4.3.8** Campaign evolution tracking *(Track B — AI/ML)*
    - [x] **4.3.9** TF-IDF summarization pipeline (unread threads) *(Track B — AI/ML)*
    - [x] **4.3.10** Compose Message + Unknown Filter screens *(Track C — Mobile)* — both halves built: `ComposeScreen.kt` (real send via `SmsManager`, drafts, outbox/sent/failed states) and a real `MessageFilter.UNKNOWN` case wired into `MessagesViewModel.kt`/`MessagesScreen.kt` (filters on the already-real `classification == "unknown"` bucket, same data source Alerts/Notifications already use). Merged to `develop` via PR #46 (`bc30c48`)
    - [x] **4.3.11** AI Message Summary display *(Track C — Mobile + Backend)* — real end to end: new `POST /api/ai/summarize` proxy (`AiController`/`AiService`, JWT-guarded) forwards to the AI service's existing `POST /summarize`; new `SummarizeApi.kt` calls it from `MessageDetailScreen.kt` with the real thread bodies once the sheet opens; `AISummaryBottomSheet.kt` renders that real extractive summary (with a loading state) instead of the old hardcoded paragraphs, and the fabricated "68%/92% confidence" line is removed — the verdict badge (Suspicious/Looks safe) was already real, derived from stored classification. Backend: 167/167 tests pass (was 152). Merged to `develop` via PR #46 (`bc30c48`)
    - [x] **4.3.12** Settings: Blocked Numbers screen *(Track C — Mobile + Backend)* — synced both directions: new backend `BlockedNumbersModule` (`GET/POST /api/blocked-numbers`, `DELETE /api/blocked-numbers/:sender`, JWT-guarded — the table existed since Sprint 3 but had no controller) plus a reconciliation pass in `BlockedNumbersViewModel.kt` that applies backend-known blocks to the device's `BlockedNumberContract` and pushes device-only blocks (e.g. from the offline local-heuristic path) up to the backend; unblocking now calls both sides. Merged to `develop` via PR #46 (`bc30c48`)
    - [x] **4.3.13** Admin: User Reports + FP/FN Review + Model Performance pages *(Track D — Web Dashboard)* — all three built in `web/src/pages/admin.tsx` (`AdminReportsPage`, `AdminFpFnPage`, `AdminModelPage`), routed in `AppRoutes.tsx`; mock data only, same as other already-complete admin pages (see 3.3.12/3.3.13) — web↔backend wiring is a separate, not-yet-scheduled effort
    - [x] **4.3.14** Admin: Registered Users + Export Hub + Server Monitoring + API Logs + DB Storage pages *(Track D — Web Dashboard)* — all five built (`AdminUsersPage`, `AdminExportPage`, `AdminServerPage`, `AdminApiLogsPage`, `AdminDbStoragePage`), routed; mock data only
    - [x] **4.3.15** Admin: Scam Tips + Settings + Notifications pages *(Track D — Web Dashboard)* — built (`AdminTipsPage`, `AdminSettingsPage` reused for Notifications), routed; mock data only

  - [x] **4.4** Test: sprint-level unit and integration testing
    - [x] **4.4.1** Unit test: report intake → dataset append flow *(Track A — Backend)*
    - [x] **4.4.2** Unit test: retraining trigger evaluation logic *(Track B — AI/ML)*
    - [x] **4.4.3** Integration test: full retraining round trip (report → validate → retrain → deploy) *(All members)* — built, unit-tested, and run live against real Docker Postgres + backend + AI service; all five stages passed. Two real gaps closed: **(1)** the backend's hourly cron already POSTed to `${AI_SERVICE_URL}/retrain`, but the AI service had no such route and the 404 was swallowed as a warning — now `POST /retrain` records the request and queues it (no GPU on the serving host), and `GET /retrain/jobs` reads the queue back. **(2)** `ModelVersions` stayed empty forever — `pipeline.py` scored a candidate and stopped, never telling the backend, so the backend's own F1-degradation trigger and rollback route were dead code (`activeModel` always `null`); `scripts/retrain.py --register`/`--activate` now do, and `version.json` travels with a checkpoint so `GET /health` reports which version is serving. `--activate` refuses a rejected candidate; activating a `ModelVersion` row still isn't a redeploy — pointing the live model at `<candidate_dir>` stays a manual step, on purpose. **Verified live 2026-08-18** via `scripts/round_trip.py`: seeded one Validated/Pending/Rejected report directly in Postgres, `DatabaseReportSource` kept only the Validated one and a wrong API key 401'd loudly, `POST /retrain` returned 202 and deduped a repeat trigger to the same job, the promotion gate ran for real and produced a real decision, and a `vROUNDTRIP-TEST-...` `ModelVersion` was registered, confirmed never activated, and cleaned up. Also gave `ModelVersions` its first real row the same session — the currently deployed 2026-07-29 checkpoint (macro-F1 0.9438), confirmed via `GET /health` and `GET /api/models/active`, so the F1-degradation trigger and rollback route are live code now. Found/fixed one bug during the live run (scratch directory didn't exist before the gate wrote `disagreements.json`). Suite: 373 → 397, all green. **Unblocks 4.5.1.** Merged to `develop` via PR #53 (`72b78a8`), 2026-08-18

  - [x] **4.5** Sprint Review & Retrospective
    - [x] **4.5.1** Sprint 4 demo (retraining trigger fires end-to-end) *(All members)* — verified live 2026-08-18, independently re-run (not just taken on Maxene's write-up): `docker compose up -d` + `npm run start:dev` + AI service on :8001, `ai/scripts/round_trip.py` executed against real Postgres/backend/AI service. All 5 stages passed — seeded report→validate, `DatabaseReportSource` kept exactly the Validated report and a wrong key 401'd loudly, `POST /retrain` queued and deduped a repeat trigger, `GET /retrain/jobs` showed it, the promotion gate ran for real and correctly refused to promote identical checkpoints, a test `ModelVersion` registered and confirmed never activated. Two environment-only gaps hit and fixed along the way (not code bugs): local DB was missing the Sprint 4 migration (`npx prisma migrate deploy` applied it), and `round_trip.py`'s default `--api-key` doesn't match this machine's real `INTERNAL_API_KEY` (passed explicitly). Test `ModelVersion` row cleaned up after
    - [x] **4.5.2** Sprint 4 retrospective *(All members)* — held 2026-08-18. **Went well:** Build, Test, and Demo all closed and independently verified this sprint (4.3, 4.4, 4.5.1) rather than taken on a single contributor's word — the retraining round trip was re-run live against real infra a second time, by a different person, and matched every claim. **Known limitation carried forward, not a Sprint 4 blocker:** the mobile app has no deployed backend to talk to yet — every screen that hits the API (Alerts and Campaigns are the ones the team actually dogfoods, so they're where this is felt) only works while the phone is tethered to the dev laptop, via `adb reverse tcp:3000 tcp:3000` on USB or the `10.0.2.2` loopback on an emulator (`mobile/.../ApiConfig.kt`). No on-device model and no timeline yet for one — classification and retraining both stay laptop-hosted for now. This is in scope, not overlooked: real deployment is explicitly Sprint 6 work ("Distribute app via APK to test group," Phase 1: Limited Deployment), so it doesn't block calling Sprint 4 or moving into Sprint 5

---

## Sprint 5: Integration, Hardening & Stretch Features
> Aug 8 – Aug 14, 2026 · All members

- [-] **5** Sprint 5: Integration, Hardening & Stretch Features

  - [ ] **5.1** Analysis: refine backlog for Sprint 5, clarify acceptance criteria
    - [ ] **5.1.1** Review integration issues surfaced during Sprints 2–4 *(All members)*
    - [ ] **5.1.2** Identify stretch features & remaining tech debt *(All members)*

  - [ ] **5.2** Design: technical specifications and interface designs for Sprint 5 items
    - [ ] **5.2.1** Hardening plan (security + performance) *(Track A — Backend)*
    - [x] **5.2.2** Model refinement plan using S2–S4 collected data *(Track B — AI/ML)* — `ai/REFINEMENT_PLAN.md`. S2–S4 data is the 1,050 + 447 real phone-inbox messages added 2026-07-30 (15,728 → 16,772 rows, 14,928 after masked-text de-dup), no relabeling in that window. Refinement reuses Sprint 4's retraining pipeline unchanged (snapshot → fine-tune → score → gate) rather than a second training implementation — and that run has already happened (4.3.5, 2026-08-17): macro-F1 0.9520 → 0.9648, gate says promote. So 5.3.5's execution is done; what's left is the promotion decision itself, gated on the same adviser sign-off already tracked under 5.3.6 (campaign centroids are tied to the checkpoint that made them)

  - [-] **5.3** Build: implement Sprint 5 work packages
    - [ ] **5.3.1** End-to-end integration hardening across all seams *(All members)*
    - [x] **5.3.2** API security review + rate limiting *(Track A — Backend)*
    - [ ] **5.3.3** Performance pass on hot paths (classification, dashboard queries) *(All members)*
    - [ ] **5.3.4** Manual retraining trigger endpoint (fallback if auto is unstable) *(Track A — Backend)*
    - [ ] **5.3.5** XLM-RoBERTa refinement on data collected during S2–S4 *(Track B — AI/ML)*
    - [-] **5.3.6** Re-evaluate HDBSCAN thresholds against real campaign data *(Track B — AI/ML)* — measured; the manuscript's Stage 5b match threshold **0.85 does not hold**: it attaches 54.5% of *unrelated* messages, because the shared classifier embedding encodes class rather than campaign (unrelated Scam pairs average 0.90 cosine). Re-calibrated to **0.999** (93.8% of real members kept, 2.6% false attachment) plus three fixes: masked-text de-duplication of the clustering population (10% were duplicates, 59% of duplicate groups spanning multiple source corpora), explicit `min_samples=2` (sklearn was silently coupling it to `min_cluster_size`), and honest `unique_senders` reporting (was a fabricated `1`; the population has no sender data at all). New scripts: `compare_campaign_embeddings.py`, `calibrate_match_threshold.py`, `tune_clustering.py`. **Follow-up (`222ac7f`, merged to `develop` via PR #42):** 0.999 leaves only ~0.0008 of usable margin and would degrade *silently* if Sprint 4's retraining shifted the embedding, so a second independent signal was added — `service/lexical.py` (word shingles + domain matching) corroborating a relaxed embedding score via a three-tier rule (`domain` / `hybrid` / `embedding`). The third tier is exactly the pre-existing 0.999 rule, so the change is **monotone** — nothing previously matched can regress. Gates measured by `calibrate_hybrid_match.py` under **two independent ground truths** to avoid calibrating a wording gate on wording-defined groups; on the non-circular one it buys **+5.2pp recall for +0.6pp false matches**. **Stays `[-]`:** three items need adviser sign-off — (1) the 0.85→0.999 change deviates from a manuscript-stated value, (2) de-dup at `min_cluster_size=5` produces a 27.4% blob (left visible behind a tightened sanity check rather than silently retuned), (3) the hybrid second signal is an addition the manuscript does not describe. Also **newly surfaced:** only 44.4% of an HDBSCAN cluster's own members re-match their own centroid at 0.999 — the offline pass is producing clusters the fast path cannot recognise, a second argument that `min_cluster_size` needs settling. Backend blocker: `CampaignCluster` has no `lexical` column yet, so the backend centroid path stays embedding-only until that migration lands. **Fourth open item (2026-08-13):** re-centering the embedding before comparison was measured and **beats the current raw embedding under both independent referees** — `centered` gives +20.2pp recall on the non-circular hdbscan grouping (44.4% → 64.6%) at the same 2.6% false-match rate, and needs only a stored mean vector. Verified as a bracket after the earlier lexical-only run proved biased: `abtt-5` reads 99.8% under the friendly referee but 61.9% under the hostile one, so the "thousandfold-wider margin" claim rests on the biased referee alone and is suggestive, not established. **Not adopted** — the mean is a fitted artifact needing re-fitting on every Sprint 4 retrain plus full threshold re-calibration, and it deviates from the manuscript's 0.85 further than 0.999 does. Documented for adviser sign-off alongside the three items above. See `ai/PIPELINE.md` § "Stage 5b — measured limits"
    - [x] **5.3.7** Polish SHAP indicator tag dictionary based on observed outputs *(Track B — AI/ML)* — measured, not just re-reviewed: `scripts/analyze_indicator_coverage.py` runs the keyword tagger over every labeled Spam/Scam row. Spam's 84.9% zero-tag rate is expected (most Spam is ordinary marketing, not deceptive, so it correctly gets no scam indicator). Scam's 48.6% zero-tag rate was the real gap — traced to a second wave of Tagalog online-betting vocabulary (W+, T1BET, Epicwin, Betso88, COD63/COD99-style schemes) distinct from the existing `GAMBLING_HARD` terms, plus a phishing-phrasing gap ("...to avoid Deactivation") the existing "will be deactivated" entry didn't cover. Both added to `indicator_tags.py` with measured frequencies and a Ham false-positive check (<0.1%). **Result: Scam zero-tag rate 48.6% → 40.0%.** Deliberately not chased further this round — the remaining tail is one-off wordings, not another concentrated cluster. `test_indicator_tags.py` 17 → 20 tests
    - [-] **5.3.8** Mobile bug bash (edge cases, low-end devices, mixed-language) *(Track C — Mobile)* — code-complete, not yet committed (per the "never mark `[x]` on uncommitted work" rule above) and live emulator verification is blocked by an environment issue (see 5.4.3). Two Explore passes audited the full `mobile/app/src/main/java/com/bantai/` tree and surfaced concrete findings, all independently re-confirmed against current source before fixing (not taken on the audit's word). Fixed: `SmsReceiver.kt` — a non-null-but-empty message array from a failed multipart PDU threw `NoSuchElementException` at `messages.first()` *before* the existing try/catch, crashing the receiver (now guarded); blank/whitespace sender fell through `normalizeAddress`'s null-only check and stored under key `""` (now `isNullOrBlank()`). `AvatarHelper.kt` — blank sender produced empty initials instead of the intended "?" fallback (`sender.take(2)` was called on the untrimmed original instead of `words[0]`); `getRelativeTime` had no floor on the diff, so a future timestamp (clock skew after a low-end device's RTC reset) rendered as e.g. "-5m" (now `.coerceAtLeast(0L)`). `HomeViewModel.kt` / `MessagesViewModel.kt` — `loadMessages()` had no try/catch and no error state (unlike `AlertsViewModel`/`CampaignsViewModel`, which already have one), so a ContentProvider exception left the screen spinning forever; it also fires concurrently from 4 triggers (init, `ContentObserver.onChange`, scan-period change, permission-granted) with no cancellation, so a burst of incoming SMS could race overlapping loads — both fixed with a cancelled-and-relaunched `Job` plus a matching `errorMessage` StateFlow, wired into `HomeScreen.kt`/`MessagesScreen.kt`. `OnboardingViewModel.kt` — `normalizePhone` mangled `0063`-prefixed international numbers into `+630639171234567`, silently forced an 8-digit landline into a syntactically-plausible-but-wrong `+63` mobile number, and force-prefixed non-PH numbers; rewritten to return nullable and reject anything that isn't exactly 10 digits starting with `9`, with `requestOtp` surfacing "Enter a valid PH mobile number" on rejection. `ComposeScreen.kt`'s separate `isValidRecipient` (intentionally different — any SMS-capable recipient, not just PH mobiles) now tolerates pasted formatting, and the cleaned number is what's actually sent, not just what's validated. `UserPreferences.kt` — a DataStore `IOException` silently reset the user to onboarding with zero signal; now logged. `OnboardingProfileScreen.kt` plus two more onboarding screens found via the same fixed-height-`Column`-with-`weight(1f)` pattern (`OnboardingConfirmNumberScreen.kt`, `OnboardingEnterCodeScreen.kt` — both confirmed to have real text input, so this isn't speculative) now `verticalScroll`, so IME-open content on a small/low-end screen degrades instead of clipping; the other 4 onboarding screens have no text field and were confirmed to carry no IME risk, so left alone. Six `DateTimeFormatter.ofPattern(...)` call sites (`AlertsScreen.kt`, `CampaignsScreen.kt`, `CampaignDetailScreen.kt`, `SmishingAlertScreen.kt` ×2, `ThreatAnalysisScreen.kt`, `NotificationsScreen.kt`) had no `Locale`, so date rendering could vary oddly on a non-English device locale — pinned to `Locale.US` (not device-default) since the app has no localized strings at all yet, so a partially-localized date next to hardcoded English labels would look more broken, not less. **Deliberately not fixed, and why:** full i18n string extraction (`strings.xml` only has `app_name`, no `values-tl/`) is a multi-day mechanical task touching every screen, not a bug-bash-scoped fix; JWT plaintext storage in `UserPreferences.kt` is real but belongs to 5.2.1 (hardening), not a UI pass; `WapPushReceiver.kt`'s no-op MMS/WAP-push handling is a real feature gap, not a bug — made non-silent (logged) rather than implemented; zero unit/instrumented tests exist in `mobile/app/src/test`/`androidTest` — out of scope for a bug bash, belongs to 5.4.1 or a dedicated future item. `./gradlew :app:ktlintCheck :app:detekt :app:compileDebugKotlin :app:assembleDebug` all pass clean (detekt baseline regenerated via `:app:detektBaseline` to add the two new ViewModel exception-handling entries — incidentally also dropped ~100 stale `FunctionNaming`/`LongMethod` baseline lines that a since-added `detekt.yml` Composable exemption made dead weight; confirmed via `git diff` and a second clean check run, not assumed safe). **Update — live-verified on Gio's physical device** (Huawei VOG-L29, Android 10/API 29, real daily-use install with real messages and bantAI already set as the default SMS app): installed the fixed debug build over the existing app (data preserved, no `pm clear`), then drove it live via `adb` (taps/text/screenshots + `uiautomator dump` for exact tap targets, since the floating nav bar's expand/collapse made blind coordinates unreliable) while tailing a filtered logcat for `com.bantai`/`AndroidRuntime:E`/fatals. Navigated Messages → Settings → Compose with real backend-connected data (`GET /api/campaigns` etc. rendering live "Coordinated smishing waves" / "Unauthorized" campaign data) — zero crashes, zero exceptions logged the entire session. Directly exercised the Compose recipient-validation fix: entered an invalid short recipient ("123"), tapped send, confirmed via `content://sms/outbox` and `content://sms/sent` that nothing was actually transmitted — the rejection path works live, not just by inspection. **Still not exercised live, and why:** the `SmsReceiver.kt` crash-guard (no way to inject a malformed/empty-array SMS on a real device — `adb emu sms send` is emulator-only); the onboarding phone-validation and `OnboardingProfileScreen` IME-scroll fixes (both onboarding-only screens, unreachable without clearing this device's real app data and re-triggering the default-SMS-app role prompt on Gio's daily phone — deliberately not done without asking first). This device is also API 29 (Android 10), below the "Android 11+" this task and 5.4.3 are actually scoped to, so it's real, valuable stability evidence but doesn't by itself close either item. **Second update — a real bug surfaced live, not by the earlier static audit:** Gio reported the app going to a genuinely empty screen after pressing a top screen corner. Reproduced live and root-caused, not guessed: `uiautomator dump` showed the window's content view had zero children (not just an empty *state* — nothing mounted at all) while the process stayed alive with no crash/exception anywhere in logcat; immediately prior, logcat showed `HiTouch_PressGestureDetector` (Huawei-specific) firing and `ViewRootImpl: dispatchDetachedFromWindow in doDie`. Cause: EMUI's floating-window gesture (press-hold a top corner) reparents the app's window without going through Android's normal recreate lifecycle, and `AndroidManifest.xml`'s `MainActivity` declared neither `resizeableActivity` nor `configChanges`, so the OS treated it as fully resizable/floatable. Fixed: `android:resizeableActivity="false"` (stops the gesture applying to this app at all) plus `android:configChanges="orientation|screenSize|screenLayout|smallestScreenSize|keyboardHidden"` as a second layer, so any legitimate resize is handled in place instead of tearing the window down. Recovered the stuck session with `am force-stop` + relaunch; confirmed normal afterward. Checking for the same bug class elsewhere surfaced two more real, unrelated instances the original audit missed (neither `HomeViewModel`/`MessagesViewModel`/`AlertsViewModel`, which were already covered): `MessageDetailViewModel.loadConversation()` had no try/catch or error state at all (would leave the conversation screen spinning forever on a ContentProvider failure) and the same overlapping-load race as the other two — fixed with the identical cancelled-Job + `errorMessage` pattern, wired into `MessageDetailScreen.kt`; and `MessageDetailScreen.kt`'s `retryFailedMessage()` was the only one of that file's three send-paths with no try/catch (a failed-message retry could crash the app) — wrapped to match its two siblings. Rebuilt clean (`ktlintCheck`/`detekt`/`compileDebugKotlin`/`assembleDebug`; baseline regenerated again, 3 new legitimate entries total now). Reinstalled on the physical device — app launches and navigates normally post-fix; **the corner-gesture fix itself is not yet re-confirmed live** (needs Gio to actually retry the gesture that triggered it). **What's left before `[x]`:** live re-confirmation of the corner-gesture fix, live confirmation of the three still-unexercised fixes noted above (SmsReceiver crash-guard, onboarding phone-validation, onboarding IME-scroll), and the actual commit.
    - [x] **5.3.9** Mobile UI polish based on dogfooding *(Track C — Mobile)* — ran the real onboarding-through-main-app flow live on an emulator (not just code review) and fixed what surfaced. Real bugs found and fixed: `OnboardingTermsScreen`/`OnboardingAllowAccessScreen` were fully built but never wired into `NavGraph.kt` (a "Stubs retained..." comment confirmed it), so no user ever saw a Terms/Privacy consent screen despite the app requesting broad SMS/Camera/Contacts/Mic access — now wired into the flow in the order the manuscript describes; phone numbers were stored without the `+63` country code (`OnboardingViewModel.requestOtp` only stripped spaces) — confirmed via the DB (`9171234567` vs the correct `+639171234567`), fixed with a real normalizer; "Send verification code" looked identical whether the field was empty or not — now visibly disabled; the bottom-nav notification badge was hardcoded/inconsistent between its collapsed and expanded states (confirmed in `MainScreen.kt`: expanded always badged Alerts regardless of count, collapsed badged everything *except* Alerts) — now bound to `AlertsViewModel`'s real alert count, hoisted once so the badge and the Alerts tab agree; profile screen's back button was a dead `onClick = {}`; avatar initials lagged a recomposition behind while typing. UI polish: redesigned the profile screen (bigger centered avatar, staggered cascade entrance animation, spring-bounce + color cross-fade on avatar tap), added slide+fade transitions between every screen app-wide, and cross-fade between bottom-nav tabs instead of an abrupt cut. Verified live end-to-end after each fix (not just rebuilt); `ktlintFormat` + `detekt` + `assembleDebug` all clean, zero new lint findings
    - [ ] **5.3.10** *(Stretch)* Client licensing/payment portal pages *(Track D — Web Dashboard)*
    - [ ] **5.3.11** Dashboard UX polish + carryover pages from earlier sprints *(Track D — Web Dashboard)*

  - [-] **5.4** Test: sprint-level unit and integration testing
    - [ ] **5.4.1** Regression pass across all Sprint 1–4 functionality *(All members)*
    - [ ] **5.4.2** Load test: backend + ML service *(Track A — Backend)*
    - [-] **5.4.3** Cross-device compatibility test (Android 11+) *(Track C — Mobile)* — scoped, per team decision, to static SDK_INT review + a live emulator pass on the one profile available locally (`Pixel_6`, API 33/Android 13 — no system image for API 30/31/34 is installed, and pulling one needs a network-dependent `sdkmanager` download that wasn't authorized this pass), rather than blocking on multi-version hardware. **Static review — all 4 confirmed correct by reading the actual branch, not just the `>=` line:** `OnboardingDefaultSmsScreen.kt:129` gates the `RoleManager` default-SMS-app request on `>= Q`(29) — correct, `RoleManager` itself requires 29+, and every case in the Android-11+ scope this task covers is above that; `HomeScreen.kt:90-95` gates the `POST_NOTIFICATIONS` runtime request on `>= TIRAMISU`(33) — correct, notifications are granted at install time below 33 so no runtime request is needed there; `SmsSender.kt:44` gates the `SmsManager` service-lookup on `>= S`(31) with a confirmed `SmsManager.getDefault()` fallback below it; `SmsSender.kt:83` gates the `RECEIVER_NOT_EXPORTED` flag on `>= TIRAMISU`(33) with a confirmed unflagged `registerReceiver` fallback below it (required — that flag doesn't exist pre-33). **Live pass: blocked by environment, not by the app.** The Pixel_6 AVD booted (`sys.boot_completed=1` at ~70-110s) and the app installed and launched (`ps` showed a stable `com.bantai` process, un-crashed, across multiple probes), but `com.android.systemui` repeatedly ANR'd immediately after boot — reproduced twice, once with hardware-accelerated rendering and once headless with `-gpu swiftshader_indirect`, with `dumpsys cpuinfo` showing `system_server` pegged at 67-87% CPU and `kswapd0` thrashing on the first run — consistent with this sandboxed session lacking real hardware-virtualization passthrough for nested emulation, not an app defect. SMS injection was also attempted directly against the running device (both `adb emu sms send` and a raw console session against port 5554, both returning `OK`) as a System-UI-independent way to exercise the 5.3.8 receiver fixes; neither call actually landed a new row in `content://sms/inbox`, again pointing at degraded modem/telephony emulation in this environment rather than a receiver bug. **What this means:** `assembleDebug`/`ktlintCheck`/`detekt`/`compileDebugKotlin` all pass clean (real signal — these fully exercise the Kotlin/Compose/resource compilation and static analysis, just not runtime behavior), and the 5.3.8 fixes are correct by code inspection and trace-through, but **no fix was exercised on a running device this session**, and neither is any Android 11(30)/12(31)/14(34) behavior. Stays `[-]`: needs either a live run in an environment with working hardware acceleration (e.g. Gio's machine via Android Studio directly, where this same Pixel_6 AVD has previously run successfully per 5.3.9's dogfooding session) or an accepted static-only sign-off before closing.

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
