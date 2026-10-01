# Manuscript Implementation Alignment Review

**Reviewed:** 2026-09-16  
**Manuscript:** `Manuscript_BantAI_Thesis.pdf`  
**Code baseline:** `develop` at `242b035` plus the uncommitted security and privacy remediation worktree

## Conclusion

The project implements the broad Android, NestJS, PostgreSQL, AI-service, and
web-dashboard architecture described by the manuscript. It does **not** yet
fully implement the manuscript's strongest privacy and on-device-AI claims.
Those statements must not be used in a defense or deployment claim until an
on-device model is supplied and verified, or the manuscript is revised with
adviser approval.

## Implemented alignment

| Manuscript commitment | Implementation status | Evidence |
|---|---|---|
| Android SMS manager performs incoming-message triage | Implemented | `mobile/.../SmsReceiver.kt`, `SmsIngestPipeline.kt`, and the default-SMS manifest receivers handle incoming messages and present them in the inbox. |
| Privacy-safe preprocessing | Partially implemented | `SmsPrivacyMasker.maskForRemoteClassification` applies NFKC and masks URLs, phone numbers, OTPs, and amounts before transport. The backend persists an HMAC sender pseudonym and the masked text only. |
| High-risk messages offer Block, Report, or Ignore choices | Implemented in this worktree | `SmsService.ingest` now emits an alert instead of silently adding a blocked sender; `TakeActionScreen` performs the system block only after the user confirms it. |
| Authorized Tier 1 and scoped Tier 2 access | Implemented in this worktree; migration/deployment still required | Global `ADMIN` controls membership issuance. `PortalOrganization`, `OrganizationMembership`, and `OrganizationScopeGuard` constrain Tier 1/Tier 2 alert summaries to explicitly enrolled users, without raw SMS content. |
| External sender-risk check | Implemented in this worktree; provider credential required | A bounded server-only IPQS phone-reputation adapter sends only canonical sender phone numbers, caches only a risk class, and can alert but never auto-block. |
| SHAP explanation delivery | Implemented in this worktree; real-model validation required | The AI classify response now carries its `shap` or `keyword-fallback` provenance; the backend persists returned indicator tags with the classification for the mobile alert endpoint. |
| Campaign intelligence, reports, retraining, and a dashboard | Implemented with deployment validation still pending | NestJS modules and the Python service exist; the latest remote revision adds retraining-history, model-integrity, queue-lifecycle, request-authentication, and Scam-safety controls. |

## Local verification completed

- The AI environment was created locally and its pinned dependencies installed.
- `python -m pytest -q --basetemp .pytest-tmp` passed **461 tests**, with
  **1 intentionally skipped** test and 2 upstream FastAPI/Starlette deprecation
  warnings (2026-09-16).
- The suite now verifies that raw SMS is never read from the backend for
  retraining: a separately consented offline `FileReportSource` export is
  required. It also verifies that the AI service key can register a candidate
  only through the internal route and cannot activate it; administrator
  promotion is required.
- Python module compilation of `service/`, `retraining/`, and `scripts/`
  completed successfully.

This is local code validation, not evidence of an on-device model, provider
integration, live deployment, or participant UAT.

## Material gaps that require an explicit thesis or architecture decision

| Priority | Manuscript statement | Current implementation | Required resolution |
|---|---|---|---|
| Critical | Pages 21, 44, 45, and 47 state that XLM-RoBERTa classification, explainability, and clustering run on-device without cloud dependence. | There is no Android TFLite, ONNX, tokenizer, or inference runtime artifact. `SmsIngestPipeline.kt` sends masked text to `/api/sms/ingest`; `SmsService` calls the remote `AiService.classifyMasked`. The local path is only a heuristic fallback. | Supply Maxene's trained checkpoint and tokenizer in an Android-compatible format, package it, then measure real-device accuracy, latency, memory, and battery use. Until then, the manuscript must describe privacy-minimized remote inference. |
| Resolved in code | Pages 16, 18, 21, 30, and 48 use `Likely Smishing`, `Suspicious`, and `Unknown`. | API/evaluation preserve `Ham`/`Spam`/`Scam`; `SmsApi` now performs a lossless participant-facing mapping (`Scam` → `Likely Smishing`, `Spam` → `Suspicious`, low-confidence → `Unknown`). | Update the manuscript's implementation terminology to document this mapping. |
| High | Pages 21, 42, 45, and 47 promise SHAP-based explanations. | The AI response now sends indicator provenance and the backend persists it for the mobile alert endpoint, but no model checkpoint is present to demonstrate a real `shap` result. | Run and retain a real-model explanation demonstration; do not call keyword fallback SHAP. |
| High | Page 22 describes a second-stage external or community sender-risk API. | The IPQS phone-reputation adapter is implemented server-side, but no production key/consent decision/test request exists. | Obtain the provider credential, record consent/privacy basis, run a test lookup, and retain redacted evidence. |
| Medium | Pages 22 and 23 describe automatic unread-message summaries and contextual campaign tips. | The summary endpoint proxies to the remote AI service; tip content is static/local and campaign association is limited by the privacy-minimized ingestion data. | State the remote-processing boundary and demonstrate a complete unread-summary and campaign-tip flow before presenting it as complete. |
| Medium | Pages 23 and 24 limit dashboard access to authorized Tier 1 and scoped Tier 2 organizations. | Organization membership and scoped masked-alert endpoint are implemented, but the migration has not been applied and the dashboard has not yet exposed the Tier-2 route. | Apply the migration, enroll representative accounts, wire the dashboard route, and capture 200/403 authorization evidence. |
| Medium | Page 232 names a Next.js dashboard and Android 11+ operational support. | The dashboard is React with Vite, and mobile declares `minSdk=26`/`targetSdk=35`; prior live testing included Android 10. | Correct the stack/version wording in the manuscript or provide a focused Android 11+ release-device validation record. |
| Medium | Pages 229 to 231 describe validated reports automatically enriching the training set and supervised promotion. | The latest AI revisions retain validated corrections and add promotion safeguards, but final deployment/production evidence is still absent. | Run the documented release pipeline against the intended artifact, retain the results, and get the outstanding adviser decision for the promoted refinement. |

## Release and defense evidence still required

1. Build a clean release APK after the Android Java 17 toolchain is available,
   then test notification grant, denial, and later settings recovery on Android
   13 or newer.
2. Run the full deployed seam: mobile OTP, masked SMS intake, model result,
   alert, explicit block/report/ignore, campaign display, and administrator
   review. Record request/response and user-visible evidence without retaining
   real SMS content.
3. Run UAT with the planned participants and expert validation using the
   manuscript's stated scenarios and questionnaires.
4. Deploy only after the provider, region, database backup, private AI-service,
   secrets, CORS, migration, health, and rollback checks in
   `docs/deployment/BACKEND_ROLLOUT.md` are complete.
5. Update the thesis only after the team and adviser choose between true
   on-device inference and a transparently documented privacy-minimized remote
   inference architecture.
