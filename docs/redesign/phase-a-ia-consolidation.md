# Phase A: IA Consolidation Diff

Status: proposal. No files delete or move in this document. Review before executing.

## Verification methodology

Each proposed change below is backed by one of:

- `AppRoutes.tsx` route trace (authoritative source of what the app actually routes)
- `git grep` for imports of the file/module across `web/src/`
- Visual browser inspection at `localhost:5173` confirming the current behavior

Any change without evidence is marked as `pending trace`.

## Route consolidation

Route count today: 34 unique routes.
Route count after Phase A: 20 unique routes.

### Remove (redundant)

| Route | Reason | Evidence |
|---|---|---|
| `/admin/notifications` | Renders `<AdminSettingsPage notifications />`, which flips the internal `activeTab` state to `notifications`. The `AdminSettingsPage` component already has a `notifications` tab in its own tab UI. | `web/src/pages/admin.tsx:14737` `activeTab` state includes `notifications`. `web/src/routes/AppRoutes.tsx:100-103` |
| `/client/notifications` | Same pattern on the client side. `<ClientSettingsPage notifications />` flips a tab. | `web/src/routes/AppRoutes.tsx:76-78` |

Replacement: link to `#notifications` fragment on the settings route, or use a query param (`?tab=notifications`). Existing bookmarks stay working via redirect (see Redirects section).

### Consolidate to tabbed pages

| Old routes | New route | Tabs | Evidence |
|---|---|---|---|
| `/admin/model`, `/admin/concept-drift`, `/admin/dataset`, `/admin/classification`, `/admin/fpfn` | `/admin/model` | `Overview | Classification | FP/FN | Concept Drift | Training Dataset` | Five separate page components share one conceptual object (the ML model). Sidebar currently lists all five under `AI MODEL & DATASET`. |
| `/admin/server`, `/admin/api-logs`, `/admin/db-storage` | `/admin/system` | `Server | API Logs | Database` | The Server Monitoring page ALREADY renders these as tabs. Confirmed at `localhost:5173/admin/server`. Three routes render three flavors of the same tabbed page. |

Tab state syncs to URL via query param (`/admin/model?tab=fp-fn`) so links, browser back/forward, and page refresh all work.

### Convert to drill-down

| Old route | New behavior | Reason |
|---|---|---|
| `/admin/timeline` | Reachable only via click on a campaign card at `/admin/campaigns`. New nested route: `/admin/campaigns/:id/timeline`. | Confirmed at `localhost:5173/admin/timeline`: the page renders per-campaign event history for a specific campaign (`Operation OCash Clone #17`). It has no meaning without a campaign selected. Top-level sidebar placement is IA-backwards. |

### Convert to modal/inline action

| Old route | New behavior | Reason |
|---|---|---|
| `/client/export` | Delete route. Export CSV button already exists in the Messages toolbar (confirmed visually). Add same button to Campaigns and Analytics toolbars if missing. | Route duplicates functionality already correctly placed in-context. |
| `/admin/export` | Delete route. Export button lives on the toolbars of Reports, Users, Campaigns. | Same reasoning. |
| `/forgot-password` | Optional. Leaving as-is is defensible (route-based auth flow). If we do consolidate, the login page opens a modal. Deferred decision. | Route works fine today. Cost of change is not obvious. |

### Merge

| Old routes | New route | Reason |
|---|---|---|
| `/admin-login` + `/login` | `/login` with role detection post-auth | Two login URLs is not a security feature. It doubles auth surface for zero user benefit. |

## Redirects to preserve (backwards compatibility)

Every route that goes away gets a redirect for one release cycle, so existing bookmarks and links (in docs, screenshots, PDFs, thesis material) do not 404.

| Old path | Redirect target |
|---|---|
| `/admin/notifications` | `/admin/settings?tab=notifications` |
| `/client/notifications` | `/client/settings?tab=notifications` |
| `/admin/concept-drift` | `/admin/model?tab=concept-drift` |
| `/admin/dataset` | `/admin/model?tab=dataset` |
| `/admin/classification` | `/admin/model?tab=classification` |
| `/admin/fpfn` | `/admin/model?tab=fp-fn` |
| `/admin/api-logs` | `/admin/system?tab=api-logs` |
| `/admin/db-storage` | `/admin/system?tab=database` |
| `/admin/timeline` | `/admin/campaigns` (with a query hint to open the last-viewed campaign timeline drawer) |
| `/admin/export` | `/admin/reports` |
| `/client/export` | `/client/messages` |
| `/admin-login` | `/login` |

Redirect implementation: `<Route path=... element={<Navigate to=... replace />} />`. Existing `/profile` and `/settings` redirects (`AppRoutes.tsx:59-65`) show the pattern.

## File consolidation

### Split megafiles into per-page files

These are not deletions, they are moves. Each screen becomes its own file, imported by a barrel.

| Current file | Split into |
|---|---|
| `web/src/pages/admin.tsx` (16,460 lines, 16 page components) | `web/src/pages/admin/OverviewPage.tsx`, `ReportsPage.tsx`, `ModelPage.tsx`, `CampaignsPage.tsx`, `TimelinePage.tsx` (or drawer component if Timeline becomes drill-down), `UsersPage.tsx`, `SystemPage.tsx`, `TipsPage.tsx`, `SettingsPage.tsx`, plus `web/src/pages/admin/index.ts` barrel |
| `web/src/pages/client.tsx` (5,273 lines, 7 page components) | `web/src/pages/client/OverviewPage.tsx`, `MessagesPage.tsx`, `CampaignsPage.tsx`, `AnalyticsPage.tsx`, `HelpPage.tsx`, `SettingsPage.tsx`, plus `web/src/pages/client/index.ts` barrel |

The barrel re-exports match the current `import { AdminOverviewPage, ... } from '../pages/admin'` pattern in `AppRoutes.tsx`, so route wiring does not change.

Splitting is mechanical (cut, paste, verify imports). It should be one PR per megafile so each is reviewable independently.

### Verified unused (deletion deferred)

These three standalone files exist but are not imported anywhere:

| File | Status | Deferred until |
|---|---|---|
| `web/src/pages/About.tsx` (123 lines) | Verified unused. Older, less-featured version. Route uses `About/index.tsx` (625 lines). | Phase F step 9 (public page migration) |
| `web/src/pages/HowItWorks.tsx` (185 lines) | Verified unused. Route uses `HowItWorks/index.tsx` (913 lines). | Phase F step 9 |
| `web/src/pages/Research.tsx` (140 lines) | Verified unused. Route uses `Research/index.tsx` (557 lines). | Phase F step 9 |

Evidence: `git grep` for `(About|HowItWorks|Research)` under `web/src/` returns only three lines, all in `AppRoutes.tsx`, all pointing to the `/index` folder version. No dynamic or lazy imports.

They are safe to delete now but the correction explicitly says to defer, and Phase F reworks these three pages anyway. When Phase F starts and confirms the `/index` versions are the ones being improved, these get deleted in the same PR.

## Order of operations for Phase A

Run in this sequence. Each item is one PR. Nothing here starts until the plan review is signed off.

1. **Add redirects for all routes that will go away.** Ship redirects BEFORE removing the destination pages, so nothing 404s. Safe, additive, zero user impact.
2. **Split `admin.tsx` into per-page files under `web/src/pages/admin/`.** Barrel keeps imports working. No behavior change.
3. **Split `client.tsx` into per-page files under `web/src/pages/client/`.** Same as above.
4. **Drop `/admin/notifications` and `/client/notifications` routes.** Tabs already exist. Redirects from step 1 handle old bookmarks.
5. **Consolidate ML routes under `/admin/model` with tabs.** Move the five page components into tabs within `ModelPage.tsx`. Redirects from step 1 point old URLs at the right tab.
6. **Consolidate system routes under `/admin/system` with tabs.** The tabbed page already exists; the work is renaming and redirect wiring.
7. **Move Timeline to drill-down.** Add `/admin/campaigns/:id/timeline` and a "View timeline" action on campaign cards. Delete `/admin/timeline` route.
8. **Delete `/client/export` and `/admin/export` routes.** Verify export buttons exist in the toolbars they need to; add where missing.
9. **Merge `/admin-login` into `/login`.** Add role detection. Redirect `/admin-login` to `/login`.

Everything after step 9 belongs to later phases (App shell, tokens, screen migration, etc.).

## Nothing deletes in this document

This document is a diff proposal. No file changes on disk until each numbered step above ships as its own PR and passes review. If any of the above is wrong (a route we thought was redundant is actually being used elsewhere, a bookmark path that must be preserved, a tab state that is more complex than the current code suggests), correct here before executing.
