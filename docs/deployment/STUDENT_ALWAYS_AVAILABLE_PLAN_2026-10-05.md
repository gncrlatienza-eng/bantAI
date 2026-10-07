# bantAI student testing deployment — October to December 2026

Status: implemented cloud environment on 2026-10-05; web, backend and private Model C are deployed. The intended administrator has completed email OTP authentication, and authentic Stripe test webhook delivery is verified. See [the deployment evidence](STUDENT_DEPLOYMENT_EVIDENCE_2026-10-05.md) for checks and remaining Android, provider quota and billing gates. The user replaced the two-/four-hour pilot with access whenever the team wants to test, from now through December and potentially longer. This document supersedes the earlier session-expiry requirement and temporary-environment cost forecast. It retains the under-$25/month ceiling until the user changes it.

## Decision and user experience

Keep one Azure for Students environment available continuously in **East Asia**, with persistent private PostgreSQL and the existing same-origin web/API architecture. Configure web, backend and Model C to **sleep at zero replicas when unused and wake automatically on requests or queued work**. Do not delete the environment each evening or require an operator to start a session. December 31 is a planning checkpoint, not an automatic deletion date.

This buys anytime access for a small test team, with cold starts. It does not buy unlimited load or an instantly warm AI server. On the first visit after inactivity, the web/API may take time to start. The application must then show an honest “Cloud verification pending / AI warming up” state, accept work durably, and update the result when Model C is ready. The signed 1.1 / version-code 2 Android student release now embeds portable on-device Model C and its tokenizer. It passed host and actual Android reused-holdout quality gates, integration tests and signed offline incoming-SMS/upgrade checks on the owned emulator. Physical-phone checks remain unavailable. See `ANDROID_OFFLINE_RELEASE_EVIDENCE_2026-10-06.md`.

The first usable deployment follows the implementation and acceptance work below; October 5 is the start of the planning horizon, not a claim that the service is already online. Azure's [scale-to-zero behavior](https://learn.microsoft.com/en-us/azure/container-apps/scale-app) and [cold-start guidance](https://learn.microsoft.com/en-us/azure/container-apps/cold-start) support automatic waking, while the model's actual cold latency must be measured in Azure.

## Why retain this architecture

| Layer | Configuration | Availability and boundary |
|---|---|---|
| Web | Existing Nginx/React image; Consumption, 0.25 vCPU / 0.5 GiB; min 0, max 1 | Public HTTPS URL survives idle periods. Proxy `/api` to backend; preserve HttpOnly Secure SameSite=Strict portal cookies. |
| Backend | NestJS; Consumption, 0.5 vCPU / 1 GiB; min 0, max 1; HTTP and Storage Queue scaling | Public mobile/API endpoint plus queue consumer. Authenticated, tenant-isolated; queue work and HTTP share this bounded replica. |
| Model C | Private internal HTTPS ingress; one process; min 0, max 1 | Start with the reviewed 4 vCPU / 8 GiB allocation. Test 2 vCPU / 4 GiB as an optimization; adopt only after constrained peak-memory, startup and latency checks. Keep API-key authentication. |
| Database | PostgreSQL 16 Flexible Server, B1ms, 32 GB storage, private delegated subnet, local backup | Keep running. One server fits the verified 750-hour monthly grant, including a 744-hour month. No HA replica or automatic storage growth in the student profile. Monitor remaining storage. |
| Durable work | PostgreSQL outbox + Azure Storage Queue, managed identity | Queue contains opaque job IDs, not SMS bodies. Backend wakes for queued work and fetches authorized, masked content. No Redis or additional always-running worker. |
| Images | One private Standard ACR; managed identity image pulls | Retain current and previous approved images, clean older unreferenced images deliberately, remain below the 100 GB grant. No public model image. |
| Secrets and operations | Existing separated Key Vault identities; one small log workspace; small LRS storage | Keep least-privilege database roles and model hash checks. No premium monitoring, NAT Gateway, Front Door, dedicated workload profile or environment private endpoint. |

Retain a Consumption workload profile within an external, VNet-integrated environment. PostgreSQL and AI remain private. Public Key Vault/ACR/Storage service endpoints use TLS and identity; this is distinct from private endpoints. Private endpoints and planned-maintenance features can introduce environment-management charges and are outside this student profile. [Container Apps billing](https://learn.microsoft.com/en-us/azure/container-apps/billing)

Static Web Apps Free was considered but is not the first migration: the actual portal uses strict HttpOnly cookies. Splitting its default domain from the API domain would require an authentication/proxy design change, not just a Vite URL change. The existing same-origin proxy avoids that regression for little test-time compute. Free SWA also does not supply a general arbitrary-backend proxy. [SWA plans](https://learn.microsoft.com/en-us/azure/static-web-apps/plans)

A free burstable VM is a possible later alternative, but no eligible VM quota, memory fit or CPU-credit sustained-inference result has been verified here. It adds operating-system, TLS and patching responsibilities. Do not select it merely because its advertised compute price is zero. A continuously warm 4/8 Model C replica is rejected: even ideal idle-rate arithmetic is roughly $95/month before other services; active operation approaches $316 for a 31-day month after grants. Those are rate calculations, not observed usage.

## Student entitlement and networking assumptions

The live October 5 portal check showed $100 remaining credit, October cost $0.00 and an expiry of September 22, 2027. This is a **total credit balance**, not $100 every month. Recheck the balance before deployment and weekly thereafter. The Students offer supports educational/testing use and warns that exhausted credit can disable the subscription. [Official offer](https://azure.microsoft.com/en-us/pricing/offers/ms-azr-0170p/)

The account's free-services panel already showed PostgreSQL B1ms/32 GB storage/32 GB backup and Standard ACR grants. Microsoft's current [student service catalog](https://azure.microsoft.com/en-us/free/students/) describes these as monthly allowances for the first 12 months. The ACR “31 days” meter is not a one-time 31-day trial. One registry can remain for October, November and December while the subscription's grant remains eligible. Do not switch to Basic and assume the Standard grant follows it.

Custom VNet networking persists even while apps are asleep. Microsoft's [network configuration documentation](https://learn.microsoft.com/en-us/azure/container-apps/custom-virtual-networks) lists a Standard load balancer and an egress Standard static public IP, plus an ingress Standard static public IP for an external workload-profile environment. Budget **two paid IPv4s** until the exact free IP meter is shown to apply. A generic 1,500-hour IP allowance does not prove eligibility for Standard static IPv4.

The forecast below depends on the account's Standard Load Balancer included-rules free grant: one load balancer, at most five included rules, at most 750 hours/month. The October 5 portal showed **Load Balancer, Standard, Included LB Rules and Outbound Rules: 0/750 hours**, Standard Data Processed: 0/15 GB, and an additional overage-rules meter. It also showed Standard Registry Unit: 0/31 days and the unused PostgreSQL allowances. The IP meter was only **Networking, Public IP Addresses, IP Address Hours: 0/1,500 hours**, without a Standard SKU label; the paid-IP assumption therefore remains.

December uses 744 LB hours, leaving only six hours of overlap. Inspect the managed resource group after creation; a second environment/load balancer or extra outbound rules changes the budget. Microsoft's [free service catalog](https://azure.microsoft.com/en-us/pricing/free-services/) lists the 750-hour/five-rule Standard allowance. Match the actual account meter and review the first posted usage after 48 hours before calling it verified billing. If this grant fails, an additional $18.60/month for the included rules alone breaks this plan's $25 ceiling; re-plan before continuing normal testing.

East Asia is the currently validated region: subscription policy denied Southeast Asia, while East Asia passed ARM validation for the existing template. That validation does not prove allocation capacity at a later deployment or validate the new queue/scaling changes.

## Cost model and test workload

Prices are USD retail snapshots checked 2026-10-05, excluding any applicable tax. Region-specific rates were read from the official [Azure Retail Prices API](https://prices.azure.com/api/retail/prices): service `Azure Container Apps`, region `eastasia`, Consumption; service `Virtual Network`, region `eastasia`, Standard static IPv4; service `Load Balancer`, region `Global`, Standard. The API is a retail estimate, not the subscription's final bill.

| Meter | Rate / allowance |
|---|---|
| ACA active CPU | $0.000024 per vCPU-second |
| ACA active memory | $0.000003 per GiB-second |
| Shared monthly ACA grant | 180,000 vCPU-seconds + 360,000 GiB-seconds + 2 million external HTTP requests, once per subscription |
| Standard static IPv4 | $0.005/address-hour; budget two addresses |
| Standard LB included rules if not credited | $0.025/hour; extra rules and processed data are separate |
| LB processed data beyond allowance | $0.005/GB; allowance below reserves $0.30, including management/image-pull traffic |

**Baseline monthly workload envelope:** 15 total AI replica-hours at 4/8, 40 backend replica-hours at 0.5/1, and 40 web replica-hours at 0.25/0.5. These hours include cold starts, useful work, warm waits, retries, queue processing and scale-down delays; they are not a schedule restricting when testing is allowed. The same envelope can support 30 AI hours at 2/4 only if that smaller allocation passes acceptance. Do not present that optimization as already verified.

The baseline uses 324,000 CPU-seconds and 648,000 GiB-seconds. With unused monthly grants, cost is `(324000-180000)*0.000024 + (648000-360000)*0.000003 = $4.32`. At these shapes, additional time after grants costs $0.432/AI-hour, $0.054/backend-hour and $0.027/web-hour. The optimized 2/4 AI rate would be $0.216/hour. Count other apps and jobs against the same grants rather than applying a free grant to every service.

Fifteen AI hours permits, for example, sixty separate 15-minute awake periods across a month. A one-minute classification visit can consume a startup plus approximately five minutes of scale-down time; sixty six-minute periods already consume six hours. HTTP scale-down is observed behavior, not a guaranteed exact five-minute timer. Repeated health checks, browser tabs polling in the background or bot traffic can prevent sleep. No uptime pinger or general dashboard poll is allowed to wake Model C.

| Monthly item, using a 31-day month | Planned credit consumption |
|---|---:|
| PostgreSQL B1ms + 32 GB storage/backup, within account grants | $0.00 |
| One Standard ACR, within account grant | $0.00 |
| One Standard LB included rules, account grant required | $0.00 |
| Two static IPv4s, 1,488 address-hours | $7.44 |
| Web + backend + AI baseline, after shared ACA grants | $4.32 |
| Private DNS: zone plus up to 1 million queries | $0.90 |
| Logs: approximately 0.4 GB/month, including retention allowance | $1.00 |
| Short migrations/outbox repair jobs, priced gross | $0.25 |
| Key Vault operations | $0.03 |
| Small LRS queue/blob storage and operations allowance | $0.10 |
| LB data/management overhead allowance | $0.30 |
| Additional egress allowance | $0.25 |
| **Expected planning total** | **$14.59** |
| **Monthly headroom for usage variation/tax/unpriced small overhead** | **$10.00** |
| **Planning envelope** | **$24.59** |

This is a workload-based estimate, not a spending guarantee. A 0.1 GB/day Log Analytics emergency cap by itself permits much more than the $1 target; reduce emitted logs/sampling and monitor total monthly volume. The $0.30 LB allowance covers 60 GB beyond its 15 GB grant, not unlimited image pulls. A 1.1 GB model can use tens of GB across repeated uncached starts, and the full image is larger. Include system logs, image pulls and platform management traffic in the first-week measurement; measure before assuming image caching. The ACR/storage/PG allowances are shared; a second copy or excess backup/storage must be priced. SMS and email provider fees do not consume Azure credit and need their existing provider balance/quotas checked separately; use Stripe test mode only.

| Period, planning from October 5 | Maximum retained hours | Expected usage | Expected remaining credit from $100 |
|---|---:|---:|---:|
| Oct 5–31, 27 days | 648 | $13.63 | $86.37 |
| Nov 1–30 | 720 | $14.35 | $72.02 |
| Dec 1–31 | 744 | $14.59 | $57.43 |
| **Three-month total** | **2,112** | **$42.57** | **$57.43** |

The table conservatively keeps the full baseline compute/operations allowance in partial October; only IPv4 hours are prorated. It assumes no unrelated subscription consumption. The $10 headroom is a planning reserve, not money automatically charged every month; expected consumption is $42.57 across the three periods. Reserving the full $25/month instead would leave $25 after these three calendar months. At the estimated usage, three further months are plausible, but continuation is decided against actual remaining credit and free-service expiry; September 2027 renewal does not automatically renew every first-year free SKU benefit.

## Required behavior changes before scale-to-zero release

Pre-implementation evidence: `backend/src/ai/ai.service.ts` aborts classification at 3.5 seconds, and the SMS path can persist `device_fallback`. The packaged Model C took 45.254 seconds to become ready in one local disconnected test. Local warm latency and a single working-set sample do not establish cold-start or peak-memory behavior in Azure. Simply changing `minReplicas` to zero would therefore produce misleading test results.

1. Add durable cloud-verification states: `pending`, `processing`, `verified`, `retryable_failure`, `failed`. Ingest commits the SMS and a job/outbox record with a unique `(messageId, modelVersion, approvedArtifactDigest)` identity. Bind inference and its persisted result to that immutable approved artifact, not only a mutable version name. Existing duplicate ingest returns that record's current state rather than permanently locking in the first fallback. Preserve device classification as separate provenance; never label it as a cloud-model result or automatically block based on fallback.
2. Publish an opaque job ID to Storage Queue after the transaction; retry publication safely. The backend's queue-triggered replica claims work with a database lease, calls internal AI, validates the result/version and commits once. Use one active model inference at a time, bounded retry/backoff, poison handling and lease expiry. Queue visibility must exceed processing time and renew while needed. Crash after result commit but before queue deletion must not duplicate alerts or billing actions.
3. Both HTTP and queue rules wake the same backend app, capped at one replica. An unpublished outbox entry cannot depend solely on that sleeping process: add one bounded daily repair job and retry on the next authenticated interaction. A failed initial publish returns explicit pending/retry status. Test queue outages and recovery; no lost work. Additional repair executions count in the runtime budget.
4. Add an authenticated, rate-limited model readiness/wake operation. It checks the pinned version and never sends a synthetic SMS to a real user's history. Coalesce concurrent wake attempts. Public landing-page requests and unauthenticated health routes must not wake AI. Model wake/readiness has a separate bounded deadline from ordinary warm inference.
5. Web and Android display pending/warming explicitly, with bounded backoff and a manual retry. Stop browser polling when complete, hidden, signed out or past its bounded waiting period. Background cloud jobs finish after the client closes; later sync reads the persisted result. Proposed Azure acceptance target is readiness within 180 seconds and eventual result within five minutes for the first cold job, not a current performance claim. Unexpected failure stays visible.
6. Keep mobile raw SMS on device. Only approved, consented canonical masked content reaches the backend/AI. Queue payloads and logs contain job IDs/status only. Introduce no public AI URL, unauthenticated warm-up endpoint or credentials in the APK.

Azure supports [queue-driven scaling](https://learn.microsoft.com/en-us/azure/container-apps/scale-app) and [bounded jobs](https://learn.microsoft.com/en-us/azure/container-apps/jobs). The outbox, queue consumer, readiness UX and reconciliation behavior above are **implementation work**, not capabilities proven by the existing PR.

## Controls and operating routine

- Create a separate `student` IaC/deployment entrypoint. The old `deploy-pilot.ps1` and stop supervisor remain historical short-session controls; never invoke them for this environment. Do not merely remove their expiry guard and run the old warm-AI configuration.
- Keep min replicas zero and max one for all three apps; explicitly disable scheduled warmers and automatic large retraining. Use single active revision where appropriate and constrain release overlap so free PG/ACR/LB hours are not duplicated. No always-warm demo override without recalculating its cost.
- Limit test enrollment and authenticated per-user inference/OTP rates. Keep separate allowances for public requests, queue retries and cloud verification. Record daily actual replica-seconds and job attempts; alert at 50/75/90% of the monthly baseline and forecast before increasing enrollment. Max-one-replica alone is not a dollar cap.
- Extend/revise the existing monthly alert budget beyond October through December: warn at $10, $15, $20 and $24; add remaining-credit/runway review. Budgets notify and billing can lag. An authenticated work-admission counter limits AI job volume/cold activations; unexpected public traffic still needs operator investigation. Do not silently turn the application off on a calendar/session timer.
- Expected monthly spend should stay below $15, preserving approximately $10 margin. At a $20 forecast, investigate hot replicas, unnecessary polling, logs and provider retries immediately; at a projected $25, pause optional bulk/cloud verification while retaining login/data access and clearly display the constraint. The user must choose a larger budget or a smaller workload if normal demand exceeds this envelope. A guaranteed hard dollar cap and unlimited availability are incompatible; subscription credit exhaustion can still disable resources.
- Operator: Reymark for budget/backend operations, Maxene for model artifacts/performance, Daryl for portal behavior, Gio for Android/release coordination and owned trackers. Do a daily cost/queue review during the first week, then weekly. This document schedules no automation or messages by itself.
- Review on November 1 and December 1 using actual usage; review extension by December 15. Retain service after December 31 if the remaining credit funds the chosen next horizon. Export tested backups and agree any eventual retirement date before stopping service. Never delete the database as a budget reaction.

## Execution sequence and acceptance

| Sequence | Owner / deliverable | Acceptance evidence |
|---|---|---|
| 1. Confirm exact student meters and inventory | Reymark; snapshot credit, Standard LB rules, PG/ACR eligibility, existing consumption, East Asia capacity | Current account-specific evidence; actual topology counted; full estimate below $25 including margin. If LB grant fails, stop and redesign rather than assume a discount. |
| 2. Implement reliable cold handling | Backend + AI + web/mobile owners; durable queue/state, wake route, bounded UX | Fresh sleeping stack accepts work once, wakes automatically, persists exact-model result, handles duplicate/retry/crash/queue outage without losing work or crossing tenants. |
| 3. Measure smaller AI candidate | Maxene; same approved Model C, 2/4 constrained container then Azure | Record peak cgroup memory incl page cache, startup, warm p95/p99, concurrency-one load, no OOM; retain at least 25% memory headroom. Keep 4/8 and 15-hour baseline if candidate fails. No substitution with unapproved ONNX. |
| 4. Prepare student IaC/release workflow | Reymark; immutable image digests, queue RBAC, zero-min apps, job caps, budget extension | Bicep compile, ARM validation/What-If when available, no session-expiry supervisor, no excess premium/duplicate resources; scoped OIDC CI, gated migration-before-app sequence. Team reviews uncommitted release patches. |
| 5. Provision and verify | Release team after implementation review | Private DB/AI unreachable publicly; migrations and least-privilege role, production readiness/auth/tenant tests, same-origin browser cookie login, real OTP and verified Stripe test webhook. No placeholders. |
| 6. Observe first week and rehearse recovery | Reymark + owners | Confirm charged meters match forecast, observe repeated zero→ready→zero cycles without keepalive, restore rehearsal and image/model rollback; meter anomaly handled before extended testing. |

Remaining independent functional gates: the approved cloud bundle lacks campaign space/centroids, so campaigns stay explicitly unavailable until approved compatible artifacts exist. The completed signed 1.1 APK/AAB embeds portable U8U8 Model C; its host and native 3,236-row regression gates, six integration tests and signed offline upgrade/SMS smoke passed. The older 1.0 artifacts remain available as historical files. It is approved only for student testing, not production, and no physical-phone validation exists because the user has no Android phone available. Authentic Stripe test webhook delivery and the administrator's email inbox OTP flow are verified. Semaphore is Active with 1,010 credits, but registered sender BANTAIPH remains Pending. Full paid-access activation, sender approval and mobile SMS delivery remain separate checks.

Use the historical [release preflight](RELEASE_PREFLIGHT_2026-10-04.md) for exact PR SHA, image/model hashes and completed local checks. Its short-session cost and shutdown requirements are superseded here. Do not mark WBS/DEV_LOG complete while implementation and deployment remain pending.
