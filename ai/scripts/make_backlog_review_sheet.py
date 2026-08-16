"""Build a human-review sheet for the raw-inbox low-confidence backlog.

Sprint 2 Track B (AI/ML) -- review round 7.

2026-07-30: rounds 1-6 always scoped review to whatever batch had just
arrived, so a backlog of low-confidence raw-inbox rows from *earlier*
batches was never put in front of a human -- they were still trained on
using the rule engine's best guess. This is the full population of that
backlog: every low-confidence row sourced from ``raw-inbox`` that has never
appeared on any prior review sheet. Kaggle/NTC low-confidence rows are
excluded on purpose -- those came in with a trusted external label already,
so "low confidence" there just means our own rules couldn't independently
corroborate it, not that the label itself is suspect.

Run:  cd ai && python scripts/make_backlog_review_sheet.py
Out:  datasets/audit/review_sheet_backlog.csv
"""

from __future__ import annotations

import csv
import glob
import os
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATASETS = os.environ.get("BANTAI_DATASETS", os.path.normpath(os.path.join(HERE, "..", "datasets")))
AUDIT = os.path.join(os.environ.get("BANTAI_OUT_ROOT", DATASETS), "audit")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

FIELDS = [
    "id",
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


def load_reviewed_texts() -> set[str]:
    """Every message text that has appeared on any prior review sheet."""
    seen = set()
    for sheet in glob.glob(os.path.join(AUDIT, "review_sheet*.csv")):
        with open(sheet, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                if row.get("text"):
                    seen.add(row["text"])
    return seen


def main() -> None:
    already_reviewed = load_reviewed_texts()

    with open(os.path.join(AUDIT, "needs_review.csv"), encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    seen: set[str] = set()
    picked = []
    for r in rows:
        if r.get("source") != "raw-inbox":
            continue
        if r["text"] in already_reviewed or r["text"] in seen:
            continue
        seen.add(r["text"])
        picked.append(r)

    out = os.path.join(AUDIT, "review_sheet_backlog.csv")
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for i, r in enumerate(picked, 1):
            w.writerow(
                {
                    "id": f"bl-{i:04d}",
                    "verdict": "",
                    "correct_label": "",
                    "notes": "",
                    "text": r["text"],
                    "rule_label": r["label"],
                    "confidence": r["confidence"],
                    "reason": r.get("reason", ""),
                    "language": r.get("language", ""),
                    "source": r.get("source", ""),
                    "source_label": r.get("source_label", ""),
                    "sender": r.get("sender", ""),
                }
            )

    print("=" * 68)
    print(
        f"Backlog review sheet (round 7): {len(picked)} rows (raw-inbox, "
        f"low-conf, never reviewed) -> {os.path.relpath(out, DATASETS)}"
    )
    print("-" * 68)
    print(f"  labels: {Counter(r['label'] for r in picked)}")
    print("-" * 68)
    for k, n in Counter(r["reason"] for r in picked).most_common(20):
        print(f"  {k:32} {n:4}")
    print("=" * 68)


if __name__ == "__main__":
    main()
