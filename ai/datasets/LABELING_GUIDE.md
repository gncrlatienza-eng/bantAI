# Dataset Labeling Guide — Ham / Spam / Scam

The model is trained on **three** mutually-exclusive labels. Every SMS gets
exactly one. Consistent labels are the single biggest lever on model accuracy —
when in doubt, apply the deciding questions below.

> These three **dataset** labels are not what the user sees. The app shows four
> **buckets** (Inbox / Review / Promotions / Danger) derived at runtime — see the
> mapping section below and `ai/service/classifier.py:route`.

## The three labels

### `Ham` (Legitimate)
Messages that are straightforward and honest — either wanted/expected or harmless
even if unsolicited. **No deception, no fraudulent intent.** Sender is honest
about who they are and what the message is.

Examples:
- Personal chat with friends or family
- Delivery updates (from known or unknown couriers)
- Ride/service notifications (Grab, GCash, etc.)
- Appointment reminders
- OTPs and verification codes
- Bank/account alerts (informational, no urgency to act)
- Wrong numbers or accidental texts

### `Spam` (Unsolicited Promotion)
Messages explicitly trying to sell you something or promote a product/service.
**Straightforward about intent — no deception.** May come from any sender (known
or unknown), but the purpose is always to advertise or generate sales.

Examples:
- Product ads and promo campaigns
- Sale announcements and discount offers
- Subscription or service promotions
- New arrival notifications
- Loyalty/rewards program marketing

### `Scam` (Deceptive / Fraudulent)
Messages designed to deceive, manipulate, or defraud. Uses **deception,
impersonation, urgency, or artificial rewards** to push you into surrendering
information, transferring funds, or clicking malicious links.

Examples:
- Fake bank/e-wallet alerts ("Your account will be blocked — verify now")
- Spoofed courier notices ("Pay delivery fee" with malicious link)
- Prize/reward baits ("You won P50,000 — claim now")
- Phishing links ("Verify your BPI account at [spoofed-url]")
- "Pa-load" or money transfer fraud

## The deciding questions

Judge every message by **intent**, not sender or topic:

1. **Is there deception, impersonation, or fraudulent intent?** → **Scam**
   - Fake sender identity
   - Malicious or spoofed link
   - Artificial urgency ("act now or lose access")
   - Reward bait or fake prize
   
2. **Is it trying to sell you something?** → **Spam**
   - Promotional or marketing intent
   - Straightforward about what it is
   - No deceptive hooks

3. **Otherwise** (personal, transactional, service alert, harmless mistake) → **Ham**
   - Honest about what it is
   - No fraudulent intent

## Edge-case tie-breakers

- **Unknown sender promotional text** → `Spam`. Sender identity doesn't matter; if
  the intent is promotional and there's no deception, it's Spam.
  
- **Legit-looking message with a suspicious link** → `Scam`. The link is the
  deceptive hook, even if the message text seems normal.
  
- **Bank/account alert with urgency to verify or act** → `Scam`. Even if it looks
  real, urgency + request to verify = phishing pattern.
  
- **Bank/account alert that's just informational** → `Ham`. No call to action,
  straightforward notification.
  
- **Mixed language (Taglish)** has no bearing on the label — judge by intent
  alone.

## How labels map to what the user sees (runtime, not labeling)

| Model predicts | If confident enough | User bucket | Where |
|---|---|---|---|
| Ham  | ≥ 0.50 | **Inbox**      | Inbox |
| Spam | ≥ 0.60 | **Promotions** | Dropdown (hidden) |
| Scam | ≥ 0.90 | **Danger**     | Dropdown (hidden) |
| any  | below its threshold | **Review** | Inbox |

Thresholds live in `ai/service/config.py` and are tuned once the trained model's
score distribution is known.

## File format

CSV or JSONL under `ai/datasets/labeled/`, with a `text` and a `label` column.
`label` may be the name (`Ham`/`Spam`/`Scam`, any casing) or the id (`0`/`1`/`2`
= Ham/Spam/Scam). See `sample.csv` for the format. Aim for a roughly balanced
count across the three classes.
