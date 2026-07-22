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
| `sender` | string | yes | Phone number or alphanumeric sender ID (e.g. `GLOBE`, `+63912...`) |
| `body` | string | yes | Raw SMS body text, unmodified |
| `receivedAt` | ISO 8601 string | yes | Timestamp when the device received the SMS |

### Response `201 Created`

```json
{
  "messageId": "3f7a1c2d-...",
  "classification": {
    "label": "Likely Smishing",
    "score": 0.94
  },
  "action": "blocked"
}
```

| Field | Type | Description |
|---|---|---|
| `messageId` | uuid | ID of the stored `SmsMessage` row |
| `classification.label` | string | `Likely Smishing` · `Suspicious` · `Unknown` |
| `classification.score` | float 0–1 | Model confidence score |
| `action` | string | Routing decision (see table below) |

### Routing rules

| Score range | Action | What the app should do |
|---|---|---|
| `>= 0.90` | `blocked` | Suppress the message, show threat alert |
| `0.50 – 0.89` | `alert` | Show message but trigger alert screen |
| `< 0.50` | `inbox` | Deliver to regular inbox |

### Error responses

| Status | When |
|---|---|
| `401 Unauthorized` | Missing or expired JWT |
| `400 Bad Request` | Missing required fields or invalid date format |
