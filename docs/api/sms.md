# SMS API

## POST /api/sms/ingest

Receives a single SMS message from the Android app, stores it, runs it through the classification pipeline, and returns the result with a routing action.

**Auth:** Bearer JWT (obtained from `POST /api/auth/verify-otp`)

### Request

```http
POST /api/sms/ingest
Authorization: Bearer <token>
Content-Type: application/json
```

```json
{
  "sender": "+639123456789",
  "body": "Your GCash account is locked. Verify now: http://gcash-verify.xyz/unlock",
  "receivedAt": "2026-07-20T10:30:00.000Z"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `sender` | string | yes | Phone number or alphanumeric sender ID (e.g. `GLOBE`, `+63912...`), max 64 chars |
| `body` | string | yes | Raw SMS body text, unmodified |
| `receivedAt` | ISO 8601 string | yes | Timestamp when the device received the SMS |

If the sender is on the caller's `BlockedNumber` list, the message is not
stored or classified — the endpoint returns `{ "suppressed": true, "reason": "blocked_sender" }`
instead of the shape below.

### Response `201 Created`

```json
{
  "messageId": "3f7a1c2d-...",
  "classification": { "label": "Scam", "score": 0.94 },
  "action": "blocked",
  "senderStatus": "unknown",
  "suppressedLinks": ["http://gcash-verify.xyz/unlock"]
}
```

| Field | Type | Description |
|---|---|---|
| `messageId` | uuid | ID of the stored `SmsMessage` row |
| `classification.label` | string | `Ham` · `Spam` · `Scam` — the AI service's raw class name, passed through unmodified |
| `classification.score` | float 0–1 | Confidence of the winning class |
| `action` | string | Routing decision derived from the AI service's `bucket` (see below) |
| `senderStatus` | string | `verified` if the sender is in the user's contacts, else `unknown` |
| `suppressedLinks` | string[] | URLs stripped from display — shortened-URL-service links, or links whose domain matches an active campaign cluster |

**Note (2026-07-30):** earlier drafts of this doc documented `classification.label`
as `Likely Smishing` / `Suspicious` / `Unknown`, matching the manuscript's
original three-class wording. The shipped code (`sms.service.ts`) passes the
AI service's `Ham`/`Spam`/`Scam` straight through with no translation layer —
this doc now reflects what the code actually returns. The manuscript's class
names remain a known wording mismatch to reconcile separately (adviser-facing,
tracked in project memory as `bantai-argmax-vs-manuscript`); this file
documents current backend behavior, not manuscript prose.

### Routing rules

`action` is derived from the AI service's `bucket` field
(`safe`/`unknown`/`spam`/`blocked`) when the AI service responded, or from the
score directly if the AI service was unreachable (`routeFromScore` fallback,
same 0.50/0.90 cutoffs):

| Bucket / score fallback | `action` | What the app should do |
|---|---|---|
| `blocked` (bucket) · score `>= 0.90` (fallback) | `blocked` | Suppress the message, show threat alert. Sender is also auto-added to `BlockedNumber` when `score >= 0.90`, regardless of bucket. |
| `spam` (bucket) · score `0.50–0.89` (fallback) | `alert` | Show message but trigger alert screen |
| `safe` / `unknown` (bucket) · score `< 0.50` (fallback) | `inbox` | Deliver to regular inbox |

### Link suppression

Triggers when `classification.label` is `Spam`/`Scam`, or the sender is not
in the user's contacts. Each URL in the message body is checked against a
fixed shortened-URL-service host list (`bit.ly`, `tinyurl.com`, `t.co`, etc.)
and against domains from active campaign clusters (`CampaignsService.getActiveDomains()`);
matches are stripped from display and reported in `suppressedLinks`. If any
URL's domain matches an active cluster, the message is linked to that
`CampaignCluster` (`clusterId` on `SmsMessage`) and the cluster's message
count is incremented.

---

## POST /api/sms/:messageId/indicators

**Internal endpoint** — called by the AI/ML service after SHAP analysis to
attach explainability data to an already-classified message. No JWT guard
(not a mobile-user-facing route).

### Request

```json
{
  "indicators": [
    { "tag": "suspicious-link", "weight": 0.42 },
    { "tag": "urgency-language", "weight": 0.31 }
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `indicators` | `{ tag: string, weight: number }[]` | SHAP-derived indicator tags for the message, most-influential first by convention (not enforced) |

Upserts an `ExplainableIndicator` row keyed on the message's `Classification`
id — a message must already have a `Classification` (i.e. `POST /sms/ingest`
must have run first) or this returns `404`.

### Response `201 Created`

Returns the stored `ExplainableIndicator` row (`classificationId`, `indicators`).

---

### Error responses

| Status | When |
|---|---|
| `401 Unauthorized` | Missing or expired JWT (`/sms/ingest` only) |
| `400 Bad Request` | Missing required fields or invalid date format |
| `404 Not Found` | `/sms/:messageId/indicators` called for a message with no `Classification` yet |
