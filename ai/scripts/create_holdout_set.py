"""Carve out a permanent held-out test set (Sprint 6, WBS 6.4.6 prep).

Every evaluation number produced so far -- the deployed model's 0.9438
macro-F1 in ``AI_MODEL_RESULTS.md``, the 2026-08-17 retraining run's gate
verdict -- was measured on the same 80/20 stratified split (seed 42) that
``training/dataset.py:load_split`` draws fresh from ``datasets/labeled/``
every time. That split is fine for day-to-day development, but it is *not* a
permanently held-out test set: it is regenerated from the same pool the
model is trained on, using the exact same seed, run after run. WBS 6.4.6
("confusion matrix on the 20% held-out set") wants the stronger claim a
thesis defense should be able to make -- rows the model has *never* been
anywhere near, not even during earlier tuning.

**What this script actually does:** picks ~20% of the current labeled
dataset, groups by *masked* text first (the same de-duplication key
``training/dataset.py`` and ``retraining/snapshot.py`` already use, for the
same reason -- two raw messages that mask to the same string must never end
up split across two different pools, or the "held out" claim is broken by a
near-duplicate the model saw under a different disguise), then removes an
entire whole group at a time so no leakage is possible. The selected rows
are written to ``datasets/holdout/holdout.csv``, **outside**
``datasets/labeled/`` -- both ``training/dataset.py`` and
``retraining/snapshot.py`` only ever glob files *inside*
``datasets/labeled/``, so moving the rows out is what actually makes them
invisible to every future training and retraining run, with no new
exclusion logic needed anywhere else. The remaining ~80% overwrites
``datasets/labeled/bantai_labeled.csv`` in place.

**This is a one-way split, but not a lossy one.** ``holdout.csv`` and the
rewritten ``bantai_labeled.csv`` together reconstruct the exact original
16,772-ish rows -- nothing is deleted, just re-partitioned. A dated backup
of the original file is written alongside anyway, purely as a second safety
net, and the script refuses to run twice (see ``--force``) so a training
pool cannot be silently shrunk by 20% a second time.

**The one honest limitation, stated plainly because it matters for a
defense:** this only protects models trained *after* this script runs. The
currently deployed checkpoint (trained 2026-07-29) and the 2026-08-17
retraining candidate were both trained before this holdout set existed, on
the full pool -- so some of the rows landing in ``holdout.csv`` today were
almost certainly part of *their* training data. Neither of those two
checkpoints can be honestly graded against this holdout set. The first
model this holdout set is valid for is the *next* one trained after today.

Run:
    cd ai && .venv/Scripts/python.exe scripts/create_holdout_set.py --dry-run
        Report the split without writing anything.

    cd ai && .venv/Scripts/python.exe scripts/create_holdout_set.py
        Write datasets/holdout/holdout.csv + manifest.json, back up and
        rewrite datasets/labeled/bantai_labeled.csv. Refuses if a holdout
        manifest already exists (pass --force to redo it from scratch).
"""

from __future__ import annotations

import argparse
import glob
import hashlib
import json
import os
import shutil
import sys
from collections import defaultdict
from datetime import datetime, timezone

import pandas as pd

sys.path.insert(0, ".")

from preprocessing import preprocess  # noqa: E402
from training.config import LABEL2ID  # noqa: E402

LABELED_DIR = "datasets/labeled"
HOLDOUT_DIR = "datasets/holdout"
HOLDOUT_CSV = os.path.join(HOLDOUT_DIR, "holdout.csv")
HOLDOUT_MANIFEST = os.path.join(HOLDOUT_DIR, "manifest.json")

#: Deliberately not TrainingConfig.seed (42) -- this is a one-time,
#: different mechanism (whole-dataset re-partition, not a per-run
#: train/val split), and using a visibly different constant makes it
#: obvious in any log or manifest which mechanism produced a given split.
HOLDOUT_SEED = 20260618
HOLDOUT_FRACTION = 0.20


def _read_labeled_files() -> pd.DataFrame:
    files = sorted(
        glob.glob(os.path.join(LABELED_DIR, "*.csv"))
        + glob.glob(os.path.join(LABELED_DIR, "*.jsonl"))
        + glob.glob(os.path.join(LABELED_DIR, "*.json"))
    )
    files = [f for f in files if not os.path.basename(f).startswith("sample")]
    if not files:
        raise FileNotFoundError(f"No labeled data found in '{LABELED_DIR}'.")
    if len(files) > 1:
        # Today there is exactly one (bantai_labeled.csv). Handled anyway
        # rather than silently mishandled if that ever changes -- but the
        # rewrite step below only knows how to write one output file, so
        # refuse rather than guess which file each remaining row belongs in.
        raise RuntimeError(
            f"Found {len(files)} labeled files ({files}); this script only supports rewriting a single "
            "source file. Consolidate to one file first, or extend the rewrite step."
        )
    frames = [pd.read_csv(files[0])]
    df = pd.concat(frames, ignore_index=True)
    df.attrs["source_path"] = files[0]
    return df


def _group_by_masked_text(df: pd.DataFrame) -> dict:
    """Map masked text -> list of row indices sharing it.

    Whole groups move together in the split below -- the reason is exactly
    the leakage bug already found and fixed on the train/val split
    (see training/dataset.py's comment on the same de-duplication): two raw
    rows that mask to the same string are one model input wearing two
    disguises, and must never be allowed to land on both sides of any split.
    """
    groups: dict = defaultdict(list)
    label_disagreements = 0
    for idx, row in df.iterrows():
        masked = preprocess(str(row["text"]))
        groups[masked].append(idx)
    for masked, idxs in groups.items():
        labels = {df.loc[i, "label"] for i in idxs}
        if len(labels) > 1:
            label_disagreements += 1
    if label_disagreements:
        print(
            f"note: {label_disagreements} masked-text group(s) contain rows with different labels; "
            "first-seen label used as the group's representative, matching training/dataset.py's "
            "existing dedup convention."
        )
    return groups


def compute_split(df: pd.DataFrame) -> tuple:
    """Return (holdout_row_indices, remaining_row_indices, group_stats)."""
    from sklearn.model_selection import train_test_split

    groups = _group_by_masked_text(df)
    masked_keys = list(groups.keys())
    representative_labels = [df.loc[groups[k][0], "label"] for k in masked_keys]

    train_keys, holdout_keys = train_test_split(
        masked_keys,
        test_size=HOLDOUT_FRACTION,
        random_state=HOLDOUT_SEED,
        stratify=representative_labels,
    )

    holdout_idx = sorted(i for k in holdout_keys for i in groups[k])
    remaining_idx = sorted(i for k in train_keys for i in groups[k])

    stats = {
        "n_groups_total": len(masked_keys),
        "n_groups_holdout": len(holdout_keys),
        "n_groups_remaining": len(train_keys),
    }
    return holdout_idx, remaining_idx, stats


def _label_counts(df: pd.DataFrame, idx: list) -> dict:
    return dict(sorted(df.loc[idx, "label"].value_counts().to_dict().items()))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="Report the split without writing anything.")
    parser.add_argument(
        "--force",
        action="store_true",
        help="Redo the holdout split from scratch even if one already exists. Overwrites the existing holdout.",
    )
    args = parser.parse_args()

    if os.path.isfile(HOLDOUT_MANIFEST) and not args.force and not args.dry_run:
        with open(HOLDOUT_MANIFEST, encoding="utf-8") as handle:
            existing = json.load(handle)
        print(f"error: a holdout set already exists (created {existing['created_at']}, {existing['n_rows']} rows).")
        print("Re-running would shrink the training pool by another 20% on top of the existing holdout.")
        print("Pass --force only if you specifically intend to redo the split from scratch.")
        return 1

    df = _read_labeled_files()
    unrecognised = set(df["label"]) - set(LABEL2ID)
    if unrecognised:
        print(f"error: unrecognised label(s) in the dataset: {unrecognised}", file=sys.stderr)
        return 1

    holdout_idx, remaining_idx, stats = compute_split(df)
    holdout_df = df.loc[holdout_idx]
    remaining_df = df.loc[remaining_idx]

    print(f"Source: {df.attrs['source_path']} ({len(df)} raw rows)")
    print(f"Unique masked-text groups: {stats['n_groups_total']}")
    print(f"  -> holdout:   {stats['n_groups_holdout']} groups, {len(holdout_df)} raw rows")
    print(f"  -> remaining: {stats['n_groups_remaining']} groups, {len(remaining_df)} raw rows")
    print(f"Holdout label distribution:   {_label_counts(df, holdout_idx)}")
    print(f"Remaining label distribution: {_label_counts(df, remaining_idx)}")

    if args.dry_run:
        print("\nDRY RUN -- nothing written. Re-run without --dry-run to commit this split.")
        return 0

    os.makedirs(HOLDOUT_DIR, exist_ok=True)

    # Safety net: the split is losslessly reversible (holdout + remaining ==
    # original), but a byte-for-byte backup of the untouched original costs
    # almost nothing and removes any doubt.
    source_path = df.attrs["source_path"]
    backup_path = source_path + f".pre-holdout-backup-{datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')}"
    shutil.copy2(source_path, backup_path)

    holdout_df.to_csv(HOLDOUT_CSV, index=False)
    remaining_df.to_csv(source_path, index=False)

    digest = hashlib.sha256(open(HOLDOUT_CSV, "rb").read()).hexdigest()
    manifest = {
        "created_at": datetime.now(timezone.utc).isoformat(),
        "seed": HOLDOUT_SEED,
        "fraction": HOLDOUT_FRACTION,
        "source_file": source_path,
        "n_rows": len(holdout_df),
        "n_groups": stats["n_groups_holdout"],
        "label_counts": _label_counts(df, holdout_idx),
        "holdout_csv_sha256": digest,
        "backup_of_original": backup_path,
        "warning": (
            "This holdout set only protects models trained AFTER it was created. "
            "The checkpoint deployed 2026-07-29 and the 2026-08-17 retraining candidate "
            "were both trained on the full pool before this split existed and were almost "
            "certainly trained on some of these rows -- do not evaluate either of them "
            "against this holdout and report the result as a clean, never-seen test. "
            "The first model this is valid for is the next one trained from this point on."
        ),
    }
    with open(HOLDOUT_MANIFEST, "w", encoding="utf-8") as handle:
        json.dump(manifest, handle, indent=2, sort_keys=True)

    print(f"\nWrote {HOLDOUT_CSV} ({len(holdout_df)} rows)")
    print(f"Wrote {HOLDOUT_MANIFEST}")
    print(f"Rewrote {source_path} ({len(remaining_df)} rows remain for training)")
    print(f"Backup of the untouched original: {backup_path}")
    print(
        "\nFrom now on, every training run and every retraining snapshot draws from a pool "
        f"20% smaller ({len(remaining_df)} rows instead of {len(df)}) -- that is the whole point: "
        "these rows are now permanently outside anything the model trains or tunes on."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
