# Shield and Admin migration plan (2026-09-29)

Status: implementation plan based on the current dirty checkout. Preserve all existing uncommitted work. Do not commit or merge from this session.

## Current boundary audit

- `User.role` is `USER | ADMIN`; mobile identities and portal accounts share `User`. Portal identity is differentiated by JWT audience, portal status, onboarding and licenses. A blanket `USER -> SHIELD` migration would grant mobile users web access.
- Organization membership currently grants `OWNER | TIER_1 | TIER_2` capabilities. Access requests and licenses distinguish `RESEARCH | ORGANIZATION`. This is the old external product model, spread through Prisma, access requests, entitlement policy, portal organization services and web flows.
- `JwtAuthGuard` runs `PortalRoutePolicy` for portal sessions, which denies undeclared routes. Keep this server-side gate while replacing old capabilities. `AdminGuard` checks internal Admin authorization. Machine `ApiKeyGuard` is for AI service credentials, not subscriber keys.
- `GET /campaigns/:id` currently serializes a complete cluster via Prisma `include`, including the centroid and up to 25 linked message records. The Shield response must use an explicit allowlist and no message samples. Mobile campaign behavior needs a separate response path.
- Portal organization alert reads and `/:organizationId/export` expose an old dataset-oriented surface. Shield export must instead use the same approved campaign DTO as the campaign API.
- The web router and navigation still expose `/client/messages`, `/client/export`, tiered access and a shared campaign detail view with message content. Hide/removal in React alone does not authorize a route.
- Existing `audit` services can be extended for privileged Admin actions; present portal account audit is narrower than the requested action trail.

## Migration sequence

1. **Identity and account migration.** Add a nullable web role with exactly `SHIELD | ADMIN`. Mobile-only users retain no web role and keep mobile JWT audience/contracts. Backfill Admin from existing Admin accounts; backfill Shield only for established portal accounts, with no automatic privilege for ordinary mobile users. Preserve account, organization, license, payment and Stripe identifiers/history. Replace Research/Organization tier choices with one Shield subscription while retaining organization name as metadata. Map existing licenses explicitly and flag conflicting active records for review.
2. **Deny-by-default route policy.** Keep audience checks, AdminGuard, and active license checks. Replace membership tier capabilities with a single Shield permission set: own account/key/usage management, read approved campaign intelligence, and scoped campaign export. Remove Shield access to `/sms`, reports, organization alert datasets, model metrics, internal operations and campaign writes. Keep established mobile routes working.
3. **Published campaign data boundary.** Separate internal cluster/operational records from approved Shield intelligence. Add explicit Shield-safe campaign, indicator, timeline, masked-message and export serializers. Select fields deliberately at the database layer and return no internal IDs, centroid, raw body, sender, user/device metadata or examples in regular Shield web responses. Publish only reviewed de-identified masked messages through the dedicated API; omit ambiguous samples. Use one serializer for JSON/CSV/PDF exports.
4. **Subscriber API credentials.** Add hashed, tenant-bound keys with scopes limited to campaign reads, indicators, masked messages and campaign exports. Show the plaintext secret once at creation/rotation; persist a hash and display prefix/suffix only. Check role, account status, subscription, scope, quota/rate limit and tenant on each request. Keep these keys separate from AI service credentials. Make usage tenant-scoped.
5. **Admin operations and audit.** Add guarded campaign management, report/classification/FP-FN review, restricted raw-data access where the data exists, Shield account/key controls and operational pages only where backed by services. Record actor, action, target, time, result and safe context for access-changing or restricted-data actions, without logging secrets or SMS content.
6. **Portal redesign.** Rename external portal Shield. Limit navigation to Overview, Campaigns, API, Exports, Notifications, Documentation and Account. Normal campaign detail describes campaign patterns and never renders message samples. Redirect retired client URLs to safe Shield destinations. Keep Admin navigation operational and distinct. Reuse current components/tokens and provide accessible loading, error and empty states.
7. **Verification and rollout.** Run schema migration against representative existing accounts, including old tiers and mobile-only users. Test all 18 requested acceptance cases with real HTTP guards plus cross-tenant ownership, expired/suspended subscriptions and API keys, secret one-time display, malicious masked-text fixtures, recursive export field checks and mobile regression tests. Verify a rendered Shield/Admin desktop and mobile browser experience. Deploy database migration and backend before exposing the new web route; invalidate old sessions where claims no longer match. No WBS completion checkbox is justified until code is committed by the team.

## Execution boundaries

Backend authorization and serialization must land before the Shield UI consumes them. Current uncommitted changes in backend, web, AI and mobile belong to ongoing work and must not be reset or broadly staged. No direct push to `develop`, no Codex-authored commit, and no edit to Gio-owned WBS or DEV_LOG files from this track.

## Confirmed privacy decision (2026-09-30)

The user confirmed that original raw SMS stays on the phone and is not stored by BantAI's backend. Any Admin review of restricted message/report records is limited to the masked data the backend actually retains. The pasted acceptance case that calls for Admin access to raw SMS is superseded by this decision.
