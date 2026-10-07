# Student deployment evidence — 2026-10-05

Web, backend and private Model C are deployed in Azure for Students, East Asia, resource group `bantai-student-pr112`. The [student plan](STUDENT_ALWAYS_AVAILABLE_PLAN_2026-10-05.md) replaces the temporary session shutdown. Public URLs persist while containers sleep; requests and queue work wake them automatically. The private PostgreSQL database remains running.

## Live entry points

- [Website and sign-in](https://bantai-student-web.calmsand-1a6d5c6b.eastasia.azurecontainerapps.io/login)
- [Backend readiness](https://bantai-student-backend.calmsand-1a6d5c6b.eastasia.azurecontainerapps.io/api/health/ready)
- Mobile backend setting: `https://bantai-student-backend.calmsand-1a6d5c6b.eastasia.azurecontainerapps.io/api`

The website's same-origin `/api/health/ready` returned 200 with `database: reachable`; `/api/auth/me` without authentication returned 401. The landing and sign-in pages rendered in the browser with no recorded warning/error console entries. The authorized administrator subsequently completed the normal password and email OTP flow through the deployed website proxy: verification and authenticated `/api/auth/me` both returned 200. This verifies API authentication and user-confirmed inbox delivery; authenticated dashboard rendering remains a separate device/browser check.

## Source and immutable images

Remote `develop` was rechecked during deployment and remains PR [#112](https://github.com/gncrlatienza-eng/bantAI/pull/112), SHA `b5dd8707f55d27314e1ed780ab619448d435f063`. The release also includes scoped **uncommitted** patches in the isolated release worktree. The original dirty checkout was preserved; no commits, merges, pushes or changes to Gio-owned trackers were made. Base-source CI is distinct from the patched release's local and live checks.

Registry: `bantaistudentoznuspr2.azurecr.io`; deployed references use `@sha256:` digests.

| Image repository | Deployed digest |
|---|---|
| `bantai-backend` | `433b2b33da6a06ff25200566456aa16699bf40c9e8a3aa940062efd922a20808` |
| `bantai-ai` | `a9e97fba6af7b99dfe479b80f43d083e9ea16cd7c1865387ce040dfae505fecf` |
| `bantai-web` | `e9e7be24a8733c198f0592ec4f0f93d08caa2d8c38822252cd01a0200cbe92f7` |
| `bantai-migration` | `78175573bee648ebb8bf500dfc8eb65515425c0002cb065b7a2afafd0c353171` |
| `bantai-db-init` | `a9c818834ac336a0914ac581f3bbc273982b0f81511c5cf73815df39ebb5102f` |

Private Model C is `candidate-2026-09-21-colab-C-local`, complete approved bundle digest `2ee84d99a8da734f803e9b20677231879c8e52089d4d407c44a9abff45a817e8`. The six artifact hashes and operator approval manifest are enforced before deployment. This is serving-artifact evidence and the user's chat approval; independent holdout provenance and a promoted database model registry are separate claims.

## Verified application and database behavior

- Backend Node 24 build and production Docker build succeeded. Forty-two affected tests passed after final corrections; twenty unchanged Stripe tests passed. Web production build succeeded. Android `compileDebugKotlin` succeeded.
- All 44 migrations passed on fresh isolated PostgreSQL 16. Azure migration execution `bantai-student-migrate-awdqwzq` and role bootstrap `bantai-student-db-init-cptu6i9` both succeeded. Runtime uses the restricted `bantai_app` DML role, with no public PostgreSQL access.
- Real database testing exercised the lease row lock, atomic result transaction, idempotent job identity, cross-owner 404, and duplicate queue delivery without repeated inference. Fixes cover publication/result races, active final-attempt leases, expired leases, denied wake admissions, migration TEXT types, and legacy classification provenance.
- The live synthetic API test received 401 without authentication and 404 for another user. Duplicate ingest reused the same job. The queue consumer persisted one trusted Ham classification with exact Model-C version and bundle digest, one attempt, zero alerts, and an 80-second verification wait. Only synthetic records were created; the test removed its exact records afterward. No email, OTP or SMS was sent.
- The daily outbox repair job is scheduled at 03:00 UTC with a 120-second limit, one retry and one replica. Manual execution `bantai-student-outbox-repair-f7ez63a` succeeded using only database/queue/model configuration, without payment or portal-auth secrets.
- All three applications have min replicas 0, max 1. Control-plane checks observed AI, backend and web each reach zero replicas without manual stopping at approximately 09:02 UTC. The separate manual job `bantai-student-release-verify-6m3131e` then **Succeeded**. Archived application logs at 09:04:56 UTC recorded HTTP readiness through the website proxy in **55 seconds**; logs at 09:06:09 UTC recorded cloud verification in another **71 seconds**, one attempt, Ham, zero alerts, and the exact approved version and bundle digest. Unauthenticated access returned 401, cross-user access returned 404, and duplicate submission reused the same job. The job completed its exact synthetic-record cleanup. This single cold run establishes automatic waking and durable verification, not a latency percentile or load-test guarantee.

## Deployment controls and corrected integration issues

The foundation is private PostgreSQL 16/B1ms/32 GB, Standard ACR, split managed identities and Key Vaults, a Consumption environment, LRS opaque-ID queue, VNet/private DNS and bounded logs. AI ingress is internal; its URL returned 404 from the public machine. Queue access is scoped to the one verification queue. Campaign matching and retraining are disabled because the approved bundle lacks campaign space/centroids.

Later phases reference the existing foundation instead of reapplying database passwords or network resources. Conditional foundation resources include children and roles; deployments use Incremental mode. Database jobs precede applications. Subnet writes are serialized to avoid Azure's `AnotherOperationInProgress` failure. Image uploads have bounded retries and valid lowercase repository names.

The first web proxy exposed a TLS-chain verification failure. `proxy_ssl_verify_depth 3` fixed it while preserving certificate verification and SNI; a local container verified the real Azure upstream before the corrected image was deployed. [Nginx directive reference](https://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_ssl_verify_depth)

## Budget and remaining gates

The existing $24 monthly budget is extended through December (end `2027-01-01`), retaining the existing notification recipient, with actual-cost alerts at $10/$15/$20/$24. Alerts do not impose a hard spending cap. The plan's conservative expected usage is $14.59/month plus $10 headroom, conditional on student grants and bounded test usage. Actual managed topology currently shows one Standard IPv4 and one load balancer; retain the conservative two-IP forecast until posted billing is reviewed.

First posted billing/free-meter attribution, repeated cold latency/peak-memory statistics, restore and rollback rehearsal remain first-week checks. One local 2-CPU/4-GiB AI probe passed readiness and inference in 81.409 seconds startup, but it did not establish memory headroom or Azure performance; production retains 4 CPU/8 GiB.

Stripe's real **test** webhook `we_1UN6qdFboMdezGFfRVUQGbaw` points to the deployed backend, is pinned to API `2024-06-20`, and has its real signing secret stored privately. Authentic test event `evt_1UN8L5FboMdezGFfSWq4kfkn` (`customer.subscription.updated`, `livemode: false`) reached the sole enabled test endpoint: Stripe's event API reported pending webhooks fall from 1 to 0. A request without a signature returned 401. The exact tagged trial subscription was cancelled, its customer deleted, and its product/price archived. No real charge or application license activation was attempted. This proves provider webhook delivery and unsigned-request rejection; full paid-access activation, mobile SMS delivery and provider quotas are separate checks. The test used the official CLI's real-object fixture mechanism, as documented in [Stripe's CLI reference](https://docs.stripe.com/cli#trigger).

The user-authorized first administrator is `reymarkdecastro59@gmail.com`, role ADMIN and staff role SUPERADMIN. One-time bootstrap execution `bantai-student-admin-bootstrap-e8oq7dn` succeeded with an exact-email, serializable, audited transaction that refused mismatched existing accounts or credential replacement. The initial credential is encrypted for the current Windows user outside the repository; `Copy-AdminPassword.ps1` in the private `BantAI-deploy-tools/release-pr112/admin-handoff` folder copies it locally without terminal output. No development accounts were copied. The user supplied the received OTP, successful verification issued a Secure/HttpOnly `/api` cookie, and database storage, mobile-sync and audit endpoints each returned 200; unauthenticated admin access returned 401. The local proof cookie was removed after checks. The one-time bootstrap job and temporary verifier parameter files are removed after provisioning. No password or OTP is recorded in this report.

Read-only [Semaphore account and sender API](https://api.semaphore.co/docs) checks reported Active status, 1,010 credits and registered sender `BANTAIPH` with **Pending** status. The deployment template and live backend sender setting were corrected from unregistered `BANTAI` to `BANTAIPH`. No SMS was sent. Provider approval of that sender and physical SMS delivery remain external gates; existing email OTP authentication is verified independently.

The [Android 1.0 release report](ANDROID_RELEASE_EVIDENCE_2026-10-05.md) preserves the original student-test signing lineage and historical cloud-plus-heuristic APK/AAB. Those files remain in `C:\Users\MJ De Castro\Documents\bantAI Releases\2026-10-05`. The new signed release uses the same private student certificate.

The [offline Model C release evidence](ANDROID_OFFLINE_RELEASE_EVIDENCE_2026-10-06.md) records the completed signed 1.1 / version-code 2 release, distributed on 2026-10-07. Both packages contain the exact portable model and tokenizer. All 187 JVM tests, six Android integration tests, static checks and package checks passed. Actual Android quality on the reused 3,236-row holdout was macro-F1 0.9601 and Scam recall 0.9491, within the 0.01 regression gates. The non-debuggable signed APK upgraded 1.0, retained the default SMS role and persisted an incoming synthetic SMS native-model verdict without an active network on API 34 x86_64. Physical phone, permission prompts, real carrier SMS/MMS and ARM performance remain unverified because no phone is available.