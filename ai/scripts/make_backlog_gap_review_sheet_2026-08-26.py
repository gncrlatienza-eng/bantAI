"""Build a review sheet for the last gaps in the review backlog before the final retrain.

Track B (AI/ML) -- review round 9 (pre-final-retrain sweep, 2026-08-27).

Two small pools of rows that fell through every past review round and were
never eyeballed by a human, found while auditing the pipeline before what is
meant to be the last retraining run:

1. **Raw-inbox rows in `needs_review.csv`** (low confidence) that never landed
   on any of the 9 review sheets to date (rounds 1-8, including today's
   `review_sheet_2026-08-26.csv`). Kaggle/NTC low-confidence rows are
   deliberately excluded here -- see `make_backlog_review_sheet.py` -- those
   corpora carry a trusted external label, so only raw-inbox (no external
   label at all) needs a human.
2. **`label_changes.csv` rows never reviewed** -- these are cases where a rule
   overrode a corpus's own source label (e.g. Kaggle's blanket "scam" stamp)
   and confidence was high enough that they never entered needs_review.csv,
   but they were also never checked by a human like the rest of that file's
   siblings were (65 of 76 already were, on review_sheet.csv).

Run:  cd ai && python scripts/make_backlog_gap_review_sheet_2026-08-26.py
Out:  datasets/audit/review_sheet_backlog_gap_2026-08-26.csv
"""

from __future__ import annotations

import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..")))
DATASETS = os.environ.get("BANTAI_DATASETS", os.path.normpath(os.path.join(HERE, "..", "datasets")))
AUDIT = os.path.join(os.environ.get("BANTAI_OUT_ROOT", DATASETS), "audit")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

REVIEW_SHEETS = [
    "review_sheet.csv",
    "review_sheet_trusted.csv",
    "review_sheet_promo_link.csv",
    "review_sheet_confidence.csv",
    "review_sheet_new_batch.csv",
    "review_sheet_new_batch_2.csv",
    "review_sheet_idn_fix.csv",
    "review_sheet_backlog.csv",
    "review_sheet_2026-08-26.csv",
]

FIELDS = [
    "id",
    "pool",
    "verdict",
    "correct_label",
    "notes",
    "text",
    "rule_label",
    "confidence",
    "reason",
    "language",
    "source",
    "source_label",
    "sender",
]


def _on_any_sheet() -> set:
    texts = set()
    for name in REVIEW_SHEETS:
        path = os.path.join(AUDIT, name)
        if os.path.isfile(path):
            with open(path, encoding="utf-8-sig") as f:
                for r in csv.DictReader(f):
                    texts.add(r["text"])
    return texts


def main() -> None:
    reviewed = _on_any_sheet()

    with open(os.path.join(AUDIT, "needs_review.csv"), encoding="utf-8") as f:
        needs_review = list(csv.DictReader(f))
    raw_gap = [r for r in needs_review if r["source"] == "raw-inbox" and r["text"] not in reviewed]

    with open(os.path.join(AUDIT, "label_changes.csv"), encoding="utf-8") as f:
        label_changes = list(csv.DictReader(f))
    changes_gap = [r for r in label_changes if r["text"] not in reviewed]

    out_path = os.path.join(AUDIT, "review_sheet_backlog_gap_2026-08-26.csv")
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        i = 0
        for pool_name, rows in (("needs_review (raw-inbox)", raw_gap), ("label_changes (rule override)", changes_gap)):
            for r in rows:
                i += 1
                w.writerow(
                    {
                        "id": i,
                        "pool": pool_name,
                        "verdict": "",
                        "correct_label": "",
                        "notes": "",
                        "text": r["text"],
                        "rule_label": r["label"],
                        "confidence": r.get("confidence", ""),
                        "reason": r["reason"],
                        "language": r.get("language", ""),
                        "source": r["source"],
                        "source_label": r.get("source_label", ""),
                        "sender": r.get("sender", ""),
                    }
                )

    print(f"raw-inbox needs_review gap: {len(raw_gap)}")
    print(f"label_changes gap:          {len(changes_gap)}")
    print(f"Wrote {i} rows -> {out_path}")


if __name__ == "__main__":
    main()
