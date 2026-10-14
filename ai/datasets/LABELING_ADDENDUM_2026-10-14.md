# Labelling addendum — credential requests and advance fees (2026-10-14)

Extends [LABEL_DEFINITIONS.md](LABEL_DEFINITIONS.md) and [LABELING_GUIDE.md](LABELING_GUIDE.md). Written after the 2026-10-14 classification audit; owner for the data work: AI track (Maxene).

## Why

Model C (`v2026-09-21-colab-C`) reports ~96% Scam recall on the frozen holdout, but that holdout's scams are 40% gambling bait, with only 19 OTP-phishing, 3 fake-job and 2 personal-info rows. On the authored challenge set (`datasets/challenge/credential_advance_fee_v1.csv`, run `python evaluation/evaluate_challenge.py <model_dir>`) it gets every legitimate contrast right but:

| Scam category | Caught |
|---|---|
| Job advance fee | 0/5 (Ham/Spam at ~1.00 confidence) |
| OTP surrender | 1/5 (Ham at ~1.00) |
| Loan upfront fee | 1/3 |
| Prize processing fee | 3/4 |
| MPIN/password surrender | 4/5 |

Only ~4 of the 3,084 labelled scams ask the recipient to send a code, and confidence thresholds can't rescue these: the errors are confident (validation-split calibration, same day). A keyword rule was also measured and rejected: "send/reply … OTP/PIN" matches 77 Spam and 34 Ham rows for every 4 Scams, mostly telco promos ("text GOSURF50 to 8080", "send the promo PIN to 2366"). **The fix is data.**

## Decision rule (apply in this order)

1. **Does it try to get money, credentials or account access from you by deceiving you?** → **Scam**. Deception includes impersonation, a fake problem ("account locked"), a fake reward, or a fee for something that should be free.
2. Otherwise, **is it selling or promoting something, honestly?** → **Spam**.
3. Otherwise → **Ham**.

Who the sender claims to be doesn't decide the label; what the message asks you to do does.

## The two boundaries the model gets wrong

**Issuing a code vs. asking you to surrender one**

| Ham | Scam |
|---|---|
| "Your GCash code is 482913. Never share it." | "Reply with the OTP we just sent you to keep your account active." |
| "BDO will never ask for your OTP." | "Forward the one-time PIN sent to your phone to this number." |
| "Hindi kailanman hihingin ng GCash ang MPIN mo." | "I-text ang iyong MPIN at OTP para ma-unlock ang account mo." |

Asking you to *type* a code into the app or website you started a transaction on is Ham. Asking you to *send, reply, forward or tell* a code, PIN, MPIN or password to a person or number is Scam, however official it looks. A "wrong number, please send back the code" message is Scam.

**Honest offer vs. advance fee**

| Ham / Spam | Scam |
|---|---|
| Interview schedule with company, date, place (Ham) | "You're hired, pay P350 registration fee first" |
| "Buy P1,000, get a raffle entry. DTI permit…" (Spam) | "You won P75,000, pay P1,200 processing fee" |
| "Apply for a loan up to P150,000 in the app" (Spam) | "Loan approved, send P999 before release" |
| "Text GOSURF50 to 8080 for 3GB" (Spam) | — |

Any fee paid *before* you receive a job, prize or loan is the scam marker.

## What to collect

For each scam category below, aim for **150–300 reviewed examples**, about a third in Tagalog/Taglish, and **at least as many near-identical legitimate contrasts** (the left-hand columns above):

- OTP / one-time PIN surrender (bank, e-wallet, "wrong number")
- MPIN / password / card PIN surrender
- Job advance fee (registration, training kit, ID/uniform, "refundable" deposit)
- Prize / raffle processing, delivery or "tax" fee
- Loan upfront fee (insurance, processing, first-month advance)

Sources, in order of preference:

1. In-app user reports that admins reviewed (the Report → review → `DatasetSample` pipeline). Consented and masked.
2. Public advisories and published examples (BSP, GCash, Maya, banks, PNP-ACG, DICT/CICC).
3. Paraphrases from `scripts/augment_scam_dataset.py`, **reviewed by a person**. Keep its holdout de-duplication on.

## Process

- **Two people label every new row independently.** Disagreements are adjudicated with this rule and recorded. Fix label disagreements before training; `training/dataset.py` stops on conflicting labels for the same masked text.
- **Review the 23 Ham rows** the audit's scanner flagged for OTP-request wording. They may be mislabelled scams.
- **Never add challenge-set rows to training, and never tune thresholds on them or on the frozen holdout.** Keep the challenge set as a development check.
- **Before any promotion, freeze a new independent final test set** with at least 30–50 rows per scam category. The current holdout was reused during development.
- **Gate the retrained candidate per category,** not only on overall recall, and include the INT8 phone build and client-masked (`[URL]`, `[OTP]`) inputs in the comparison.
- **Retrain and promote only through the existing approval process.**
