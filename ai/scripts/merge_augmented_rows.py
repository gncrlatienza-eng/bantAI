"""Merge reviewed synthetic Scam rows into the labeled corpus.

    cd ai && python scripts/merge_augmented_rows.py                      # dry run
    cd ai && python scripts/merge_augmented_rows.py --apply

``scripts/augment_scam_dataset.py`` writes generated rows to
``datasets/augmented/`` and deliberately does *not* merge them -- a human
reviews the batch first. This is the other half of that loop: it takes the rows
a reviewer confirmed and appends them to
``datasets/labeled/bantai_labeled.csv``.

**What counts as approved.** The same convention
``augment_scam_dataset.rejected_seed_ids`` already relies on: a ``correct_label``
that *agrees* with the row's label confirms it; one that *disagrees* rejects it.
A blank cell is an unreviewed row, not a silent yes, so it is skipped -- pass
``--blank-means-approved`` for a sheet reviewed under the older convention where
the reviewer only marked corrections.

**Every merged row is tagged** with its ``origin`` (``authored`` or
``variant``). ``training/dataset.py`` reads that column and keeps synthetic rows
out of the validation half, so the score still comes from real messages only;
``scripts/embed_dataset.py`` skips them entirely, so generated text cannot
invent a campaign that never existed.

Three things are refused rather than merged, each reported:

* a row whose masked text is already in the corpus -- it would add nothing, and
  if the labels differed it would block training outright (LabelConflictError);
* a row whose masked text is in the frozen holdout -- that is training on the
  test set;
* a rejected row -- the reviewer's correction is about the *seed* it came from,
  which ``scripts/make_rejected_seed_review_sheet.py`` handles instead.
"""

from __future__ import annotations

import argparse
import collections
import csv
import glob
import os
import shutil
import sys
from datetime import datetime, timezone
from typing import Dict, List, Tuple

sys.path.insert(0, ".")

from preprocessing import preprocess  # noqa: E402
from training.config import SYNTHETIC_ORIGINS  # noqa: E402

CORPUS = "datasets/labeled/bantai_labeled.csv"
HOLDOUT = "datasets/holdout/holdout.csv"
AUGMENTED_DIR = "datasets/augmented"
BACKUP_DIR = "datasets/labeled_backups"

CANON = {"HAM": "Ham", "SPAM": "Spam", "SCAM": "Scam"}
SHEET_COLUMNS = {"text", "label", "correct_label", "origin"}


def read_csv(path: str) -> Tuple[List[dict], List[str]]:
    with open(path, encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader), list(reader.fieldnames or [])


def review_sheets(directory: str) -> List[str]:
    """Batch CSVs in ``directory`` -- anything carrying the reviewer's columns."""
    out = []
    for path in sorted(glob.glob(os.path.join(directory, "*.csv"))):
        with open(path, encoding="utf-8-sig", newline="") as handle:
            header = next(csv.reader(handle), [])
        if SHEET_COLUMNS.issubset(set(header)):
            out.append(path)
    return out


def classify_row(row: dict, blank_means_approved: bool) -> str:
    """One of: approved, rejected, unreviewed, not-scam."""
    verdict = (row.get("correct_label") or "").strip()
    label = (row.get("label") or "").strip()
    if not verdict:
        return "approved" if blank_means_approved and label == "Scam" else "unreviewed"
    if CANON.get(verdict.upper(), verdict) != label:
        return "rejected"
    return "approved" if label == "Scam" else "not-scam"


def _plan_rows(approved: List[Tuple[dict, str]], corpus: List[dict], holdout_masked: set) -> Tuple[List[dict], Dict]:
    """Filter already-approved ``(row, source)`` pairs down to what may be added.

    Split out from :func:`plan` so the three refusals can be tested without
    review sheets on disk -- they are the part that protects the corpus.
    """
    corpus_masked = {preprocess(r["text"]) for r in corpus}
    seen_in_batch: set = set()
    to_add: List[dict] = []
    counts: Dict[str, int] = collections.Counter()

    for row, source in approved:
        masked = preprocess(row["text"])
        if masked in holdout_masked:
            counts["skipped: in the frozen holdout"] += 1
            continue
        if masked in corpus_masked:
            counts["skipped: already in the corpus"] += 1
            continue
        if masked in seen_in_batch:
            counts["skipped: duplicate within the batch"] += 1
            continue

        seen_in_batch.add(masked)
        to_add.append(
            {
                "text": row["text"],
                "label": row["label"],
                "language": "",
                "timestamp": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "source": source,
                "origin": (row.get("origin") or "").strip(),
            }
        )
        counts["approved"] += 1
    return to_add, counts


def plan(sheets: List[str], corpus: List[dict], holdout_masked: set, blank_ok: bool) -> Tuple[List[dict], Dict]:
    """Decide what to merge. Returns (rows to append, per-reason counts)."""
    approved: List[Tuple[dict, str]] = []
    counts: Dict[str, int] = collections.Counter()

    for path in sheets:
        rows, _ = read_csv(path)
        source = f"augmented:{os.path.splitext(os.path.basename(path))[0]}"
        for row in rows:
            verdict = classify_row(row, blank_ok)
            if verdict == "approved":
                approved.append((row, source))
            else:
                counts[verdict] += 1

    to_add, add_counts = _plan_rows(approved, corpus, holdout_masked)
    counts.update(add_counts)
    return to_add, counts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="write the corpus (default: dry run)")
    parser.add_argument(
        "--sheet",
        action="append",
        help="review sheet(s); default: every batch CSV in datasets/augmented",
    )
    parser.add_argument(
        "--blank-means-approved",
        action="store_true",
        help="treat an empty correct_label as confirmation (older sheets, where only corrections were marked)",
    )
    args = parser.parse_args()

    sheets = args.sheet or review_sheets(AUGMENTED_DIR)
    if not sheets:
        sys.exit(f"error: no review sheets found in {AUGMENTED_DIR}")

    corpus, fieldnames = read_csv(CORPUS)
    holdout_masked = set()
    if os.path.isfile(HOLDOUT):
        holdout_rows, _ = read_csv(HOLDOUT)
        holdout_masked = {preprocess(r["text"]) for r in holdout_rows}
    else:
        print(f"warning: no holdout at {HOLDOUT}; cannot check for test-set leakage")

    to_add, counts = plan(sheets, corpus, holdout_masked, args.blank_means_approved)

    print("sheets read:")
    for path in sheets:
        print("  ", path)
    print()
    for reason, n in sorted(counts.items()):
        print(f"  {n:>5}  {reason}")
    print(f"\n{len(to_add)} row(s) would be added" + ("" if args.apply else " -- dry run, nothing written"))
    if to_add:
        print("  by origin:", dict(collections.Counter(r["origin"] for r in to_add)))
    if not args.apply or not to_add:
        return 0

    os.makedirs(BACKUP_DIR, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    backup = os.path.join(BACKUP_DIR, f"bantai_labeled.pre-augmented-merge-{stamp}.csv")
    shutil.copy2(CORPUS, backup)
    print("backup:", backup)

    # ``origin`` is new the first time this runs; existing rows keep an empty value.
    out_fields = list(fieldnames)
    if "origin" not in out_fields:
        out_fields.append("origin")

    with open(CORPUS, "w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=out_fields)
        writer.writeheader()
        for row in corpus:
            writer.writerow({key: row.get(key, "") for key in out_fields})
        for row in to_add:
            writer.writerow({key: row.get(key, "") for key in out_fields})

    merged, _ = read_csv(CORPUS)
    print(f"corpus is now {len(merged)} rows:", dict(collections.Counter(r["label"] for r in merged)))
    synthetic = sum(1 for r in merged if (r.get("origin") or "") in SYNTHETIC_ORIGINS)
    print(f"synthetic rows: {synthetic} (kept out of validation by training/dataset.py)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
