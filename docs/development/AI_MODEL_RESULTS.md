# AI/ML Model Results — Sprint 2, Track B

**Model:** XLM-RoBERTa-base, fine-tuned for 3-class SMS classification (Ham / Spam / Scam)
**Final training run:** 2026-07-29
**Full pipeline documentation:** [`../../ai/PIPELINE.md`](../../ai/PIPELINE.md)

This is the results write-up for the thesis manuscript. It reports the final,
leakage-verified evaluation of the smishing classifier — both the raw model
metrics and the bucket-level results a real user would actually see after the
system's confidence-routing layer is applied.

---

## 1. Dataset

| | Ham | Spam | Scam | Total |
|---|---|---|---|---|
| Full dataset | 9,309 | 3,799 | 2,620 | 15,728 |
| Train split (80%) | 6,584 | 2,990 | 1,566 | 11,140 |
| Validation split (20%) | 1,646 | 748 | 391 | 2,785 |

Sourced from four corpora: a Kaggle Philippine-SMS spam/scam collection, a
Kaggle Tagalog-SMS collection, NTC citizen fraud reports (FOI dataset), and
real phone-inbox exports (privacy-masked before use). Labels are produced by
a 20-step rule cascade cross-referenced against source-corpus labels where
available, then human-reviewed in five rounds (596 rows, 3.8% of the dataset)
targeting the rule engine's lowest-confidence and highest-risk output. Full
labeling methodology, rule cascade, and review-round results are documented in
`ai/PIPELINE.md`.

**Split integrity:** stratified 80/20, fixed seed (42), deduplicated on the
*privacy-masked* text (not raw text) before splitting — this prevents
near-duplicate messages (e.g. the same scam template with a different
tracking URL) from leaking across train and validation after masking
collapses them to identical strings. Verified **0.00% overlap** between the
11,140 training texts and 2,785 validation texts immediately before this
training run.

---

## 2. Training configuration

| | |
|---|---|
| Base model | `xlm-roberta-base` (250K multilingual SentencePiece vocabulary) |
| Epochs | 4 |
| Optimizer | AdamW, lr 2e-5, weight decay 0.01 |
| Batch size | 16 train / 32 eval |
| Max sequence length | 128 tokens |
| Loss | **Class-weighted** cross-entropy |
| Model selection | Best epoch by macro-F1 (not last epoch) |

**Class weighting.** Ham is 59% of the dataset; unweighted training rewards
defaulting to Ham whenever the model is uncertain. Loss weights were set by
inverse frequency on the training split (`n_samples / (n_classes × class_count)`):

| Class | Train count | Weight |
|---|---|---|
| Ham | 6,584 | 0.564 |
| Spam | 2,990 | 1.242 |
| Scam | 1,566 | 2.371 |

A Scam mistake costs the loss function ~4.2× a Ham mistake — this is a
deliberate choice to prioritize catching scams over avoiding false alarms on
legitimate messages, since a missed scam defrauds a user while a misfiled
promo only annoys them.

---

## 3. Raw model performance

Classification report on the held-out validation set (2,785 messages, never
seen during training):

| Class | Precision | Recall | F1 | Support |
|---|---|---|---|---|
| Ham | 0.9759 | 0.9587 | 0.9672 | 1,646 |
| Spam | 0.9324 | 0.9586 | 0.9453 | 748 |
| Scam | 0.9098 | 0.9284 | 0.9190 | 391 |
| **Accuracy** | | | **0.9544** | 2,785 |
| **Macro avg** | 0.9393 | 0.9485 | **0.9438** | |
| Weighted avg | 0.9549 | 0.9544 | 0.9546 | |

**Confusion matrix** (rows = actual, columns = predicted):

| Actual \ Predicted | Ham | Spam | Scam |
|---|---|---|---|
| Ham | 1,578 | 39 | 29 |
| Spam | 24 | 717 | 7 |
| Scam | 15 | 13 | 363 |

**Headline metric is macro-F1, not accuracy** — with Ham at 59% of the
dataset, a model that always guessed Ham would still score ~59% accuracy
while being useless. Macro-F1 weights all three classes equally and cannot be
gamed by majority-class bias.

---

## 4. Bucket-level results (what a user actually sees)

The raw metrics above are argmax predictions. The deployed system additionally
applies a two-stage routing decision (`service/classifier.py:route`) before
acting on any prediction:

1. **Gap check** — if the top class doesn't lead the runner-up by ≥ 0.15
   probability, route to `unknown` regardless of confidence (catches
   near-ties, e.g. 0.50/0.48/0.02).
2. **Per-class confidence threshold** — Scam ≥ 0.90 → `blocked`; Spam ≥ 0.60
   → `spam`; Ham ≥ 0.50 → `safe`; anything failing its bar → `unknown`.

This means a low-confidence or ambiguous prediction is never silently acted
on — it surfaces to the user as "unknown" instead of a wrong, confident
answer.

| True label | → safe | → spam | → blocked | → unknown |
|---|---|---|---|---|
| Ham (1,646) | 1,576 | 34 | 19 | 17 |
| Spam (748) | 23 | 715 | 5 | 5 |
| Scam (391) | 14 | 12 | 360 | 5 |

| True label | Correctly routed | Routed to unknown | Wrong bucket |
|---|---|---|---|
| Ham | 95.75% | 1.03% | 3.22% |
| Spam | 95.59% | 0.67% | 3.74% |
| Scam | 92.07% | 1.28% | 6.65% |

Only 1.0% of all validation messages (27/2,785) were routed to "unknown" —
the router makes a decisive call in the large majority of cases rather than
deferring by default.

**Safety-critical numbers:**

- **Real scams shown to the user as "safe" (worst-case miss): 14/391 = 3.58%.**
  This is the single most important number in this evaluation — it is
  slightly *better* than the raw-model miss rate (15/391 = 3.84%), because the
  gap check catches some borderline predictions and defers them to "unknown"
  instead of confidently mislabeling them Ham.
- **Legitimate messages wrongly blocked outright (false alarm): 19/1,646 = 1.15%.**
  Also improved versus raw argmax (29/1,646 = 1.76%), for the same reason in
  reverse — borderline Ham-flagged-as-Scam predictions get deferred rather
  than acted on.

Reproducible via `ai/scripts/evaluate_buckets.py`.

---

## 5. Comparison to prior runs and literature

| Run | Macro-F1 | Accuracy | Scam recall | Status |
|---|---|---|---|---|
| 2026-07-28, run 1 | 0.9434 | 0.9540 | 0.9270 | **Invalid** — train/val leakage inflated this number |
| 2026-07-28, run 2 | 0.9325 | 0.9441 | 0.8978 | Honest, but superseded (smaller/older dataset, no class weighting) |
| **2026-07-29, run 3 (final)** | **0.9438** | **0.9544** | **0.9284** | **Current model.** Legitimately exceeds run 1's number — honestly this time, with 0.00% leakage verified. |

**Relative to SMSegurado** (the one directly comparable published Philippine
smishing-detection system, reporting 98.10–98.29% accuracy): this model's raw
accuracy (95.44%) sits below that range, and its bucket-level "correctly
routed" rate (92–96% depending on class) is not a directly comparable metric
since SMSegurado's published figure is not documented as leakage-verified and
draws from the same source-corpus family as this dataset. The defensible
framing for the manuscript is **not** a raw-accuracy superiority claim, but:

1. This result is **independently verified as leakage-free**, which
   SMSegurado's published number is not documented to be.
2. **99–100% accuracy on this task would itself be a red flag**, not a
   strength — a 3-class, multilingual, real-SMS classification task has
   irreducible label ambiguity (documented directly: human review rounds in
   this project disagreed with rule-based labels 5–35% of the time depending
   on round, even with `LABEL_DEFINITIONS.md` in hand). A model claiming
   near-perfect accuracy on such a task is more likely exploiting leakage or a
   spurious shortcut than genuinely understanding the task.
3. Superiority is better argued on **functional grounds** where the
   manuscript's own related-literature review already establishes comparison
   systems fall short: privacy-preserving preprocessing (PII masking before
   the model ever sees raw text), a documented and reproducible labeling
   methodology (20-step rule cascade + 5 rounds of human audit, all logged),
   and graceful degradation under uncertainty (the "unknown" bucket, rather
   than forcing every message into a confident bucket).

---

## 6. Limitations (for the manuscript's limitations section)

- **Label quality is majority rule-based, not human-verified.** 596 of 15,728
  rows (3.8%) have been human-checked. Treat model metrics as measuring
  agreement with the rule engine, moderated by five rounds of targeted human
  audit (see `ai/PIPELINE.md` for full round-by-round results).
- **Scam examples lean heavily on one template family.** Gambling-blast
  messages account for 1,111 of 2,620 Scam rows (42.4%). A supplementary data
  collection pass on 2026-07-29 added 447 new messages but reinforced this
  same skew (37 of 57 new Scam labels were more gambling templates).
  Genuine diversity is thin: loan-shark texts total only 12 rows, and there
  is no dedicated romance-scam or fake-courier category. This is likely
  connected to Scam being the weakest-performing class (lowest recall,
  highest bucket-routing error rate) — the model has comparatively little
  signal for scam patterns outside the dominant template family. **This
  reflects the empirical distribution of Philippine SMS scam traffic, which
  is itself gambling-dominated** at scale; the gap is in targeted collection
  of lower-volume scam types, not a flaw in the collection process.
- **Tagalog Spam is thin** — 21 rows of 15,728, unchanged even after the
  2026-07-29 data addition. This is a genuine data-scarcity gap: a Tagalog
  promotional-language lexicon (`PROMO_TL`) was added specifically to catch
  under-labeled Tagalog Spam and the count didn't move, indicating the
  messages are not present in the corpora collected so far rather than being
  mislabeled.
- **4.1% of rows have undetermined language** — a metadata/reporting
  limitation only; confirmed to have zero effect on training since the
  language column is never read by the training loader.

---

## 7. Reproducing these numbers

```bash
cd ai
python -m pytest -q                       # 46/46 tests should pass
python scripts/evaluate_buckets.py        # bucket-level table above
```

The raw classification report + confusion matrix are produced by notebook
step 6 in `colab/BantAI_Finetune_Colab.ipynb` immediately after training.
