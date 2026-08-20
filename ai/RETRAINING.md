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

## Stage 3 — Fine-tune (WBS 4.3.5)

**Code:** `retraining/snapshot.py`, `retraining/reports.py`,
`retraining/pipeline.py` · **CLI:** `scripts/retrain.py` ·
**Tests:** `tests/test_snapshot.py` (20), `tests/test_reports.py` (19),
`tests/test_retraining_pipeline.py` (18)

Reuses `training/train.py` unchanged: XLM-RoBERTa-base, AdamW, class-weighted
loss, 80/20 stratified split, seed 42. Keeping one training implementation is
what makes a retrained checkpoint comparable to the original.

Every run writes a self-contained directory under `models/retraining_runs/`:

```
2026-08-11T10-57-10Z/
    manifest.json     what went into the snapshot, and why
    snapshot/
        snapshot.csv  the exact training input
    candidate/        the fine-tuned checkpoint
    decision.json     promote-or-not, with the numbers behind it
```

### Snapshot assembly

Existing labeled dataset **+** validated reports since the last retrain.
Three decisions where the obvious implementation is wrong:

**Reports are never sampled away.** The natural reading of "combine, then
reservoir-sample" is to pool everything and draw uniformly — which would let a
cap discard some of the 50 corrections that *triggered* the retrain. Reports
are always included in full; the reservoir samples the **historical** side down
to whatever budget remains. Stage 2's job is keeping the historical draw
uniform, not rationing corrections.

**Report labels win on collision.** A validated report contradicting a dataset
row is a human correction of that row. Keeping both would train on two readings
of the same text and learn nothing from the correction.

**De-duplication compares masked text; the snapshot stores raw text.**
`...libre 1q2w3e7.ca` and `...libre 1q2w3e8.ca` are one model input once
masked — the same leakage `training/dataset.py` guards against on the split.
But what gets *written* is the raw body, so the training path does its own
preprocessing exactly as always. Masked text is a comparison key, never a
stored artifact.

`max_history` defaults to **None** — no cap. At the current pool size (13.5k
rows as of 2026-08-18, after `scripts/create_holdout_set.py` set aside a
permanent 20% test set — see `PIPELINE.md` § "Permanent held-out test set")
there is no reason to sample, and sampling by default would silently discard
training data.

### The report source

The canonical source is the `UserReport` table (WBS 4.3.1, Track A), which
landed in PR #39. The source is an interface with three implementations:

| Implementation | What it reads |
|---|---|
| `NullReportSource` | Nothing. Still the default; manifest records `null (no report store consulted)` |
| `FileReportSource` | CSV/JSONL from a directory — see `datasets/reports/README.md` |
| `DatabaseReportSource` | `GET /reports` on the backend, keeping `status == "Validated"` |

Running without reports is a legitimate operation — it is what you do to
reproduce a checkpoint. What would be wrong is *pretending* reports were
consulted, which `describe()` prevents. That is also why no source is ever
selected implicitly: `scripts/retrain.py` requires `--reports-dir` or
`--reports-url`, and a `BANTAI_AI_BACKEND_URL` sitting in the environment is
not on its own enough to turn the database on.

**The `Validated` filter runs client-side.** `ReportsService` exposes only
`findAll()` and `findPending()` — there is no `findValidated()` — so the AI
side fetches everything and filters. Fine at thesis scale; if the table ever
outgrows one unpaginated response, the fix is a server-side filter on Track A's
side, not paging from here against an API with no cursor.

**`validated_at` is really `updatedAt`.** Prisma's `@updatedAt` moves on any
write to the row, including a later `adminNote` edit, so it is a proxy for the
validation time rather than the thing itself. A dedicated `validatedAt` column
would be exact. The only cost meanwhile is that a re-touched report can look
newer than it is and be re-consumed by a later run — harmless, since the
snapshot de-duplicates.

**Failures raise; they do not degrade.** This is the deliberate opposite of
`service/centroid_source.py`, which swallows every error. An empty centroid
list costs one enhancement and the service still classifies. An empty *report*
list is indistinguishable from "no corrections were filed" — so a 401, or a
typo in the URL, would otherwise produce a clean-looking retrain that learned
from none of the mistakes that triggered it, and a manifest no reader would
question. `ReportSourceError` stops the run instead.

#### Getting reports onto a GPU box

Colab has no route to a laptop's `localhost:3000`, so the database source
cannot be used from the notebook. Export first, then carry the file:

```bash
cd ai
python scripts/retrain.py --export-reports datasets/reports/validated.csv \
    --reports-url http://localhost:3000/api
python colab/build_retrain_package.py     # picks up datasets/reports/
```

The export writes exactly the columns `FileReportSource` reads, so the two
sources round-trip.

### The `since` watermark

A run consumes only reports validated after the previous run's timestamp,
read from that run's manifest. **Dry runs are skipped** when computing it: a
dry run trains nothing, so letting it advance the watermark would make the next
real run silently skip every report the dry run merely looked at. `--since all`
overrides the watermark entirely.

### What the gate records, and what it does not

Every run writes `decision.json` — the verdict plus every number behind it,
**including for a rejection.** A rejected candidate is the case most worth
explaining later, so it is recorded in exactly as much detail as a promotion.

Since WBS 4.3.5 that also includes the class-level breakdown of the
disagreements:

```json
"regression_transitions": { "Scam->Spam": 20, "Ham->Spam": 12 },
"fix_transitions":        { "Spam->Scam": 41, "Ham->Ham": 9 }
```

`97 fixes vs 44 regressions` invites exactly one follow-up — *what got worse?* —
and the counts alone cannot answer it. `Scam->Spam: 20` says the candidate
started under-calling scams, which is a different and more serious failure than
the same number of Ham/Spam mix-ups. These are text-free by design, so they are
safe to commit and to quote in the manuscript.

The row-level detail lands beside it in **`disagreements.json`**: index, true
label, both predictions, and the message text for every row the two models
disagreed on.

> ⚠️ **`disagreements.json` must never be committed.** It reproduces real SMS
> bodies from the validation split — masked (`<URL>`, `<OTP>`), because that is
> the form the models were scored on, but still real user messages. It stays in
> the run directory, which `ai/models/*/` already git-ignores. Quote the
> transition counts instead.

### Validation caveat

The candidate is scored on the held-out 20% of its own snapshot, which it has
genuinely not trained on. The **baseline** may have seen some of those rows
during its original training, since they come from the same labeled dataset.
That biases the comparison conservatively — in the incumbent's favour — so a
candidate that clears the gate cleared a bar that is, if anything, slightly too
high. A permanently held-out test set would remove the caveat, and is the right
fix if this ever becomes the deciding factor.

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

## Stage 5 — Round trip (WBS 4.4.3)

**Code:** `service/routers/retrain.py`, `service/retrain_queue.py`,
`retraining/registry.py`, `retraining/version_file.py`, `retraining/checksum.py`
· **CLI:** `scripts/retrain.py --register/--activate` ·
**Live demo:** `scripts/round_trip.py` ·
**Tests:** `tests/test_round_trip.py` (21)

*Integration test: full retraining round trip (report → validate → retrain →
deploy).* Before this, two links in that chain did not exist, both on the AI
side:

1. The backend's hourly cron (`retraining.service.ts`) already POSTed to
   `${AI_SERVICE_URL}/retrain` when a trigger fired -- but the AI service
   registered no such route. The call 404d and the backend caught it as a
   warning, so the trigger had never once been observable from either side.
2. `pipeline.py` scored a candidate and wrote `decision.json`, then stopped.
   It never told `ModelVersions` a candidate existed, so the table stayed
   empty -- which meant the backend's own F1-degradation trigger and its
   rollback route were dead code, since `activeModel` was always `null`.

Both are closed without changing what the deployed model is. The gate's
verdict is still a recommendation; a swap is still a deliberate, separate act
-- see `PIPELINE.md` § Stage 5b for why that separation matters more than
usual right now (the Sprint 5 threshold numbers are with the adviser, and a
promotion would invalidate all of them).

### `POST /retrain` — accept and record, not train

There is no GPU on the machine that would run this service; training happens
on Colab. So the endpoint cannot train anything, and does not pretend to. It
appends the request to a queue file and returns `202`. `GET /retrain/jobs`
reads it back. A repeat of the same trigger while a job for it is still
`queued` returns the existing job rather than a new one -- the cron's
conditions stay true until a model is actually promoted, so an undeduped
queue would grow one row per hour, forever, from day one.

A human drains the queue with `scripts/retrain.py`, same as today.

### `--register` / `--activate` — two flags, not one

`scripts/retrain.py --register` POSTs the finished candidate to the backend
as an **inactive** `ModelVersion` row: `versionTag` (`v<run-stamp>`, e.g.
`v2026-08-17T04-15-33Z`), the candidate's macro-F1, and the gate's reason in
`notes`. Safe the moment a decision exists -- it is only a record.

`--activate` (implies `--register`) makes it the live `ModelVersion`, and
refuses to for a candidate the gate rejected. This is the step that needs a
human sign-off (the adviser, per the open item in `PIPELINE.md` § Stage 5b) --
a pipeline that auto-activates on a green gate is exactly the failure mode
that note warns against. Activating a `ModelVersion` row is also **not** the
same as redeploying: it does not touch the running service, which still
needs the manual "point the live model at `<candidate_dir>`" step
`scripts/retrain.py` has always printed.

### `version.json` — how "deploy" becomes checkable

`config.model_dir` used to be a static string read at import; the service had
no way to say *which* checkpoint it was actually serving. Now, the moment
training finishes, `pipeline.py` writes `version.json` beside the candidate's
weights (`version_tag` + a streamed SHA-256 of `model.safetensors` --
`retraining/checksum.py`, pulled out of the Colab notebook's baseline-check
cell so both compute the digest the same way). It travels with the
checkpoint automatically, so "point the live model at `<candidate_dir>`"
carries its identity along for free.

`GET /health` reads it fresh on every call and reports `version_tag`. At
startup, `service/main.py` compares it against the backend's
`GET /models/active` and logs loudly on a mismatch -- non-fatal, same
reasoning as the campaign-centroid load: a stale record must not stop the
service from classifying. Every checkpoint deployed before this existed,
including the one currently live, has no `version.json`; that reads as
`version_tag: null`, an honest "not yet tracked," not a fabricated tag.

### Proving the round trip without a GPU, Docker, or a network

`tests/test_round_trip.py` walks every stage --
report → gate verdict → register → activate → `/health` reporting the new
version -- with the backend and `_predict` stubbed, the same pattern
`test_reports.py` and `test_retraining_pipeline.py` already use. It proves
the wiring composes, not that the model improved.

`scripts/round_trip.py` is the live counterpart -- real backend, real AI
service, one real forward pass (the deployed checkpoint scored against
itself, so the gate has real numbers to report without training anything).
It is the WBS 4.5.1 Sprint 4 demo, not a CI gate: run it by hand once Docker,
the backend, and the AI service are all up. It seeds three temporary report
rows (idempotent, cleaned up automatically) because there is no dev-mode way
to read a generated OTP through the API to seed them via the normal app flow
-- `OtpSmsService` only logs that delivery was skipped, it never returns the
code. It never activates a `ModelVersion` for real; anything it registers is
tagged `vROUNDTRIP-TEST-...` and stays inactive.

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

The **policy** modules are pure — no database, no model loading, no HTTP.
Callers supply numbers; these modules only decide:

| Module | Purity |
|---|---|
| `triggers.py` · `sampling.py` · `promotion.py` | Pure. Decide only. |
| `snapshot.py` | `build_snapshot` pure; `write_snapshot` / `read_labeled_dataset` touch the filesystem. |
| `reports.py` · `pipeline.py` | Impure by nature — "where do reports come from" and "run a training job" are I/O questions. |

Impurity is quarantined into its own modules rather than threaded through the
policy, which is what keeps the policy trivially unit-testable. That in turn
lets the NestJS hourly cron (WBS 4.3.3) own *scheduling* without duplicating
the *policy* — the trigger thresholds are an ML judgement that belongs with
the ML code, while "run this every hour" is infrastructure.

Note that `pipeline.py` decides but never *acts* on promotion: it writes a
verdict to `decision.json` and stops. Swapping a checkpoint as a side effect of
a training run, with no `ModelVersions` row to roll back to, is the
unrecoverable step this document exists to prevent.

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
| 4.3.5 | Automated retraining pipeline | ✅ Done. `DatabaseReportSource` reads WBS 4.3.1's table (verified against a live backend); first real GPU fine-tune ran 2026-08-17 (Colab T4, `evaluation/retraining_run_2026-08-17.json`), gate says promote — not acted on, see `PIPELINE.md` § Stage 5b |
| 4.3.8 | Campaign evolution tracking | ✅ Done (`campaign_evolution.py`, see `PIPELINE.md` Stage 9b — not a retraining component, listed here for status continuity) |
| 4.4.3 | Integration test: full retraining round trip | ✅ Done. Built, CI-tested (`tests/test_round_trip.py`, 21 tests), and **run live** 2026-08-18 against real Docker Postgres + backend + AI service — `scripts/round_trip.py` passed every stage (report seeded → validated report read from the live table → `POST /retrain` accepted and queued → real gate verdict → `ModelVersion` registered, never activated → cleaned up). Found and fixed one real bug in the process (the script's own scratch directory wasn't created before the gate tried to write into it). `ModelVersions` also given its first real row the same session (`scripts/register_incumbent.py --activate`): the deployed 2026-07-29 checkpoint, macro-F1 0.9438 — confirmed via `GET /health` reporting `version_tag` and `GET /models/active` matching. Unblocks 4.5.1 |
