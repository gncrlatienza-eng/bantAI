# Phase B: Post-Authentication Navigation & Structure Plan

Status: implemented 2026-10-17 on `bugfix/web-admin-dashboard-fixes` (uncommitted). Not done: export row action on the Shield campaign list, `⌘K` command palette. Builds on
`phase-a-ia-consolidation.md` (Model/System tabs and `/login` merge already shipped).

Scope: everything a signed-in person sees in the web portal.
- Admin portal (`/admin/*`, `AppShell role="admin"`)
- Shield client portal (`/shield/*`, `AppShell role="client"`) and `/account`

Theme is kept as-is: the `mineral` tokens (mulberry brand, porcelain/fog
surfaces, warm-ink text, Geist / Geist Mono) and the rule that threat colours
are for classification only. This plan changes structure and hierarchy, not
the palette.

---

## 1. Verdict: is the current structure good enough?

**The foundations are good, the structure isn't there yet.** The shell (left
sidebar + 60px top bar + in-canvas page header), the token system, the
permission-gated navigation and the Model/System tab pattern all match what
enterprise consoles do. What holds it back from feeling "enterprise" is:

| # | Finding | Evidence | Why it matters |
|---|---|---|---|
| F1 | **13 sidebar items in the admin portal**, 7 of them in one "Administration" group mixing customer ops, app content, infrastructure and personal settings. | `web/src/pages/admin/adminNav.tsx` | Shopify caps app nav at 7 items before "View more"; NN/g allows 7–9+ only when grouped and ordered by use. Our longest group is a junk drawer. |
| F2 | **Review work is split across 4 places**: Reports page, Sender reports page, Model → Review queue, Model → FP/FN reviews (which is a filtered view of reports). | `ReportsPage.tsx`, `SenderReportsPage.tsx`, `ModelPage.tsx` TABS | An analyst has to visit 3 screens to clear "things waiting on me". Enterprise consoles group by task, not by data source. |
| F3 | **Duplicate screen**: Mobile sync and Model → Classification log both call `getAdminClassificationHistory`. | `MobileSyncPage.tsx:20`, `ModelPage.tsx:326` | Same data, two names, two places. |
| F4 | **Settings shows twice** — in the sidebar and in the avatar menu. Notification inbox is a bell route, preferences live in Settings. | `adminNav.tsx`, `AccountMenu.tsx`, `SettingsPage.tsx` | Atlassian/Carbon put personal settings and notifications in the top bar's utility area, not in product navigation. |
| F5 | **Every page mounts its own `AppShell`.** Each page repeats `groups`, `brandLabel`, `topbarContext`, `onNavigate`. | 30+ pages; the comment in `AppShell.tsx` explaining `lastKnownUser` exists because of this. | Sidebar/top bar re-render on every navigation, breadcrumb strings drift, and new pages copy boilerplate. |
| F6 | **Breadcrumbs are hand-typed and inconsistent**: Overview says "System Administration · Overview", Model says "Intelligence · Model", Export says "Administration · Export". | `topbarContext` props | Should be derived from one route registry. |
| F7 | **Shield portal leaves its own shell.** "Account" in the Shield sidebar goes to `/account`, which renders `AccountLayout` (a different layout). Shield has no bell and no avatar menu — `AppShell` only renders them for `role === 'admin'`. | `clientNav.tsx`, `AppShell.tsx:190-209` | The client loses the sidebar mid-session; utilities are in the sidebar instead of the top bar. |
| F8 | **Shield "Exports" is a whole page for one action** — exporting a single campaign. | `pages/client/ExportPage.tsx` ("Export one published campaign at a time") | Shopify: don't make a destination out of an in-page action. It belongs on the campaign. |
| F9 | **An admin with no staff role sees only "Settings"** in the sidebar but still lands on Overview (whose data then fails). | Observed live with the local fixture admin (`staffRole: null` → `permissions: []`). | Landing should be the first route the person can actually use. |
| F10 | **Model has 6 tabs.** | `ModelPage.tsx` TABS | NN/g: "the fewer tabs, the better"; tabs should be one-to-two-word views of the same object. |

So: **yes, the sidebar should shrink, and yes, several items should become
sub-screens (tabs) inside a parent screen.** Section 3 gives the target.

---

## 2. What the research says (rules this plan follows)

| Rule | Source |
|---|---|
| Sidebar holds **product destinations**; the top bar holds **utilities** (search, notifications, settings, profile). | Atlassian new navigation (2025); Carbon UI shell header |
| **Two levels max.** A third level becomes **tabs inside the page**. | Carbon UI shell left panel; GitLab Pajamas navigation sidebar |
| Use a left panel when there are **more than five** destinations; keep labels **1–2 words**, always visible, nouns not verbs. | Carbon; GitLab; Shopify app nav; NN/g vertical nav |
| About **seven** primary items before overflow; order by frequency, least important at the bottom. | Shopify app nav; NN/g vertical nav; Material navigation drawer |
| Tabs: few, short, **related views of the same thing**, selected state shown two ways (e.g. underline + weight), single row, tab changes the URL. | NN/g "Tabs, Used Right"; Primer NavList/UnderlineNav |
| Settings split into **personal vs workspace**, reached from the avatar/settings area, with its own list of sections. | Stripe (Personal / Account / Product settings); Linear settings redesign (Dec 2024); GitHub settings NavList |
| Don't repeat nav links as cards, don't turn page actions into destinations, give child pages a way back (breadcrumb). | Shopify app design guidelines; Primer navigation |
| Role-based visibility is fine, but **item names and order stay the same** for everyone. | GitLab Pajamas |
| Universal search / command palette is now standard in large consoles. | Vercel universal search (2026); Stripe keyboard shortcuts |

---

## 3. Target structure

### 3.1 Admin portal — 13 items → 8 items

```
┌──────────────────────────┐
│ ▣ BantAI Admin           │
│                          │
│   Overview               │
│   Review            12   │  ← pending count
│   Campaigns              │
│   Messages               │
│   Model                  │
│                          │
│ MANAGE                   │
│   Customers          3   │  ← pending access requests
│   Tips                   │
│   System                 │
└──────────────────────────┘
Top bar:  Review / Sender reports        [⌘K]  [🔔]  [Avatar ▾]
                                                       ├ Settings
                                                       └ Sign out
```

| Sidebar item | Becomes | Sub-screens (tabs, URL-synced) | Absorbs today's |
|---|---|---|---|
| **Overview** | Dashboard | — | Overview |
| **Review** *(new hub)* | Everything waiting on a human decision | **Message reports** · **Sender reports** · **Detections** | Reports, Sender reports, Model → Review queue |
| **Campaigns** | List → detail | (detail page keeps its sections) | Campaigns |
| **Messages** | Masked classified-message feed + sync stats | — (filters, not tabs) | Mobile sync **+** Model → Classification log (same API) |
| **Model** | ML lifecycle | **Overview** · **Drift** · **Dataset** · **Errors** | Model (6 tabs → 4; FP/FN renamed "Errors") |
| **Customers** *(new hub)* | Shield business operations | **Requests** · **Accounts** · **API usage** | Access requests, Users, Shield API |
| **Tips** | App content | — | Tips |
| **System** | Platform operations | **Health** · **API logs** · **Storage** · **Audit** · **Exports** | System, Export (Audit already moved here) |
| *(avatar menu)* **Settings** | Personal | **Profile** · **Notifications** | Settings (removed from sidebar) |
| *(bell)* Notifications inbox | Unchanged route, bell only | — | already done |

Why "Review" is the most important change: Support handles message and
sender reports, Analysts handle detections. One hub with permission-gated tabs
gives each role exactly one place to work, and the sidebar badge shows the
total waiting.

**Permissions do not change.** Each tab keeps its current guard; a hub is
visible when at least one of its tabs is.

| Tab | Permission (unchanged) |
|---|---|
| Review → Message reports | `reports:read` |
| Review → Sender reports | `verification:read` |
| Review → Detections | `models:read` (backend `DatasetsController`) |
| Customers → Requests / Accounts | `access_requests:manage` |
| Customers → API usage | `*` |
| System → Health / API logs / Storage | `system:read` |
| System → Audit / Exports | `*` |
| Messages, Tips | `*` |

What each staff role would see (same names and order for everyone):

| Staff role | Sidebar |
|---|---|
| SUPERADMIN | all 8 |
| SUPPORT | Overview, Review (Message + Sender reports) |
| ANALYST | Overview, Review (Detections), Campaigns, Model |
| OPERATIONS | Overview, System (Health, API logs, Storage) |
| PRIVACY | Overview |
| no staff role | Settings only → lands on Settings with a "no workspace access yet" notice (fixes F9) |

### 3.2 Shield client portal — 7 items → 3 + Docs

```
┌──────────────────────────┐
│ ▣ BantAI Shield          │
│                          │
│   Overview               │
│   Campaigns              │
│   API                    │
│                          │
│                          │
│   Documentation    ↗     │  ← pinned to the bottom
└──────────────────────────┘
Top bar:  Campaigns / GCash refund lure        [🔔]  [Avatar ▾]
                                                      ├ Account
                                                      └ Sign out
```

| Today | Becomes |
|---|---|
| Overview, Campaigns, API | Stay as primary items |
| Exports (page) | **"Export" button on campaign detail** and a row action on the campaign list (dialog with format choice). `/shield/exports` redirects to `/shield/campaigns`. |
| Notifications (sidebar) | **Bell in the top bar** (reuse `NotificationBell` with `area="shield"`); inbox stays at `/shield/notifications`. |
| Account (sidebar → leaves shell) | **Avatar menu → `/shield/account`, rendered inside the Shield shell.** `/account` stays as the lifecycle page for people without active Shield access. |
| Documentation | Pinned to the bottom of the sidebar (reference, not daily work). |

### 3.3 Routes and redirects

New canonical paths (sub-screens are real routes, not `?tab=`, so the sidebar
highlight, breadcrumb and deep links all work the same way):

| New path | Redirects from |
|---|---|
| `/admin/review` → `/admin/review/reports` | `/admin/reports` |
| `/admin/review/senders` | `/admin/sender-reports` |
| `/admin/review/detections` | `/admin/model?tab=review` |
| `/admin/messages` | `/admin/mobile-sync`, `/admin/model?tab=classification`, `/admin/classification` |
| `/admin/model/{overview,drift,dataset,errors}` | `/admin/model?tab=…`, `/admin/concept-drift`, `/admin/dataset`, `/admin/fpfn` |
| `/admin/customers/{requests,accounts,api}` | `/admin/access-requests`, `/admin/users`, `/admin/shield-api` |
| `/admin/system/{health,logs,storage,audit,exports}` | `/admin/system?tab=…`, `/admin/server`, `/admin/api-logs`, `/admin/db-storage`, `/admin/audit`, `/admin/export` |
| `/admin/settings/{profile,notifications}` | `/admin/settings` |
| `/shield/account` | `/account` (only when Shield is active; otherwise `/account` stays) |
| `/shield/campaigns` | `/shield/exports` |

All existing redirects in `AppRoutes.tsx` (e.g. `/client/*`) keep working;
they just point at the new targets.

---

## 4. Premium-but-simple visual spec (inside the current theme)

No new colours, no gradients, glass, glow or pill navigation.

**Sidebar**
- 248px; background one step off the canvas (porcelain on fog) with a 1px `--border-default` right edge, so it reads as its own plane (NN/g: distinct background).
- Group label only where it adds meaning (just "MANAGE"); the first group has no label (drop the redundant "Overview" heading).
- Items: 36px tall, 8px radius, 14px/500 Geist, 18px icons in `--text-secondary`.
- Active item, two indicators: `--brand-soft` background + `--brand-primary` text at 600 weight (plus the icon in brand colour).
- Count badges: right-aligned, neutral (ink on `--surface-selected`), hidden at 0, capped "99+". Never threat colours.
- Bottom zone (Shield: Documentation) separated by space, not a divider stack.
- Collapse toggle (keeps the existing 72px rail), remembered per browser.

**Top bar**
- Left: breadcrumb generated from the route registry: `Section / Tab` (or `Campaigns / <name>` on detail). Plain text, last part in `--text-primary`.
- Right, in this order: search (`⌘K`, phase 3), bell, avatar menu.

**Page header + tabs**
- Title 24px/600; at most one sentence of description (≤ 90 characters), or none.
- Primary action top-right of the header (one primary button max).
- Tabs sit directly under the header, underline style: selected = brand underline + 600 weight; one row, never wrapping; tab click changes only the content below.

**Content**
- Max width 1280px, 32px gutters (current contract).
- Metric rows as one bordered strip, not cards inside cards.
- Empty / loading / error states keep the existing primitives (`EmptyState`, `LoadingState`, `ErrorState`).

---

## 5. Implementation plan (each step = one PR into `develop`)

### Phase 0 — Foundations (no visible change)

1. **Route registry** `web/src/navigation/portalRoutes.ts`: one list of `{ path, label, icon, permission, parent, tabs[] }` for admin and Shield. Sidebar groups, tab lists, breadcrumbs and `ROUTE_PERMISSIONS` all read from it. Replaces the hand-kept `ROUTE_PERMISSIONS` map in `adminNav.tsx`.
2. **Layout routes**: `AdminLayout` and `ShieldLayout` mount `AppShell` once and render `<Outlet />`. Pages drop their own `<AppShell …>` wrapper and `topbarContext`. Removes the `lastKnownUser` workaround's reason to exist.
3. **Shared `HubPage` component**: page header + permission-filtered route tabs + `<Outlet />`. Used by Review, Model, Customers, System, Settings.
4. **Permission-first landing**: after sign-in, go to the first route the person can use (fixes F9). Unit-tested per staff role.

### Phase 1 — Admin restructure

5. **Review hub** — move Reports, Sender reports and Detections (`ReviewQueueTab`) under `/admin/review/*`; pending-count badge from existing endpoints. (FP/FN stays with the model as Model → Errors.)
6. **Messages** — merge Mobile sync and the Classification log into one page (stats strip + filtered table); remove the Model tab.
7. **Model** — trim to Overview · Drift · Dataset · Errors.
8. **Customers hub** — Requests · Accounts · API usage under `/admin/customers/*`.
9. **System** — add Exports as a tab (Export page content moves unchanged), routes to `/admin/system/*`.
10. **Settings** — out of the sidebar; Profile · Notifications tabs; avatar menu links to Settings only (the bell opens the inbox).
11. **Redirects** for every old path (table 3.3), each covered by a route test.

### Phase 2 — Shield restructure

12. Bell + avatar menu for `role="client"` in `AppShell`; `/shield/account` inside the Shield shell.
13. Export dialog on Shield campaign detail and list; `/shield/exports` redirect.
14. Documentation pinned to the sidebar bottom; sidebar becomes Overview · Campaigns · API.

### Phase 3 — Polish

15. Sidebar, top bar, page header and tab styles per section 4 (CSS in `appshell.css` / `primitives.css` only, tokens unchanged).
16. Collapse toggle with remembered state.
17. Optional: `⌘K` command palette over the route registry (pages + recent campaigns).

### Phase 4 — Verification (every PR, and once at the end)

- `npm test`, `npm run lint`, `tsc` in `web/`; route-redirect tests; nav-visibility tests for each staff role.
- Visual QA at 1440 / 1280 / 1024 (rail) / 768 / 375 (drawer) for every hub.
- Accessibility: `aria-current="page"` on the active item, tabs as links in a `nav` (they change the URL), visible focus rings, badge counts announced (`aria-label="Review, 12 pending"`).
- Role QA needs local staff-role fixtures (SUPPORT, ANALYST, OPERATIONS, PRIVACY, SUPERADMIN). The current fixture admin has no staff role, so only "Settings" shows — seeding role fixtures is a prerequisite and needs a team decision.

---

## 6. Files this touches

| Area | Files |
|---|---|
| Shell | `components/appshell/AppShell.tsx`, `appshell.css`, `AccountMenu.tsx`, `NotificationBell.tsx` |
| Navigation | `pages/admin/adminNav.tsx`, `pages/client/clientNav.tsx`, new `navigation/portalRoutes.ts`, `constants/routes.ts` |
| Routing | `routes/AppRoutes.tsx`, new `routes/AdminLayout.tsx`, `routes/ShieldLayout.tsx` |
| Admin pages | `ReportsPage`, `SenderReportsPage`, `model/ReviewQueueTab`, `MobileSyncPage`, `ModelPage`, `AccessRequestsPage`, `UsersPage`, `ApiKeysPage`, `SystemPage`, `ExportPage`, `AuditPage`, `SettingsPage`, `OverviewPage` (links) |
| Shield pages | `client/CampaignDetailPage`, `client/CampaignsPage`, `client/ExportPage`, `account/AccountPage` |
| Backend | none — no endpoint or permission changes |

---

## 7. Risks

- **Permission drift**: moving pages under hubs must not widen access. Mitigation: the registry is the only permission source for nav, and per-role tests assert the exact sidebar for each staff role. The backend still authorizes every request.
- **Broken bookmarks / thesis screenshots**: every old URL redirects (section 3.3).
- **Test churn**: the current 101 web tests reference page components directly; most keep working because page components don't change, only their wrappers.
- **Ownership**: `web/` is Daryl's track. WBS/DEV_LOG updates go through Gio.

---

## Sources

- NN/g — Left-Side Vertical Navigation on Desktop: https://www.nngroup.com/articles/vertical-nav/
- NN/g — Tabs, Used Right: https://www.nngroup.com/articles/tabs-used-right/
- IBM Carbon — UI shell left panel: https://carbondesignsystem.com/components/UI-shell-left-panel/usage/
- IBM Carbon — UI shell header: https://carbondesignsystem.com/components/UI-shell-header/usage/
- GitLab Pajamas — Navigation sidebar: https://design.gitlab.com/usability/navigation-sidebar
- Atlassian — Designing Atlassian's new navigation: https://www.atlassian.com/blog/design/designing-atlassians-new-navigation
- Shopify — App design: navigation: https://shopify.dev/docs/apps/design/navigation
- Stripe — Dashboard basics: https://docs.stripe.com/dashboard/basics
- Stripe — Dashboard update May 2024: https://support.stripe.com/questions/dashboard-update-may-2024
- Linear — Personalized sidebar & new settings: https://linear.app/changelog/2024-12-18-personalized-sidebar
- Vercel — Dashboard navigation redesign rollout: https://vercel.com/changelog/dashboard-navigation-redesign-rollout
- Vercel — Universal search: https://vercel.com/changelog/dashboard-universal-search
- GitHub — Redesign of settings pages (NavList): https://github.blog/changelog/2022-02-02-redesign-of-githubs-settings-pages
- Primer — Navigation patterns: https://primer.style/product/ui-patterns/navigation
