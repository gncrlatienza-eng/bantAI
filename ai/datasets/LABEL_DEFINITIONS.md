# Label Definitions — Dataset and App

## Dataset Labels (Internal ML training)

Used to train the classifier. Every labeled SMS gets exactly one.

### `Ham` (Legitimate)
Messages that are straightforward and honest — either wanted/expected or harmless even if unsolicited. No deception, no fraudulent intent. Sender is honest about who they are and what the message is.

**Examples:**
- Personal chat with friends or family
- Delivery updates (from known or unknown couriers)
- Ride/service notifications (Grab, GCash, etc.)
- Appointment reminders
- OTPs and verification codes
- Bank/account alerts (informational, no urgency to act)
- Wrong numbers or accidental texts

### `Spam` (Unsolicited Promotion)
Messages explicitly trying to sell you something or promote a product/service. Straightforward about intent — no deception. May come from any sender (known or unknown), but the purpose is always to advertise or generate sales.

**Examples:**
- Product ads and promo campaigns
- Sale announcements and discount offers
- Subscription or service promotions
- New arrival notifications
- Loyalty/rewards program marketing

### `Scam` (Deceptive / Fraudulent)
Messages designed to deceive, manipulate, or defraud. Uses deception, impersonation, urgency, or artificial rewards to push you into surrendering information, transferring funds, or clicking malicious links.

**Examples:**
- Fake bank/e-wallet alerts ("Your account will be blocked — verify now")
- Spoofed courier notices ("Pay delivery fee" with malicious link)
- Prize/reward baits ("You won P50,000 — claim now")
- Phishing links ("Verify your BPI account at [spoofed-url]")
- "Pa-load" or money transfer fraud

---

## App Labels (What users see)

Derived from model predictions with confidence thresholds. Mapped to dataset labels but presented in user-friendly language.

### `Safe` (from Ham prediction ≥ 0.50)
Message from a trusted source or straightforward service alert. No suspicious activity detected. You should be able to trust this message.

### `Review` (Unknown confidence — below threshold)
We're not sure about this message. It could be safe or potentially suspicious. Check it yourself to be sure before taking any action or sharing information.

### `Blocked` (from Scam prediction ≥ 0.90)
This message has clear signs of a scam or phishing attempt. It's been moved to a hidden folder to protect you. Do not click links or share personal information.

### `Spam` (from Spam prediction ≥ 0.60)
Unsolicited promotional or marketing messages. These are hidden from your main inbox but you can view them anytime if you're interested.

---

## Mapping Reference

| Dataset Label | Confidence | User Label | Folder | Notes |
|---|---|---|---|---|
| Ham | ≥ 0.50 | **Safe** | Inbox | Message stays visible; tagged as Safe |
| Unknown | Below threshold | **Review** | Inbox | Message stays visible; tagged as Review (user should decide) |
| Spam | ≥ 0.60 | **Spam** | Promotions (hidden) | Moved to Promotions folder, not in main inbox |
| Scam | ≥ 0.90 | **Blocked** | Blocked (hidden) | Moved to Blocked folder, highly protected |

---

## Thresholds

Thresholds are configured in `ai/service/config.py` and are tuned once the trained model's score distribution is known. These values represent the minimum confidence required to apply each label with certainty.

- **Safe (Ham):** 0.50 — lower threshold since false negatives (missing legit messages) are costly
- **Spam:** 0.60 — moderate threshold
- **Blocked (Scam):** 0.90 — very high threshold since false positives (blocking legit messages) are worst-case scenario
- **Review:** Anything that fails the gap check *or* falls below its class threshold gets flagged for user review

## Routing pipeline

The model outputs a **softmax distribution** over Ham/Spam/Scam (three probabilities that sum to 1.0). `route()` in `ai/service/classifier.py` turns that into one user label in three steps:

1. **argmax** — pick the winning class (highest probability).
2. **gap check** — if the winner leads the runner-up by less than the **review margin** (`review_margin`, default **0.15**), the model is treated as *torn* and the message routes to **Review**, regardless of thresholds. This catches near-ties like `0.50 / 0.50 / 0.00` where argmax alone would misleadingly pick a "winner".
3. **threshold** — the winning class must also clear its own confidence bar (above). If it doesn't, the message routes to **Review**.

**Why the gap check matters:** a raw argmax will always name a winner, even when two classes are effectively tied. The margin ensures we only act on a *confident* lead. It does most of its work in the fuzzy 0.4–0.6 range where the model is genuinely undecided between Ham and Spam — exactly the messages a user should eyeball themselves.
