# Model Refinement Plan — Sprint 5, WBS 5.2.2

**Design doc for WBS 5.2.2** ("Model refinement plan using S2–S4 collected
data"). Its execution counterpart is **5.3.5** ("XLM-RoBERTa refinement on
data collected during S2–S4") — this document is the plan; 5.3.5's status is
tracked separately since the plan below has already been run once (Sprint 4,
WBS 4.3.5) and its result is a pending decision, not a not-yet-started task.

---

## What "S2–S4 collected data" actually is

The deployed model (macro-F1 0.9438, `AI_MODEL_RESULTS.md` "run 3, final")
was trained 2026-07-29 on **15,728 rows**. Since then, real phone-inbox
exports collected during Sprints 2–4 added **1,050 + 447 new messages** on
2026-07-30, growing the labeled dataset to **16,772 rows** — 14,928 after
masked-text de-duplication, which is the number that actually reaches
training. No relabeling happened in that window (the Kaggle/NTC blanket-
"scam" fix, see memory `bantai-dataset-relabeling`, predates it), so this is
new signal, not a labels-changed artifact.

"Refinement" in this plan means exactly one thing: **fine-tune the existing
architecture (XLM-RoBERTa-base, same hyperparameters, same preprocessing) on
the grown dataset**, not a new architecture or training recipe. The
manuscript describes the training procedure once (Sprint 2, WBS 2.3.4); this
plan reuses it rather than introducing a second one, for the same reason
`retraining/pipeline.py` reuses `training/train.py` unchanged — a retrained
checkpoint is only comparable to the original if one training implementation
produced both.

## The mechanism: reuse Sprint 4's retraining pipeline

5.3.5 does not need new machinery. `retraining/pipeline.py` (WBS 4.3.5) *is*
the refinement mechanism — snapshot the current dataset, fine-tune, score
the result against the incumbent on identical rows, gate the decision:

```
snapshot  ->  fine-tune  ->  score both models  ->  promotion gate
```

This already ran for real once — **2026-08-17, Colab T4**
(`ai/evaluation/retraining_run_2026-08-17.json`): 14,928 rows, gate says
**promote**, macro-F1 0.9520 → 0.9648 (97 fixes vs 44 regressions,
p=9.5e-06). See `RETRAINING.md` § Stage 3 for how that run was produced and
verified (baseline SHA-256 check, both checkpoints scored on GPU, the
comparison's incumbent-favoring bias documented rather than ignored).

**So 5.3.5's refinement has already been executed once.** What remains is
not "run a refinement" — it's the decision this plan exists to gate.

## Acceptance criteria (already built, WBS 4.2.3/4.3.7)

A refined candidate is accepted only if **both**:

1. **F1 floor** — macro-F1 does not fall more than 1pp below the incumbent
   (`retraining/promotion.py:F1_FLOOR_TOLERANCE`).
2. **McNemar's test** — the improvement is statistically real at α=0.05, not
   sampling noise on the ~3,350-row validation split.

Nothing here is refinement-specific; it's the same gate every future
retraining candidate will be scored against, which is the point — the
2026-08-17 run isn't a special case, it's the mechanism's first real
exercise.

## The decision this plan cannot make on its own

A promotion is **not** just "swap the checkpoint." Campaign centroids live in
the embedding space of whichever checkpoint produced them, and the entire
Sprint 5 threshold body of work — the 0.85→0.999 recalibration, the
three-tier hybrid lexical gates, the embedding-centering bracket (WBS
5.3.6) — was measured against the 2026-07-29 checkpoint specifically. A swap
invalidates all of it. `PIPELINE.md` § "Stage 5b — measured limits" states
this as a standing warning, not a one-off caveat:

> Sprint 4's retraining pipeline periodically fine-tunes the very model that
> window is a property of. If retraining shifts the embedding geometry,
> campaign matching degrades silently — no error, just fewer matches.

So the refinement plan's actual decision point is: **promote only with the
adviser's sign-off**, because those Sprint 5 numbers are under adviser review
right now and changing the model underneath a review in progress is the
worst possible timing (`for-gio-wbs-4.3.5.md` § 3 has the full reasoning
written out for the team).

## If promoted: the required follow-on work

Not optional, not a "nice to have" — the campaign-matching feature silently
stops working correctly without these:

1. `scripts/embed_dataset.py` — re-embed the full dataset under the new
   checkpoint.
2. `scripts/cluster_campaigns.py` — re-cluster from the new embeddings.
3. Re-run every Sprint 5 calibration script against the new geometry:
   `calibrate_match_threshold.py`, `calibrate_hybrid_match.py`,
   `compare_embedding_centering.py`. The 0.999 threshold, the hybrid gates,
   and the centering decision are all fitted to the *old* embedding space and
   do not transfer.
4. `scripts/retrain.py --activate` (WBS 4.4.3) to record the promotion in
   `ModelVersions`, and the manual "point the live model at the candidate
   checkpoint" step `scripts/retrain.py` prints when the gate accepts a
   candidate.

## If not promoted

5.3.5 and 5.3.6 close as **"measured, evaluated, not adopted"**, with the
adviser's reasoning recorded in the WBS entry. The mechanism (this plan) is
still validated — it produced a real, statistically significant candidate
and a working gate — the decision not to deploy it is a project judgment
call about timing (mid-review), not a finding that the mechanism doesn't
work.

## Rollback

Unaffected by this plan either way: promotion is a `ModelVersions` pointer
swap, not an overwrite. Old checkpoints are never deleted by the pipeline, so
rollback is repointing to the previous row. See `RETRAINING.md` § Rollback.

## Going forward — what triggers the *next* refinement

Automatic, not just this one manual round: `retraining.triggers` (WBS 4.1.2)
already defines when a refinement should run again — 50 validated reports
accumulated, a 5pp macro-F1 drop, or Page-Hinkley drift — and the backend's
hourly cron (`retraining.service.ts`) evaluates them and now has somewhere
real to send the result (`POST /retrain`, WBS 4.4.3). This plan's mechanism
is not a one-time Sprint 5 exercise; it is the thing that trigger fires.
