# Retraining Workflow — Design

**Sprint 4 · Track B (AI/ML) · WBS 4.1.2, 4.2.2, 4.2.3**

How the model gets better after deployment: when retraining fires, what data
it trains on, and what has to be true before a new checkpoint replaces the
running one.

---

## Why this exists

The deployed model is a fixed snapshot — 95.44% accuracy / 94.38% macro-F1,
trained 2026-07-29 on 15,728 rows. Scam campaigns change. A model frozen at
deployment slowly stops matching the traffic it sees, and nothing about the
classification path notices on its own.

The counter-pressure matters as much: retraining on every correction is how
you get a model that chases noise and cannot be reasoned about. Every
mechanism here exists to retrain **when there is real evidence**, and not
otherwise.

---

## Stage 1 — Triggers (WBS 4.1.2)

**Code:** `retraining/triggers.py` · **Tests:** `tests/test_triggers.py` (16)

Three conditions, evaluated on **OR**. They watch different failure modes and
each catches what the others miss.

| Trigger | Default | Catches |
|---|---|---|
| Validated samples | **50** | Steady accumulation of confirmed mistakes |
| Macro-F1 floor | **5pp** below baseline | Sudden breakage — bad deploy, corrupt checkpoint |
| Page-Hinkley | δ=0.005, λ=0.05 | Slow drift no single measurement flags |

### Threshold decisions

WBS 4.1.2 asks these be *confirmed*, because the manuscript states them
loosely. Resolved as:

**"50 samples" = 50 validated reports, not raw submissions.** A report counts
only once an admin marks it Validated (WBS 4.3.2). Counting raw submissions
would let one confused or malicious user force retraining at will.

**"F1 drop 5%" = 5 percentage points absolute**, not 5% relative. At the
94.38% baseline the readings differ materially — 89.38 vs 89.66 — and
absolute is both stricter and the more common convention.

**Macro-F1, not accuracy.** The dataset is ~62/21/17 Ham/Spam/Scam. Accuracy
can hold steady while Scam recall collapses, which is precisely the failure
that matters: a missed scam defrauds someone, a misfiled promo annoys them.

**Page-Hinkley over a fixed floor** because a gradual slide never trips a
floor until it is already severe. Each batch looks like noise; only the
accumulated one-directional drift is visible.

> **Implementation note.** The decrease-detecting form *adds* the slack term
> where the textbook increase-detecting form subtracts it. Getting this
> backwards makes a perfectly stable metric accumulate `-δ` per step and
> false-alarm on constant input. Locked in by
> `test_stable_metric_does_not_signal_drift`.

The detector does **not** self-reset on detection — the caller decides what a
detection means and calls `reset()` when a new baseline is established.
Silent self-reset would make a polling caller see `False` while drift is
still ongoing.

---

## Stage 2 — Snapshot (WBS 4.3.6)

**Code:** `retraining/sampling.py` · **Tests:** `tests/test_sampling.py` (16)

Retraining cannot just take "the newest N rows" — that over-represents
whatever campaign was active that week, and the model drifts toward the
recent past while forgetting older patterns that still circulate.

Vitter's Algorithm R gives a uniform sample over the whole population in one
pass with fixed memory, without knowing the population size up front. That
last property is what lets the caller stream rows out of the database instead
of materialising 16,772+ rows just to shuffle them.

**Guarantee:** after consuming `n` items, every item is in the reservoir with
probability exactly `k/n`, regardless of arrival order. This is the whole
point of the module, so it is tested directly
(`test_sampling_is_approximately_uniform`, `test_late_arrivals_are_not_starved`)
rather than only through its surface API — a plausible implementation that
quietly favours early items would pass everything else.

**Seeds are mandatory in practice.** Training runs get compared against each
other; a snapshot that cannot be regenerated makes a regression impossible to
investigate. Pass `TrainingConfig.seed`.

**Uniform, not balanced.** The sample preserves the population's class
balance (~62/21/17) rather than giving each label a floor, because
`class_weighted_loss` in `training/config.py` already carries the imbalance —
weighting the loss *and* rebalancing the sample would double-correct. If a
future retrain wants per-class quotas instead, that is a stratified variant
to add then, against a real requirement.

---

## Stage 3 — Fine-tune (WBS 4.3.5 — not yet built)

Reuses `training/train.py` unchanged: XLM-RoBERTa-base, AdamW, class-weighted
loss, 80/20 stratified split, seed 42.

The new part is assembling the snapshot: existing labeled dataset **+**
validated reports since the last retrain, sampled per Stage 2, written to a
timestamped directory so every run's exact training input is recoverable.

Blocked on `UserReports` (WBS 4.3.1, Track A) — there is no source of
validated reports until that table and its intake endpoint exist.

---

## Stage 4 — Promotion gate (WBS 4.2.3 / 4.3.7)

**Code:** `retraining/promotion.py` · **Tests:** `tests/test_promotion.py` (11)

A candidate is **never** promoted on a headline metric alone. Two independent
checks, in this order:

### 1. F1 floor — absolute safety

Candidate macro-F1 must not fall more than `F1_FLOOR_TOLERANCE` (1pp) below
the incumbent. Checked *first*, because a catastrophically worse candidate
must be rejected regardless of what any significance test says.

### 2. McNemar's test — is the difference real?

On a ~3,350-row validation split, a 0.4pp macro-F1 gain is easily sampling
luck. Promoting on noise makes the model random-walk between checkpoints
while appearing to improve.

Both models are scored on **the same rows**, so the comparison must only
consider rows where they *disagree* — rows both get right or both get wrong
carry no information about which is better.

|  | candidate correct | candidate wrong |
|---|---|---|
| **baseline correct** | ignored | `b` — regressions |
| **baseline wrong** | `c` — fixes | ignored |

Under the null hypothesis each disagreement is a coin flip, so
`c ~ Binomial(b+c, 0.5)`. Uses the **exact** binomial test rather than the
chi-square approximation, because `b+c` here is often only tens of rows,
where the approximation is unreliable.

### Rejection cases

- **Identical predictions** → no evidence to promote. Swapping checkpoints
  for no measured benefit only adds deployment risk.
- **Not significant** (p ≥ 0.05) → could be noise.
- **Significant but worse** (regressions > fixes) → catches a candidate that
  regresses more than it fixes while staying inside the F1 floor.
  Significance alone must never imply promotion.

Every decision carries its full numbers — both F1s, fix/regression counts,
p-value — because this is what gets written to `ModelVersions` (WBS 4.3.4)
and read back months later when someone asks why a checkpoint was or was not
promoted.

---

## Rollback (WBS 4.2.3)

Promotion is a pointer swap, not an overwrite. Checkpoints are written to
their own timestamped directories and `ModelVersions` records which one is
live, so rollback is repointing to the previous row — no retraining, no
restore from backup.

Two properties this depends on:

1. **Old checkpoints are never deleted by the pipeline.** Disk is cheaper
   than an unrecoverable regression. Pruning is a separate, manual decision.
2. **⚠️ Campaign centroids are tied to the checkpoint that produced them.**
   Retraining changes how embeddings are computed, so centroids from the old
   model are not comparable to embeddings from the new one — similarity
   scores become meaningless, not merely shifted. **Any promotion or
   rollback must be followed by re-embedding and re-clustering**
   (`scripts/embed_dataset.py`, then `scripts/cluster_campaigns.py`). See
   `docs/api/campaigns.md` § Retraining invalidates clusters.

---

## Ownership boundary

Everything in `retraining/` is **pure** — no database, no model loading, no
HTTP. Callers supply numbers; these modules only decide.

That keeps the policy unit-testable and lets the NestJS hourly cron
(WBS 4.3.3) own *scheduling* without duplicating the *policy*. The split
matters because the trigger thresholds are an ML judgement that belongs with
the ML code, while "run this every hour" is infrastructure.

---

## Status

| WBS | Item | Status |
|---|---|---|
| 4.1.2 | Confirm retraining trigger thresholds | ✅ Done |
| 4.2.2 | Retraining workflow architecture | ✅ This document |
| 4.2.3 | Model promotion + rollback design | ✅ This document |
| 4.3.6 | Reservoir sampling (Vitter's Algorithm R) | ✅ Done |
| 4.3.7 | McNemar test + F1 floor promotion gate | ✅ Done |
| 4.3.9 | TF-IDF summarization pipeline | ✅ Done (`service/summarize.py` + `POST /summarize`) |
| 4.4.2 | Unit test: trigger evaluation logic | ✅ Done |
| 4.3.5 | Automated retraining pipeline | ⛔ Blocked on WBS 4.3.1 (Track A) |
| 4.3.8 | Campaign evolution tracking | ⬜ Not started |
