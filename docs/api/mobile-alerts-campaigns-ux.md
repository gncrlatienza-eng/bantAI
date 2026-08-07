# Alerts + Campaigns Mobile UX Spec

**Sprint 3 · WBS 3.2.3 · Track C (Mobile)**

Documents the screen flow, data contracts, and state machine for the Alerts and
Campaigns sections of the BantAI Android app. Serves as the design record for
the implementations in `AlertsScreen.kt`, `SmishingAlertScreen.kt`,
`ThreatAnalysisScreen.kt`, `CampaignsScreen.kt`, and `CampaignDetailScreen.kt`.

---

## Alerts

### Screen hierarchy

```
Alerts (tab)
├── AlertsScreen          GET /sms/alerts
│   ├── [Blocked]   →  SmishingAlertScreen   GET /sms/:messageId/indicators
│   └── [Pending]   →  ThreatAnalysisScreen  GET /sms/:messageId/indicators
```

### AlertsScreen

**Route:** Main tab — no parameters.

**Data source:** `GET /api/sms/alerts` (JWT). Returns a list of `Alert` objects
with nested `SmsMessage` and `Classification`, sorted newest-first.

**States:**

| State | UI |
|---|---|
| Loading | `CircularProgressIndicator` centered in list |
| Error | Warning row with error message from server |
| Empty | Hourglass row — "No threats detected yet" |
| Data | List of `AlertCard` items |

**AlertCard layout:**
- Left icon: `Block` (Danger red) for Blocked, `Warning` (Suspicious amber) for Pending
- Sender name + confidence percentage (from `Classification.score`)
- Message body preview (2 lines, ellipsized)
- Relative timestamp (m / h:mm a / Yesterday / MMM d)
- Status pill: "Auto-blocked" (red) or "Suspicious" (amber)
- Classification label chip if present

**Navigation on tap:**
- `status == "Blocked"` → `SmishingAlertScreen` with `messageId`, `sender`, `score`, `status`, `body`
- `status == "Pending"` → `ThreatAnalysisScreen` with `messageId`, `sender`, `score`, `status`, `body`

**Header status line:**
- Green dot + "All threats reviewed" when no Pending alerts
- Amber dot + "N unreviewed" when Pending alerts exist

---

### SmishingAlertScreen (Blocked alerts)

**Route:** `smishing_alert/{messageId}?sender=&scoreStr=&status=&body=`

**Data source:** `GET /api/sms/:messageId/indicators` (JWT). Indicators arrive
asynchronously after classification (SHAP takes 13–26 s per explainability.md).

**Sections:**

1. **Auto-blocked banner** — dark red row with Block icon. Always visible for
   Blocked status.

2. **Sender info card** — shield icon (red), sender name, confidence percentage
   ("XX% smishing").

3. **Message content** — labeled "BLOCKED MESSAGE CONTENT" with a "Read-only"
   badge. Message body in dark red bubble with red border.

4. **Why BantAI flagged this** — `LinearProgressIndicator` bars for each SHAP
   indicator, sorted most-influential-first. Bar color: Danger red. Shows
   loading spinner while indicators are fetching; "No indicators available yet"
   if empty after load.

5. **XLM-RoBERTa summary** — auto-generated text: "XLM-RoBERTa classified this
   message as smishing with XX% confidence. The strongest signals were [top 2
   tags]."

---

### ThreatAnalysisScreen (Pending / Suspicious alerts)

**Route:** `threat_analysis/{messageId}?sender=&scoreStr=&status=&body=`

**Data source:** Same as SmishingAlertScreen — `GET /api/sms/:messageId/indicators`.

**Sections:**

1. **Sender info card** — GppBad icon (amber), sender name, "Suspicious" badge,
   confidence bar ("Confidence XX%"). Bar color: Suspicious amber.

2. **AI Summary** — auto-generated from live indicators (same pattern as
   SmishingAlertScreen but uses "suspicious" language).

3. **Threat Indicators** — `LinearProgressIndicator` bars (amber). Same loading
   and empty states as SmishingAlertScreen.

4. **Actions button** — full-width Indigo button navigating to `TakeActionScreen`.

*Campaign Link section is omitted pending cluster ID surfacing in the alerts
response (tracked in 3.3.9 / Campaign wiring).*

---

## Campaigns

### Screen hierarchy

```
Campaigns (tab)
├── CampaignsScreen
│   ├── ACTIVE section     GET /campaigns         (isActive: true, ordered by messageCount)
│   ├── PAST CAMPAIGNS     GET /campaigns/inactive (isActive: false, ordered by updatedAt)
│   └── [any row]    →  CampaignDetailScreen   GET /campaigns/:id
```

### CampaignsScreen

**Route:** Main tab — no parameters.

**Data sources (parallel fetch):**
- `GET /api/campaigns` (JWT) → active campaigns, `messageCount` DESC
- `GET /api/campaigns/inactive` (JWT) → past campaigns, `updatedAt` DESC

Both fetches start simultaneously in `CampaignsViewModel.loadCampaigns()` via
`coroutineScope { launch { } launch { } }`. Each section has its own loading and
error state so a failure in one does not block the other.

**Section layout (ACTIVE and PAST CAMPAIGNS share the same pattern):**

| State | UI |
|---|---|
| Loading | `CircularProgressIndicator` row |
| Error | Error row with server message |
| Empty | "No active campaigns right now" / "No past campaigns" |
| Data | `GroupedList` — rounded card containing `CampaignRow` items with hairline dividers |

**CampaignRow layout:**
- Hub icon in circle (amber for active, gray for inactive)
- Campaign label (or "Unlabeled campaign")
- Status dot (green = Active, gray = Ended) + "· N messages"
- Creation date (MMM d)
- Chevron right

**Navigation on tap:** `CampaignDetailScreen` with `campaignId`.

---

### CampaignDetailScreen

**Route:** `campaign_detail/{campaignId}`

**Data source:** `GET /api/campaigns/:id` (JWT). Returns full `CampaignCluster`
with up to 50 most recent messages (ordered `receivedAt` DESC).

**Header:**
- Hub icon + campaign label + isActive pill ("Active" in amber / "Ended" in gray)
- Stat row: Messages (messageCount) · Domains (urlDomains.length) · Senders
  (unique sender count from recent messages) · Blocked (count where
  `bucket == "blocked"` in recent messages)
- *(Stat source note: Senders and Blocked are computed from the 50-message
  sample and labeled "(recent)" — not lifetime totals)*

**URL domains section:** Scrollable horizontal row of domain chips.

**Recent messages section:** List of message rows — sender, body preview (2
lines), timestamp, and classification label chip.

---

## Shared patterns

**Authentication:** All endpoints use JWT Bearer token from
`UserPreferences.authToken`. The ViewModels read the token from DataStore via
`userPreferences.userData.first().authToken` before any API call. If the token
is empty, the screen shows a "Sign in to see…" error without making a network
request.

**HTTP client:** Plain `HttpURLConnection` + `org.json` (no Retrofit). All API
calls run on `Dispatchers.IO` via `withContext`. Timeouts: 10 s for screen calls
(`DEFAULT_TIMEOUT_MS`).

**Error recovery:** Errors surface as a text row in place of the list. The
ViewModels expose a `loadX()` function that can be called again (e.g., pull to
refresh if implemented in future sprints).
