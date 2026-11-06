# Evaluation records — reproducibility status

**Status as of 2026-09-19: every JSON in this directory is UNREPRODUCED IN THIS CHECKOUT.**

Quote these numbers in the manuscript only with the qualification below, until the
artifacts listed in "What is missing" are restored and the hash checks pass.

## Why they are unreproduced

These files are *records of runs*, not evidence that this working copy can repeat them.
The inputs they were computed from are deliberately excluded from Git, and are also
absent from this machine's filesystem:

| Input | Ignored by | Present here? |
|---|---|---|
| `models/xlm-roberta-smishing/` (weights, tokenizer, `version.json`) | `.gitignore:124` | No — `models/` holds only `.gitkeep` |
| `datasets/labeled/*.csv` (the training corpus) | `.gitignore:74` | No — only `sample.csv`, a 9-row format reference |
| `datasets/holdout/holdout.csv` (permanent test set) | `.gitignore:107` | No — only `manifest.json` |
| `datasets/augmented/*.csv` (synthetic Scam rows) | `.gitignore:83` | No — only the per-batch count summaries |
| `datasets/processed/*` (embeddings, snapshots) | `.gitignore:59,65,69` | No |

**This exclusion is correct and intentional**, not an accident or a loss. The corpus is
real personal SMS and must not be committed; the weights are 1GB+ binaries. The
`.gitignore` entries carry written rationale for each. What follows from it is narrower
than "no model was ever trained": it is that **this checkout cannot serve, re-score, or
reproduce the model**, and the artifacts must be recovered from the environment that
produced them (Track B / Colab / the AI owner's machine) before any number here is
defensible.

Do not attempt to reconstruct the corpus from the summaries in `datasets/augmented/`.
Those contain counts only, by design — the rows live in the ignored `.csv` files beside
them.

## The recovery path is verifiable

Recovery is a hash check, not a judgement call. `datasets/holdout/manifest.json` records
`holdout_csv_sha256 = 31e8112056…9003a755`, and the 2026-09-16 evaluation records the
same digest as the file it scored. **The two agree.** A recovered `holdout.csv` whose
SHA-256 matches that value is provably the same test set those metrics were measured on;
one that does not match invalidates the comparison and must not be substituted silently.

## Holdout validity — read before citing any metric

`manifest.json` states two constraints that several files here predate:

1. **Contamination.** The holdout was created 2026-08-18. The checkpoint deployed
   2026-07-29 and the 2026-08-17 retraining candidate were trained on the full pool
   before the split existed, so they were almost certainly trained on some holdout rows.
   Results for those two models are **not** clean never-seen test results.
2. **Relabelling boundary.** On 2026-09-16 seven rows were corrected after blind human
   review (5 Scam→Spam, 2 Scam→Ham). Numbers published before that date — including
   macro-F1 0.9592 and Scam recall 92.4% — were measured against the previous labels and
   are **not directly comparable** to numbers measured after it.

## File-by-file

| File | Depends on the missing checkpoint? | Note |
|---|---|---|
| `holdout_confusion_2026-09-16T07-45-54Z.json` | Yes | Post-relabel. Records `checkpoint_integrity: ok`, `holdout_integrity: ok`, macro-F1 0.9614 over 3,236 rows. The most defensible record here — but still unreproducible until the weights and CSV return. |
| `holdout_buckets_2026-09-16T07-57-15Z.json` | Yes | Post-relabel routing/bucket coverage for the same run. |
| `holdout_confusion_2026-08-18T15-21-47Z.json` | Yes | Pre-relabel labels. See constraint 2. |
| `holdout_confusion_2026-08-27T10-32-15Z.json` | Yes | Pre-relabel labels. See constraint 2. |
| `retraining_run_2026-08-17.json` | Yes | Candidate predates the holdout split. See constraint 1. |
| `retraining_run_2026-08-26.json` | Yes | Its candidate trained under two data-corruption bugs fixed before the 08-27 run; the file documents them. |
| `retraining_run_2026-08-27.json` | Yes | |
| `clustering_tuning.json` | No — campaign clustering, not the classifier | Needs the corpus (6,709 deduped Spam/Scam rows), not the classifier checkpoint. |
| `embedding_centering_hdbscan.json`, `embedding_centering_lexical.json` | No | Corpus-dependent only. |
| `hybrid_match_calibration_*.json`, `match_threshold_calibration.json` | No | Corpus-dependent only. |
| `campaign_embedding_comparison.json` | No | Corpus-dependent only. |

## Clearing this notice

Per `ML_READINESS_PLAN_2026-09-19.md`, a file may drop the unreproduced label once its
exact checkpoint, data snapshot, predictions, and hashes are restored **and** re-verified
here. Record who restored each artifact, from where, and the verifying digest.
