# Explainability Output Format — Mobile & Dashboard

**Sprint 3 · WBS 3.2.2 · Track B (AI/ML)**

The contract Tracks C (mobile) and D (dashboard) render against. Implements the
manuscript's Stage 6 (Explainability and Tip Retrieval) and Stage 8 (User
Facing Output).

---

## What the user sees

Per the manuscript, an alert screen shows four things:

1. the classification label + confidence bar,
2. **SHAP-derived indicator tags** ("why was this flagged?"),
3. a **scam awareness card** (what this scam is, what to do),
4. action buttons (Block / Report / Ignore).

Items 2 and 3 are what this spec defines.

---

## Indicator tags

### The vocabulary

Nine tags. Four are named in the manuscript; five more are grounded in the
dataset's own validated rule vocabulary. Full definitions in
`ai/service/indicator_tags.py` (WBS 3.1.2).

| Tag | Meaning to the user |
|---|---|
| `Prize Lure` | Claims you won something you never entered |
| `Suspicious URL` | Link is shortened or on an unrecognized domain |
| `Brand Impersonation` | Uses a real brand's name with an off-brand link |
| `Urgency Cue` | Artificial time pressure |
| `Gambling Bait` | Fake betting credit / "play or cash out" |
| `Fake Job Offer` | Unsolicited work-from-home income offer |
| `Unsolicited Credit Offer` | Loan you never applied for |
| `Personal Info Request` | Asks for IDs, card photos, personal details |
| `OTP / Account Phishing` | Account-suspension pretext, after your OTP |

Clients should treat this list as **open** — render whatever tag string
arrives rather than switch-casing on a fixed set, so adding a tag later does
not require a mobile release.

### The shape

```json
{
  "indicators": [
    { "tag": "Prize Lure",     "weight": 1.0 },
    { "tag": "Suspicious URL", "weight": 0.62 }
  ]
}
```

- `tag` — display string, human-readable as-is.
- `weight` — `0.0–1.0`, **relative within this message only.** Normalized so
  the strongest indicator is `1.0`. Absolute Shapley magnitudes vary with
  message length and are not comparable across messages; the ordering is the
  meaningful part.

**Sorted most-influential-first.** Clients should render in array order and may
truncate to the top 2–3 without losing the important ones.

**An empty array is valid** — a message can be flagged without matching a known
indicator pattern. Render the scam awareness card alone; do not show an empty
"why" section.

---

## Delivery: why explanation arrives separately

Explanation is **not** part of the `/classify` response. It arrives via a
second call, and this is a deliberate performance decision.

True SHAP on a transformer needs hundreds of masked forward passes per message.
**Measured on the real model (CPU, 2026-07-30): classification takes ~50 ms,
SHAP takes 13–26 s** — roughly 300–500× slower. Running it inline would make
classification unusable for real-time interception. So:

```
SMS arrives ─▶ POST /api/sms/ingest ─▶ label + bucket returned immediately
                                             │
                                    (async, moments later)
                                             │
                       POST /api/sms/:messageId/indicators ─▶ stored
```

The backend's `POST /sms/:messageId/indicators` endpoint already exists for
exactly this (`StoreIndicatorsDto`, `ExplainableIndicator` in Prisma).

### Client implication

The alert screen must render **before** indicators exist, then update. Treat
indicators as eventually-consistent:

- show the label, confidence, and action buttons immediately;
- show a subtle placeholder in the "why" section (not a blocking spinner);
- fill it in when indicators arrive.

A message may legitimately have no indicators yet, or never get them if
explanation failed. Neither is an error state worth surfacing to the user.

---

## Scam awareness card

Looked up per the manuscript's Stage 6 ("the cluster ID from Stage 5b is used
to look up a matching scam awareness card"). Resolution order:

1. admin-authored override for that campaign cluster, else
2. the card for the message's **dominant indicator tag**, else
3. a generic fallback card.

Taking the manuscript literally — one hand-written card per cluster ID — would
leave newly discovered campaigns with no card at all. Falling through to the
dominant tag means every cluster always resolves to something sensible, while
notable campaigns can still get bespoke copy.

### The shape

```json
{
  "tip": {
    "tag": "Prize Lure",
    "title": "You 'won' something you never joined",
    "description": "Scammers open with congratulations and a prize to get you excited enough to click before you think…",
    "actions": [
      "Wag i-click ang link, kahit mukhang legit ang brand.",
      "Real promos never ask you to pay a fee to claim a prize.",
      "Verify in the official app instead — open GCash or GlobeOne yourself.",
      "Block and report the sender, then delete the message."
    ]
  }
}
```

| Field | Rendering |
|---|---|
| `title` | Card heading — short, plain language |
| `description` | 1–2 sentences explaining the scam type |
| `actions` | Bulleted list, 3–4 items, imperative |

Copy is English with the Taglish phrasing Filipino users actually read in real
telco and bank advisories. It lives in `ai/service/tips.py` as data, not code,
and is expected to be revised by the team without touching logic.

The full card catalogue also backs the **Settings → Scam Awareness Tips**
screen (`all_tips()`), which lists every card independent of any message.

---

## Dashboard use

The dashboard consumes the same data aggregated rather than per-message:

- **indicator frequency** — which tags dominate current traffic;
- **per-campaign tag mix** — what characterizes each cluster;
- **tag trend over time** — feeds the concept-drift view.

No separate endpoint: `ExplainableIndicator` rows are already joined to
`Classification`, which is joined to `SmsMessage` and its `clusterId`.
