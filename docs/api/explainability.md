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
- `weight` — `0.0–1.0`, **relative within this message only** — not
  comparable across messages, and the exact ceiling depends on which of two
  paths computed it (the response never says which; see below):
  - **Real SHAP ran**: normalized so the strongest indicator is exactly `1.0`.
    ⚠️ **As of 2026-09-21 this path never runs in production** — nothing
    computes SHAP for a live message (see "Delivery" below).
  - **Keyword fallback ran** (the only path today; also used when `shap` is
    unavailable or attribution fails): weights are capped at **`0.9`** by design
    (`ai/service/indicator_tags.py`) — the strongest indicator on a
    fallback-explained message will never show `1.0`. This is deliberate
    (so a fallback weight can never be mistaken for a genuine Shapley score
    if the two were ever compared side by side), but it means a client
    should not assume "the top indicator renders as a full bar" — treat the
    ordering as authoritative, not the absolute number.

  The service internally tracks which path ran (`method: "shap" |
  "keyword-fallback"` on `Explanation`, `ai/service/explainer.py`), but that
  field is **not** included in what reaches this endpoint —
  `to_indicator_dicts()` strips it down to `{tag, weight}` only. A client
  cannot distinguish the two paths from the response alone.

**Sorted most-influential-first.** Clients should render in array order and may
truncate to the top 2–3 without losing the important ones.

**An empty array is valid** — a message can be flagged without matching a known
indicator pattern. Render the scam awareness card alone; do not show an empty
"why" section.

---

## Delivery: why explanation arrives separately

**Updated 2026-09-23.** Two things changed since this section was written.
`/classify` *does* now return `indicators` and `explanation_method`
(`docs/api/classify.md`), but they are **keyword-derived**, computed in the
request because that costs ~0.06 s. The slow part — real SHAP — is what still
arrives separately, and **that half is not built yet**.

True SHAP on a transformer needs hundreds of masked forward passes per message.
**Re-measured on the deployed checkpoint (CPU, 2026-09-21/23): classification
~0.06 s; SHAP ~27 s median and up to ~90 s** on a long message at the library's
default sampling budget. (An earlier 2026-07-30 measurement of 13–26 s was taken
on shorter messages and a less loaded machine.) The backend abandons `/classify`
after 3.5 s, so inline SHAP means every message times out — which is exactly
what happened on 2026-09-20 and was fixed the next day. A **100-sample budget
measures ~5 s and produced identical indicator tags** on six real holdout scams
(`ai/datasets/audit/explanation_methods_2026-09-23.json`, kept out of git
because it quotes message fragments), so that is the intended setting for the
background path:

```
SMS arrives ─▶ POST /api/sms/ingest ─▶ label + bucket + keyword indicators
                                             │                  (~0.06 s, live today)
                                    (background, ~5 s — NOT BUILT)
                                             │
                       POST /api/sms/:messageId/indicators ─▶ stored, replacing
                                                              the keyword tags
```

The backend's `POST /sms/:messageId/indicators` endpoint already exists for
exactly this (`StoreIndicatorsDto`, `ExplainableIndicator` in Prisma) and is
guarded by `AI_INDICATORS_API_KEY`. **What is missing** is the AI-side job that
calls it, plus a way for the AI service to learn the `messageId` — `/classify`
receives only the text today.

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
