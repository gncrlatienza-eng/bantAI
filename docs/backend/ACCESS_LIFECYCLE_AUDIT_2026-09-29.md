# Access Lifecycle — Audit, State Machine, and Migration Plan

**Date:** 2026-09-29
**Author:** Reymark (Track A), with Claude
**Status:** Decisions approved 2026-09-29 (§A). Implementation proceeds in the §A.10 order. Sections §1–§8 are the original audit; where §A conflicts with them, **§A wins**.
**Scope:** authentication, account setup, Request Access, Research/Organization/Admin access, license and workspace lifecycle, payment activation, Organization API, route guarding, tenant isolation, audit logging.

Every claim below was checked against the code on `feature/backend-web-email-otp` (working tree, 2026-09-29). File references are clickable from the repo root.

---

## A. Approved decisions (2026-09-29)

These replace the recommendations in §9 and the phase order in §10.

### A.1 Account-first lifecycle (replaces the "apply anonymously → pay → claim" recommendation)

```
Public /request-access (plan selection only)
  → choose Research or Organization
  → create account OR sign in
  → verify email
  → mandatory account setup
  → access application (authenticated, belongs to User)
  → submit → human review → approval
  → accept terms → payment (if required) → verified webhook activation
  → workspace
```

- No payment at submission. No payment before approval. No account creation after payment.
- An anonymous application never becomes the canonical application. `AccessRequest` belongs to an authenticated `User`.
- Identity exists independently of any license.
- Authenticated users visiting `/request-access` or `/login` are resolved to their lifecycle state, not shown the anonymous flow.
- Legacy records created by the old anonymous flow are linked to a user only after that user proves control of the same email (verified sign-up / sign-in). No silent merge.

### A.2 Existing and expired users

Expired access ≠ expired identity. An expired user signs in with the **same** account, sees an authenticated expired state, and submits a **new** `AccessRequest` that is linked to the previous request / workspace / license. Nothing is overwritten, nothing auto-reactivates.

Schema consequence: `AccessRequest.portalUserId @unique` and `AccessRequest.portalOrganizationId @unique` are removed. User 1→N AccessRequests; PortalOrganization 1→N AccessRequests; `previousAccessRequestId` links history.

### A.3 Workspace reuse

Activation stops creating a new `PortalOrganization` for every paid request. A returning applicant's approved request reuses the organization linked through their history (members, identity, audit, API history preserved), unless that workspace was archived/revoked by policy.

### A.4 Member roles — keep `OWNER / TIER_1 / TIER_2`, enforce them

No naming migration. Capabilities are defined once in `backend/src/access-control/member-capabilities.ts` and enforced centrally.

**Sources (the manuscript PDF is not in the repository; these are all the documented semantics):**

| Source | Statement |
|---|---|
| Manuscript pp. 23–24 via [MANUSCRIPT_IMPLEMENTATION_ALIGNMENT_2026-09-16.md](../development/MANUSCRIPT_IMPLEMENTATION_ALIGNMENT_2026-09-16.md) | "Authorized Tier 1 and scoped Tier 2 access"; "Global `ADMIN` controls membership issuance." |
| [portal-organizations.service.ts](../../backend/src/portal-organizations/portal-organizations.service.ts) (`scopedAlertSummary`) | "Tier-2 staff can see only aggregate, masked metadata … no raw sender/body content crosses this API." |
| `claimActivePaidAccess` | `OWNER` = the license holder who claimed the paid workspace. |

**Derived matrix — anything not documented is denied (least privilege):**

| Capability | OWNER | TIER_1 ("authorized") | TIER_2 ("scoped") | Basis |
|---|---|---|---|---|
| `viewWorkspace` (license, entitlements) | ✓ | ✓ | ✓ | any enrolled member |
| `readIntelligence` (masked campaign/alert metadata) | ✓ | ✓ | ✓ | Tier 2 documented as masked aggregate metadata |
| `readReports` | ✓ | ✓ | ✗ | Tier 1 "authorized"; Tier 2 scope does not document reports |
| `exportData` (record-level masked rows) | ✓ | ✓ | ✗ | exports are row-level, beyond "aggregate" |
| `manageMembers` | ✓ | ✗ | ✗ | owner per product spec; manuscript says global ADMIN issues memberships — **manuscript text needs updating when owner self-service ships** |
| `manageApiKeys` | ✓ | ✗ | ✗ | owner only; also requires the `API_ACCESS` license entitlement (Organization only) |
| `viewBilling` | ✓ | ✗ | ✗ | license holder |
| `manageWorkspace` | ✓ | ✗ | ✗ | license holder |

Effective permission = member capability **and** license entitlement (`entitlementPolicyFor(tier)`) **and** an active license. Items marked ✗ for Tier 1/Tier 2 are revisitable once the manuscript wording is checked; they fail closed until then.

### A.5 Licensed data = platform-wide masked campaign intelligence

Two separate datasets:

- **BantAI Intelligence** — platform-level sanitized/masked data: campaigns, relationships, evolution, indicators, first/last seen, risk patterns. This is what a license unlocks.
- **Workspace observations** — data from the workspace's own members/devices (today's `scopedAlertSummary`). Optional, never conflated with the licensed dataset.

Research: masked campaign intelligence, history, relationships, evolution, delayed data, limited reports/exports. **Never** raw SMS bodies, unrestricted sender data, training data, API, or model internals.
Organization: the same plus latest data, higher limits, multi-user, API, workspace management. Still no raw message data.

**Release gate (documented, not blocking architecture):** any platform-wide data sharing needs adviser/privacy sign-off before production. The boundary is implemented so the permitted dataset is configurable.

### A.6 Organization public API — in scope, built last

`/api/v1/*`, dedicated `ApiCredential` (prefix + hash, shown once, no reveal), scopes `campaigns:read`, `intelligence:read`, `indicators:read`, `reports:read`, `exports:read`. The credential alone determines the organization. It is built **after** lifecycle, entitlement, authorization, and tenant isolation are correct. The public plan copy stays "API when available" until the API works.

### A.7 R1 — central entitlement enforcement (first)

`authenticated ≠ licensed`. Every licensed route checks the current, authoritative entitlement on each request: platform role → membership → license → status → validity window → feature entitlement → member capability. License state is never trusted from the JWT. Expired/suspended/revoked licenses lose licensed routes immediately while account routes (account, status, re-application, logout) keep working.

### A.8 R2 — TIER_1/TIER_2 enforcement alongside R1

Implemented through the same central policy (A.4), not `if (role === 'TIER_1')` in controllers.

### A.9 Password contradiction — report, don't rewrite

Executable code is authoritative: web sign-in = email + password (bcrypt, first factor) → emailed 6-digit code (second factor, 5-minute single use). `CLAUDE.md`'s "OTP only — NO password login" describes the **phone-OTP mobile flow and the original web design** (the `/auth/login` legacy endpoint is now `410 Gone` in production). Password recovery is **not implemented** (`/forgot-password` redirects to `/login`). Documentation gets corrected; auth is not rewritten.

### A.10 Implementation order

| Phase | Content |
|---|---|
| 1A | R1 + R2 central enforcement, with tests proving denial for expired / pending / declined / suspended / Tier 2 / cross-tenant **before** sign-in is widened |
| 1B | Authentication no longer requires an active license (account-level SUSPENDED/REVOKED still blocks sign-in) |
| 2 | Application-history schema (drop the two `@unique`s, `applicantUserId`, `previousAccessRequestId`, onboarding status, one-open-request index) |
| 3 | Central lifecycle resolver (`GET /api/account/state`) |
| 4 | Mandatory account setup (no escape links; server-enforced) |
| 5 | Authenticated application flow (account → setup → request) |
| 6 | Expired re-application (same account, linked history) |
| 7 | Workspace reuse on activation |
| 8 | Research/Organization data entitlement (licensed intelligence vs workspace observations) |
| 9 | Organization API |
| 10 | UI polish / copy |

Stop conditions: a destructive migration risk, or a conflict that cannot be resolved safely from the existing architecture. Not changed: Stripe webhook activation, `User.role`, `PortalOrganization` naming.

---

## 0. Summary

BantAI already has most of the *pieces* the target model needs — they are just named differently and wired for a single "apply once → pay → use" path:

| Target concept | What already exists |
|---|---|
| Platform role (USER / ADMIN) | `User.role: UserRole` — correct concept, keep it |
| Account enforcement | `User.portalAccessStatus: ACTIVE / SUSPENDED / REVOKED` + append-only `PortalAccessAudit` |
| Workspace | `PortalOrganization` (no type, only `isActive`) |
| Workspace membership | `OrganizationMembership` (`OWNER / TIER_1 / TIER_2`) |
| Application | `AccessRequest` (mixes application, agreement, payment, and license states in one enum) |
| License | `License` (Stripe-backed, `validFrom / validUntil`) |
| Entitlement policy | `entitlementPolicyFor(tier)` in [entitlement-policy.ts](../../backend/src/portal-organizations/entitlement-policy.ts) |
| Payment activation | Stripe webhook-only activation — correct, never trusts the browser |

**The system has no lifecycle beyond the first activation.** Four facts combine into a dead end for any customer whose access ends:

1. Web sign-in only issues a session to admins or *currently licensed* clients (`findEligibleClient`, [auth.service.ts:752](../../backend/src/auth/auth.service.ts:752)). Expired, pending, declined, or unpaid users cannot sign in at all.
2. A new application is refused for any email that already has a password, a membership, or a linked request (`assertEmailEligible`, [access-requests.service.ts:1038](../../backend/src/access-requests/access-requests.service.ts:1038)).
3. `AccessRequest.portalUserId` and `AccessRequest.portalOrganizationId` are both `@unique`, so a user or workspace can be linked to only one application, ever.
4. Activation creates a **new** `PortalOrganization` for every paid request ([access-requests.service.ts:547](../../backend/src/access-requests/access-requests.service.ts:547)), so even an admin workaround would split a returning customer's history across two workspaces.

Result: an expired Research user today can neither sign in nor re-apply. They would have to use a different email address, which is exactly the duplicate-identity outcome the spec forbids.

Two **existing security gaps** should be fixed first, independent of the redesign (§1.3).

---

## 1. Repository audit

Legend: ✅ exists and correct · 🟡 exists, needs change · ⛔ missing · 🔴 security risk

### 1.1 Area-by-area

| # | Area | Class | Finding |
|---|---|---|---|
| 1 | User schema | 🟡 | `User` holds phone (mobile), `email` + `passwordHash` (web portal), `mobileAuthEmail`, `role`, `portalAccessStatus`. No `onboardingStatus`, no `emailVerifiedAt`. One `User` table serves both mobile phone users and web portal accounts. |
| 2 | Roles | ✅ / 🟡 | `UserRole { USER, ADMIN }` is exactly the spec's platform role. Member roles `OWNER / TIER_1 / TIER_2` exist but have **no defined capabilities** and are **not enforced** anywhere (see §1.3 R2). TIER_1/TIER_2 come from the thesis manuscript (pp. 23–24), so renaming them is a manuscript decision (§9 D2). |
| 3 | Authentication mechanism | 🟡 | Web: email + password → Gmail OTP → HttpOnly cookie (`bantai_client_session` / `bantai_admin_session`), audience-specific JWT secrets. Mobile: Semaphore phone OTP, or mobile email OTP. **`CLAUDE.md` is out of date** — it says "no password"; the web portal *does* use bcrypt passwords as a first factor. One login page for web already ✅. |
| 4 | Session / JWT handling | 🟡 | [jwt.strategy.ts](../../backend/src/auth/strategies/jwt.strategy.ts) re-reads `role` and `portalAccessStatus` on **every** request — demotion/suspension take effect immediately ✅. It does **not** re-check the license, so a client session outlives license expiry for up to 7 days 🔴 (R1). |
| 5 | Onboarding / setup | 🟡 | "Setup" today = post-payment account claim at `/request-access/setup` (email OTP + set password). It is an anonymous page with "Back to website" links, not a mandatory authenticated step. No profile/terms setup after sign-in. |
| 6 | Request Access workflow | 🟡 | Solid state machine for the first application: `RECEIVED → UNDER_REVIEW ⇄ MORE_INFO_REQUIRED → APPROVED → AGREEMENT_ACCEPTED → PAYMENT_PENDING → ACTIVE`. Approval mints a single-use hashed token ✅. Serializable transactions ✅. **Email ownership is not verified at submission** (R3). |
| 7 | Research logic | 🟡 | Tier policy exists (24 h delay, 5k export rows, 3 members, no API). But the licensed data feed returns alerts **only from the workspace's own members' phones** (`scopedAlertSummary`, `exportMaskedAlerts`). Research members are web-only accounts, so Research sees an empty dataset. What a license actually unlocks is a product/DPA decision (§9 D3). |
| 8 | Organization logic | 🟡 | Same feed as Research with 0 delay and higher limits. No team management UI or endpoint for owners (`addMember` is admin-only). No billing page. |
| 9 | Admin logic | ✅ / 🟡 | `AdminGuard` requires `role === ADMIN` **and** `audience === ADMIN` ✅. Admin cannot be self-selected: no endpoint accepts a role ✅. Admin application review exists; it cannot see a returning applicant's history because none can be linked. |
| 10 | License schema | 🟡 | `License` is good (tier, status, Stripe IDs, validity window, stale-event protection). Missing `REVOKED` status, license↔license supersession, and features/limits snapshot. `License.accessRequestId @unique` is fine (one license per application). |
| 11 | Workspace schema | 🟡 | `PortalOrganization` has only `name` + `isActive`. No `type` or lifecycle status. `name @unique` with the `(<id prefix>)` suffix hack. |
| 12 | Expired-account behavior | 🔴 / ⛔ | Expired users cannot sign in (#1 in §0). No expired state page. Access checks correctly use `validUntil > now` at query time, so expiry needs no cron for *authorization* — but `License.status` is never moved to `EXPIRED` by time, only by Stripe webhooks. |
| 13 | Re-application | ⛔ | Blocked by `assertEmailEligible` and the two `@unique` links. No `previousAccessRequestId`. |
| 14 | Billing / Stripe | ✅ / 🟡 | Webhook signature verification, raw body, idempotent activation, stale-event ordering ✅. Test reconciliation disabled in production and for live sessions ✅. Mapping needs policy work: `canceled` → `CANCELLED` immediately (cuts access before the paid period ends); `past_due` / `unpaid` / `incomplete` → `PAST_DUE` → no access and no grace period. `updateSubscriptionFromWebhook` also overwrites the *application's* status with license states. |
| 15 | Payment activation | ✅ | Activation only on verified `checkout.session.completed` with `payment_status === 'paid'`. Browser success URL grants nothing ✅. |
| 16 | Navigation guards | 🟡 | Client sidebar was partly duplicated per page (fixed earlier today — one shared `CLIENT_SIDEBAR_GROUPS`). No per-tier or per-member-role navigation. |
| 17 | Frontend route guards | 🟡 | [ProtectedRoute.tsx](../../web/src/routes/ProtectedRoute.tsx) only distinguishes `admin` vs `client` from `/auth/me`. Signed-in users visiting `/login` or `/request-access` are not redirected. No lifecycle states. Role is read from the server, not localStorage ✅. |
| 18 | Backend guards | 🟡 / 🔴 | Good: `AdminGuard`, `OrganizationScopeGuard` (membership + active license, from the path param, verified against the DB), `LicenseEntitlementGuard` (deny-by-default when no entitlement is declared ✅). Gap: the intelligence routes the client portal actually uses (`/campaigns*`, `/sms/alerts`) are `JwtAuthGuard` only (R1). |
| 19 | Organization public API | ⛔ | No `/api/v1`. Global prefix is `/api` ([main.ts:133](../../backend/src/main.ts:133)). |
| 20 | API keys | ⛔ (customer) / ✅ (internal) | Only internal machine keys from env (`AI_CAMPAIGNS_API_KEY`, etc.) with constant-time HMAC compare ✅. No customer credentials. |
| 21 | Tenant isolation | ✅ / 🟡 | `OrganizationScopeGuard` derives access from DB membership, not from trust in the URL ✅. Member role never consulted (R2). |
| 22 | Audit logs | 🟡 | `PortalAccessAudit` (suspend/restore/revoke) and `AccessRequestDeletionAudit` exist ✅. No general security event log (application decisions, activation, expiry, member changes, admin role changes). No API request log. |
| 23 | Tests | 🟡 | 36 backend unit specs + one e2e guard-wiring spec ([authorization.e2e-spec.ts](../../backend/test/authorization.e2e-spec.ts)). No lifecycle/tenant-isolation matrix tests. Web has one test file and it currently fails (`localStorage is not defined` in `authService.test.ts`). |

### 1.2 Current flow (as implemented)

```
Public /request-access (anonymous form, email NOT verified)
  → AccessRequest RECEIVED
  → admin: start review / request info / approve / decline
  → APPROVED: emailed single-use token link  →  /request-access/checkout
  → applicant accepts agreement (AGREEMENT_ACCEPTED)
  → Stripe Checkout (PAYMENT_PENDING)
  → verified webhook: AccessRequest ACTIVE, NEW PortalOrganization, License ACTIVE
  → /request-access/setup?session_id=…  (email OTP + set password = account created, OWNER membership)
  → /login (email + password + OTP) → /client/overview
```

Nothing exists after "license ends".

### 1.3 Security findings (fix regardless of redesign)

| ID | Severity | Finding | Fix |
|---|---|---|---|
| **R1** | High | A client session remains valid after the license expires, is cancelled, or goes past-due (cookie lives 7 days). `/campaigns`, `/campaigns/inactive`, `/campaigns/:id`, `/sms/alerts`, `POST /reports` only require `JwtAuthGuard`, so an expired customer keeps reading campaign intelligence. | Add a `LicensedClientGuard` on every client-audience intelligence route: `audience === CLIENT` ⇒ require an active license via membership; `MOBILE` audience keeps its current behavior; `ADMIN` passes. **Must land before sign-in is widened (Phase 8).** |
| **R2** | Medium | Member role is loaded but never checked. A `TIER_2` member can export (`DATA_EXPORT`) exactly like the `OWNER`. | Capability map per member role, enforced in a `MemberCapabilityGuard`. |
| **R3** | Medium | `POST /access-requests` does not verify email ownership. Anyone can file an application in someone else's name; the 409 message also reveals whether an email already has a portal account. | Email OTP before submission (the `EmailOtpChallenge` infra already exists); make the conflict response generic. |
| R4 | Low | Legacy `/auth/login` and `/auth/portal/register` return the JWT in the body (stored in localStorage by the web client). Enabled by default outside production, `410 Gone` in production. | Remove once the claim flow is the only path; drop the Bearer-from-localStorage fallback in [apiClient.ts](../../web/src/api/apiClient.ts). |
| R5 | Low | Stripe `canceled` cuts access immediately instead of at period end. | Map provider status → BantAI status with an effective date (§5.4). |

---

## 2. Conflicts between the spec and this repository

These need a decision rather than a blind rewrite.

| # | Spec says | Repository reality | Recommendation |
|---|---|---|---|
| C1 | Identity is created *before* the application (sign in → setup → apply). | Identity is created *after* payment (claim step). First-time applicants are anonymous until then. The spec explicitly allows "whichever path best matches the existing code". | **Keep the existing first-time path** (anonymous apply → pay → claim account), add email OTP at submission (R3). **All returning users apply authenticated.** See §9 D1. |
| C2 | `Workspace`, `WorkspaceMember`, `AccessApplication` entities. | `PortalOrganization`, `OrganizationMembership`, `AccessRequest` — used across backend, web, docs, and the manuscript. | **Extend, don't rename.** Add columns; use the spec names only in docs and DTOs. Renaming tables costs a large diff for zero behavior. |
| C3 | Member roles OWNER / MANAGER / ANALYST / VIEWER / RESEARCHER. | OWNER / TIER_1 / TIER_2, named in the thesis manuscript. | §9 D2. Default proposal: keep the enum, define capabilities: OWNER = owner; TIER_1 = analyst (read + export); TIER_2 = viewer (read-only masked summary). Add MANAGER only if the team needs it. |
| C4 | Application status separate from license status. | `AccessRequestStatus` contains `ACTIVE` and `EXPIRED`, and the Stripe webhook writes license states onto the application. | Stop mirroring. The application ends at `ACTIVE` (read as "activated"); the license is the only source of entitlement truth. Add `WITHDRAWN` and `SUPERSEDED`. |
| C5 | Account statuses ACTIVE / LOCKED / DISABLED plus access states SUSPENDED / REVOKED. | `portalAccessStatus: ACTIVE / SUSPENDED / REVOKED` on the user, with its own audit trail. | Keep. It already *is* the spec's account-level enforcement. Don't add LOCKED/DISABLED until something needs them. |
| C6 | Licensed "intelligence" (campaigns, relationships, evolution). | The license-gated feed only covers alerts from the workspace's own members' phones. Global campaign data is reachable by *any* signed-in user. | §9 D3. The license needs to gate a platform-wide, masked, delayed dataset, and that needs sign-off under the data-privacy position in the manuscript. |
| C7 | `/workspace`, `/setup`, `/application/status`, `/access/expired`. | `/client/*`, `/admin/*`, `/request-access/*`. | Keep `/client/*` and `/admin/*`. Add one authenticated namespace `/account/*` for every non-workspace lifecycle state (§4). |
| C8 | Organization public API with customer keys. | None. | Build it (Phases 13–15) only if it is in thesis scope (§9 D4); otherwise keep the public copy as "API when available". |

---

## 3. Proposed state machine

Resolved **server-side** by one function, `AccountStateService.resolve(userId)`, exposed as `GET /api/account/state`. Precedence (first match wins; unknown ⇒ `SAFE_DENY`):

1. no session → `ANONYMOUS`
2. `role = ADMIN` → `ADMIN`
3. `portalAccessStatus = REVOKED` → `REVOKED`
4. `portalAccessStatus = SUSPENDED` → `SUSPENDED`
5. `onboardingStatus ≠ COMPLETE` → `SETUP_REQUIRED`
6. active license on an active workspace → `ACTIVE_RESEARCH` / `ACTIVE_ORGANIZATION`
7. open application → `APPLICATION_PENDING` / `TERMS_REQUIRED` / `PAYMENT_REQUIRED` (by application status)
8. latest application `DECLINED` → `APPLICATION_DECLINED`
9. prior license exists and none active → `EXPIRED_RESEARCH` / `EXPIRED_ORGANIZATION` (or `LICENSE_SUSPENDED` if the license, not the user, is suspended)
10. otherwise → `READY_TO_REQUEST`

| State | Allowed routes | Allowed actions | Next states | Forbidden |
|---|---|---|---|---|
| `ANONYMOUS` | `/`, `/request-access`, `/request-access/checkout` (token), `/request-access/setup` (paid session), `/login`, legal/help | Submit first application (email OTP-verified), accept terms via token, pay, claim account | `SETUP_REQUIRED` (after claim) | Everything under `/client`, `/admin`, `/account` |
| `SETUP_REQUIRED` | `/account/setup/*`, logout | Complete profile, confirm terms version | Resolved next state (usually `ACTIVE_*`) | Workspace, admin, public auth pages (redirect back to setup) |
| `READY_TO_REQUEST` | `/account/request`, `/account`, logout | Start an authenticated application | `APPLICATION_PENDING` | Workspace data |
| `APPLICATION_PENDING` (RECEIVED / UNDER_REVIEW / MORE_INFO_REQUIRED) | `/account/application`, `/account`, logout | View request, answer an info request, withdraw | `TERMS_REQUIRED`, `APPLICATION_DECLINED`, `READY_TO_REQUEST` (withdrawn) | New application (server-enforced), workspace data |
| `TERMS_REQUIRED` (APPROVED) | `/account/application`, `/account/terms`, logout | Accept current agreement version | `PAYMENT_REQUIRED` | Workspace data |
| `PAYMENT_REQUIRED` (AGREEMENT_ACCEPTED / PAYMENT_PENDING) | `/account/payment`, `/account/payment/result`, `/account`, logout | Start/resume Stripe Checkout | `ACTIVE_*` (webhook only) | Workspace data; any client-side "paid" flag |
| `APPLICATION_DECLINED` | `/account/application`, `/account/request` (if the cooldown has passed), logout | View decision; re-apply after the server-enforced cooldown | `APPLICATION_PENDING` | Workspace data |
| `ACTIVE_RESEARCH` | `/client/*` minus API/team/billing, `/account` | Read masked delayed intelligence, limited export | `EXPIRED_RESEARCH`, `SUSPENDED`, `REVOKED`, `APPLICATION_PENDING` (upgrade request runs in parallel, state stays ACTIVE) | API, API keys, team, billing, admin |
| `ACTIVE_ORGANIZATION` | `/client/*` filtered by member capability, `/account` | Per member role (§6) | `EXPIRED_ORGANIZATION`, `LICENSE_SUSPENDED`, `SUSPENDED`, `REVOKED` | Admin, other workspaces |
| `EXPIRED_RESEARCH` / `EXPIRED_ORGANIZATION` | `/account/expired`, `/account/request` (prefilled), `/account/application`, `/account`, logout | Request access again (new linked application) | `APPLICATION_PENDING` | Workspace data, API (keys stay recorded but stop authorizing) |
| `LICENSE_SUSPENDED` (license-level, e.g. past-due) | `/account/status`, `/account/payment` if it is a billing issue, logout | Fix payment / contact support | `ACTIVE_*`, `EXPIRED_*` | Workspace data, re-apply |
| `SUSPENDED` (user) | `/account/status`, logout | Contact support | `ACTIVE_*` (admin restore only) | Everything else, re-apply |
| `REVOKED` (user) | `/account/status`, logout | None | — (admin only) | Everything else, re-apply |
| `ADMIN` | `/admin/*`, `/account` | Admin operations (backend `AdminGuard`) | — | Client workspace routes (admins aren't tenants) |

**Invariant:** approval never grants data access. Only a webhook-activated license does (already true).

---

## 4. Route-access matrix (web)

One constant, `web/src/routes/accessMatrix.ts`, maps each state to route groups. One component, `<LifecycleRoute group="…">`, replaces `ProtectedRoute`'s `role` prop. It calls `/api/account/state` once per navigation (cached in context), renders when the group is allowed, and otherwise does `<Navigate replace to={state.destination}>`.

- `/login` and `/request-access` with an active session → `replace` to `destination` (no second sign-in screen, no anonymous form for known users).
- `/account/*` pages use a new `SetupLayout`: logo + "Account setup", step indicator, and a quiet **Log out** action. No Back-to-site, Back-to-sign-in, public header, pricing, or footer links. Previous moves between setup steps only.
- Browser back is left alone; guards re-resolve on every route change. Security never depends on history.

Frontend matrix = UX only. The backend enforces the same rules independently (§5).

---

## 5. Backend authorization design

### 5.1 AuthContext

Built once per request by a guard after `JwtAuthGuard`, from the DB (never from the token or the body):

```
AuthContext { userId, audience, platformRole, accountStatus, onboardingStatus,
              state, workspaceId?, workspaceType?, memberRole?, licenseId?,
              licenseStatus?, entitlements, capabilities }
```

The JWT keeps carrying only `sub` + audience, as now. Role and status are already re-read per request; the license will be too. This removes stale-session risk with no token-refresh machinery.

### 5.2 Guards (deny by default)

| Guard | Applies to | Checks |
|---|---|---|
| `JwtAuthGuard` (exists) | all authenticated | signature, audience secret, user exists, `portalAccessStatus` |
| `AdminGuard` (exists) | `/admin/*`, admin controllers | `role = ADMIN` and `audience = ADMIN` |
| `LicensedClientGuard` (**new**, R1) | client intelligence routes | CLIENT audience ⇒ active license + active workspace; MOBILE unchanged |
| `OrganizationScopeGuard` (exists) | `/portal-organizations/:organizationId/*` | membership + active license |
| `LicenseEntitlementGuard` (exists) | same | tier feature flag |
| `MemberCapabilityGuard` (**new**, R2) | team, API keys, export, billing | capability for `memberRole` |
| `SetupCompleteGuard` (**new**) | everything a `SETUP_REQUIRED` user must not reach | `onboardingStatus = COMPLETE` |
| `ApiCredentialGuard` (**new**, Phase 14) | `/api/v1/*` only | §7 pipeline |

### 5.3 Sign-in change (Phase 8 — only after 5.2 is in place)

`requestPortalEmailOtp` currently refuses unlicensed users. The target: any web portal identity (password set, `role = USER`, not REVOKED) receives a CLIENT session, and the resolver decides what it may see. This is safe **only once** every client data route checks the license (R1). Order is critical.

### 5.4 Stripe → BantAI mapping

| Stripe | License status | Access |
|---|---|---|
| `active`, `trialing` | ACTIVE | yes |
| `past_due` | PAST_DUE | yes until `validUntil + GRACE_DAYS` (policy, default 0) |
| `unpaid`, `incomplete`, `paused` | SUSPENDED | no; state `LICENSE_SUSPENDED` |
| `canceled` | ACTIVE until `current_period_end`, then EXPIRED | until period end |
| `incomplete_expired` | EXPIRED | no |

A daily `@Cron` (the `ScheduleModule` is already registered) flips `ACTIVE` licenses past `validUntil` to `EXPIRED` and writes `LICENSE_EXPIRED` audit events. Authorization does **not** depend on the cron, since guards already compare `validUntil` to now.

---

## 6. Authorization matrix

✓ allowed · ✗ denied · R read-only · L limited by tier policy · — not applicable

| Capability | Public | Setup req. | Pending | Research | Org TIER_2 (viewer) | Org TIER_1 (analyst) | Org OWNER | Expired | Admin |
|---|---|---|---|---|---|---|---|---|---|
| Workspace dashboard | ✗ | ✗ | ✗ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ (admin overview) |
| Campaigns / intelligence | ✗ | ✗ | ✗ | L (delayed, masked) | R | ✓ | ✓ | ✗ | ✓ (admin views) |
| Reports | ✗ | ✗ | ✗ | L | R | ✓ | ✓ | ✗ | ✓ |
| Exports | ✗ | ✗ | ✗ | L (5k rows) | ✗ | ✓ | ✓ | ✗ | ✓ |
| API read (`/api/v1`) | ✗ | ✗ | ✗ | ✗ | via key only | via key only | via key only | ✗ (keys stop working) | ✗ |
| API key management | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | revoke only |
| Team management | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ | ✓ |
| Billing | ✗ | ✗ | ✗ | own license, R | ✗ | ✗ | ✓ | payment of new request | R (status) |
| Submit application | first-time only, email OTP | ✗ | ✗ (one open) | upgrade request | ✗ | ✗ | ✓ (renew/upgrade) | ✓ (linked re-request) | ✗ |
| Application review | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |
| User management | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | own team | ✗ | ✓ |
| System settings | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✓ |

Admin role can only be granted by a controlled internal operation (seed script / DB), never via any endpoint. That is already true; keep a test for it.

---

## 7. Organization public API (Phases 13–15, only if in scope)

- Separate controller tree under `/api/v1/*`, DTO-only responses, and **no** reuse of the internal web routes.
- `ApiCredential { id, workspaceId, name, prefix, secretHash, scopes[], status, createdById, createdAt, lastUsedAt, expiresAt, revokedAt }`.
  - Secret: `bantai_live_` + 32 bytes `randomBytes`, base62. Store `prefix` (first 8 chars) + HMAC-SHA256 with a server pepper (`API_KEY_PEPPER`). Shown once. No reveal endpoint. Never logged.
  - Header only: `Authorization: Bearer …`. Query-string keys are rejected.
- Pipeline: parse → prefix lookup → constant-time hash compare → active / not expired / not revoked → workspace (from the credential only) → workspace `type = ORGANIZATION` and active license with `API_ACCESS` → scope → rate limit (per credential and per workspace, `@nestjs/throttler` custom tracker) → cursor pagination (max 100) → masked DTO → `ApiRequestLog`.
- Scopes: `campaigns:read`, `intelligence:read`, `indicators:read`, `reports:read`, `exports:read`. No admin/system scopes.
- Keys issued before a license expired stay recorded but never authorize again. After reactivation, new keys are required (safer default).
- Error envelope: `{ error: { code, message, requestId } }` via an exception filter scoped to `/api/v1`.
- HTTPS: production already enforces HTTPS for `FRONTEND_URL`; add a `x-forwarded-proto` check for `/api/v1` behind the existing `trust proxy` setting.

---

## 8. Database plan

Current models touched: `User`, `PortalOrganization`, `OrganizationMembership`, `AccessRequest`, `License`. New: `AuditEvent`, `ApiCredential`, `ApiRequestLog`.

Per project memory, `prisma migrate dev` is broken here (duplicate `OtpCode`), so use `prisma migrate diff` → hand-review → `prisma migrate deploy`. All steps are **additive first**. No column is dropped in this plan.

| Step | Migration | Change | Backfill | Rollback risk |
|---|---|---|---|---|
| M1 | `account_onboarding_status` | `User.onboardingStatus` enum `NOT_STARTED / IN_PROGRESS / COMPLETE` default `NOT_STARTED`; `User.emailVerifiedAt` | Portal users with `passwordHash` → `COMPLETE` + `emailVerifiedAt = createdAt` (they proved email via claim OTP); admins → `COMPLETE`; mobile users → `COMPLETE` (web setup does not apply) | Low — additive |
| M2 | `workspace_type_and_status` | `PortalOrganization.type` (`AccessRequestTier`, nullable first), `status` enum `PENDING / ACTIVE / INACTIVE / SUSPENDED / ARCHIVED` | `type` from its latest license tier; `status` from `isActive`. Then make `type` required. Keep `isActive` until code stops reading it (later migration) | Low |
| M3 | `membership_status` | `OrganizationMembership.status` `ACTIVE / REMOVED`, `removedAt` | all `ACTIVE` | Low |
| M4 | `application_history_links` | `AccessRequest.applicantUserId` (FK User, **not unique**), `previousAccessRequestId` (self FK), `workspaceId` semantics: drop `@unique` on `portalOrganizationId` and `portalUserId`; statuses `WITHDRAWN`, `SUPERSEDED` | `applicantUserId = portalUserId` | **Medium** — dropping uniques changes Prisma relation types (`User.licensedAccessRequest` becomes a list), so `auth.service.ts`, `UsersPage.tsx`, `listAdministrativeAccounts` must change in the same PR |
| M5 | `one_open_application` | Raw-SQL partial unique index: `CREATE UNIQUE INDEX … ON "AccessRequest"(lower(email)) WHERE status IN ('RECEIVED','UNDER_REVIEW','MORE_INFO_REQUIRED','APPROVED','AGREEMENT_ACCEPTED','PAYMENT_PENDING')` | Pre-check: `SELECT lower(email), count(*) … HAVING count(*) > 1` must return 0 | Medium — fails if duplicates exist; the pre-check is mandatory |
| M6 | `license_revoked_and_supersession` | `LicenseStatus.REVOKED`, `License.revokedAt`, `supersedesLicenseId` | none | Low |
| M7 | `audit_event` | `AuditEvent { id, type, actorUserId?, targetUserId?, workspaceId?, accessRequestId?, licenseId?, metadata Json, requestId, createdAt }`, indexes `(type, createdAt)`, `(workspaceId, createdAt)`, `(targetUserId, createdAt)` | none (PortalAccessAudit stays; new events go here) | Low |
| M8 | `api_credentials` (if D4) | `ApiCredential`, `ApiRequestLog`; `@@unique([prefix])`, `@@index([workspaceId, status])` | none | Low |

Existing users are preserved throughout: no row is deleted, no identity merged, no license rewritten. Re-activation *reuses* the workspace linked through `previousAccessRequestId` instead of creating a new `PortalOrganization`.

---

## 9. Decisions needed before Phase 2

| ID | Question | Recommendation |
|---|---|---|
| **D1** | First-time applicants: keep "apply anonymously → pay → claim account" (current), or require an account before applying? | Keep the current path, add email OTP at submission. Returning users apply authenticated. Fewer moving parts before the defense. |
| **D2** | Member roles: keep manuscript `OWNER / TIER_1 / TIER_2` with defined capabilities, or rename to `OWNER / MANAGER / ANALYST / VIEWER`? | Keep the enum, define capabilities (§6). Renaming changes the manuscript. |
| **D3** | What does a license actually unlock: platform-wide masked, delayed campaign and classification data, or only alerts from the workspace's own enrolled phones (today)? | Platform-wide masked aggregate. It needs a privacy/adviser sign-off because it moves data across users. |
| **D4** | Is the Organization public API (`/api/v1` + keys) in thesis scope now? | Only if D3 is settled; otherwise defer and keep the public copy as "API when available". |

---

## 10. Phases (reordered for safety)

The spec's phases are kept, but two are pulled forward because later steps depend on them for security:

| Order | Phase | Content | Depends on |
|---|---|---|---|
| 1 | **5a. Close R1 + R2** | `LicensedClientGuard` on client intelligence routes; member capability map | — (ship now) |
| 2 | 2–3. State model + M1–M7 | Migrations above | D1, D2 |
| 3 | 4. Resolver | `AccountStateService` + `GET /api/account/state` + unit tests per state | 2 |
| 4 | 5b. Guards | `SetupCompleteGuard`, AuthContext | 3 |
| 5 | 16. Audit events | Emit on every transition from here on | M7 |
| 6 | 7. Application lifecycle | email OTP at submit (R3), one-open rule, withdraw, stop mirroring license → application | 3 |
| 7 | 8. Widen sign-in + expired re-request | CLIENT sessions for unlicensed identities, `/account/expired`, prefilled linked re-request, workspace reuse on activation | **1 and 4 must be done** |
| 8 | 12. Payment / Stripe mapping | §5.4, expiry cron | 7 |
| 9 | 6 + 17. Web lifecycle routing | `accessMatrix`, `LifecycleRoute`, `SetupLayout`, `/account/*` pages, tier/role nav | 3 |
| 10 | 9–11. Research / Org / Admin enforcement | Nav + endpoint coverage per §6; admin sees returning-applicant history | 9 |
| 11 | 13–15. Public API | only if D4 | D3, D4 |
| 12 | 18. Tests | Matrix below, e2e per state with seeded fixtures | continuous |
| 13 | 19. UX polish | copy, empty states | — |

### Test matrix (backend e2e, seeded fixtures)

Unauthenticated → workspace 401 · setup-incomplete → dashboard 403 + `state = SETUP_REQUIRED` · pending → intelligence 403, second application 409 · expired (session still valid) → `/campaigns` 403 (**R1 regression test**) · expired keeps the same `User.id` and can create a linked application · expired Research → org endpoints 403 · suspended → 401 · Research → API/team 403 · Org A member → Org B `:organizationId` 403 · TIER_2 → export 403 · client → any `/admin/*` 403 · no endpoint accepts `role` (DTO whitelist test) · API: wrong scope / revoked / expired key / expired license / tampered `workspaceId` / foreign object ID → 401/403 · key plaintext absent from DB and logs · rate limit → 429.

Validation after implementation runs these as real flows against a seeded local DB (fresh, active Research, active Org, expired Research, expired Org, pending, declined, approved-unpaid, setup-incomplete, suspended, revoked, each member role, admin), not just "it compiles".
