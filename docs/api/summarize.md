# Thread Summarization — `POST /summarize`

**Sprint 4 · WBS 4.3.9 · AI service (port 8001)**

Condenses an SMS thread into its most informative sentences. Backs the
mobile "AI Message Summary" display (WBS 4.3.11).

---

## Request

```json
{
  "messages": [
    "Hello po good morning.",
    "Your order 12345 has been confirmed and will ship today.",
    "The rider will contact you at around 3pm this afternoon.",
    "Have a nice day po."
  ],
  "max_sentences": 3
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `messages` | `string[]` | yes | Thread bodies, **oldest first**. Must be non-empty. |
| `max_sentences` | `int` | no | Default `3`, range 1–10. |

## Response

```json
{
  "summary": "Your order 12345 has been confirmed and will ship today. The rider will contact you at around 3pm this afternoon.",
  "sentence_count": 2,
  "source_message_count": 4,
  "truncated": true
}
```

| Field | Meaning |
|---|---|
| `summary` | Extracted sentences, joined, in chronological order |
| `sentence_count` | Sentences in the summary |
| `source_message_count` | Messages that went in |
| `truncated` | `true` when content was left out |

**Display `source_message_count`.** `truncated: true` means the user has
*not* seen everything — the UI should say "summary of 4 messages" rather
than presenting the summary as the whole thread.

---

## Behaviour worth knowing

**Extractive, never generative.** Every sentence in `summary` was actually
sent. Nothing is paraphrased or invented. This is a deliberate constraint:
an abstractive summariser can hallucinate an amount or a deadline into a
message the sender never wrote, and in a product where the user is deciding
whether to trust a message, invented content is worse than no summary.

**Chronological order, not relevance order.** Sentences are ranked to
decide *which* to keep, then restored to original order. A summary sorted
by score reads as non-sequitur when the thread describes a sequence.

**No model required.** TF-IDF runs over the thread's own sentences, so
unlike `POST /classify` this endpoint never returns `503` — summaries stay
available when the fine-tuned checkpoint is missing.

**Empty summary is a success, not an error.** A thread of short fragments
("ok", "salamat po") yields `summary: ""` with HTTP 200. Render nothing.

**Fragments under 3 words are dropped** before ranking — they crowd out
real content without adding meaning.

---

## Errors

| Status | Cause |
|---|---|
| `422` | `messages` empty, or `max_sentences` outside 1–10 |

---

## Privacy note

Message bodies are sent **unmasked** — the summary is shown to the owner of
those messages, and masking would render it useless (`<AMOUNT>` instead of
the amount they want to see). Nothing is persisted by the AI service; the
request is processed and discarded.
