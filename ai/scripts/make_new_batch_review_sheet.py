"""Build a human-review sheet for the low-confidence rows in today's new batch.

Sprint 2 Track B (AI/ML) -- review round 5.

2026-07-29: 447 new unique messages arrived via a fresh phone-inbox export
(``PHONE-SMS-INBOX_20260729-105615.csv``). Most landed high/medium confidence
via existing rules and don't need re-review -- rounds 1-4 already validated
those rules at 87-97% agreement. This is the full population of the NEW
batch's low-confidence rows only: the rules admitted doubt, so a human should
look. Small on purpose (this is a top-up, not a fresh review cycle).

Run:  cd ai && python scripts/make_new_batch_review_sheet.py
Out:  datasets/audit/review_sheet_new_batch.csv
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
SRC = os.path.join(DATASETS, "bantAI-datasets", "Raw")
NEW_FILE = os.path.join(SRC, "PHONE-SMS-INBOX_20260729-105615.csv")

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


def load_new_pairs() -> set[tuple[str, str]]:
    """(sender, body) pairs that only exist in today's new export."""
    old_pairs = set()
    for path in sorted(glob.glob(os.path.join(SRC, "*.csv"))):
        if os.path.abspath(path) == os.path.abspath(NEW_FILE):
            continue
        with open(path, encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                body = (row.get("body") or "").strip()
                sender = (row.get("address") or row.get("sender_id") or "").strip()
                if body:
                    old_pairs.add((sender.lower(), body))

    new_pairs = set()
    with open(NEW_FILE, encoding="utf-8-sig", newline="") as f:
        for row in csv.DictReader(f):
            body = (row.get("body") or "").strip()
            sender = (row.get("address") or row.get("sender_id") or "").strip()
            if body and (sender.lower(), body) not in old_pairs:
                new_pairs.add((sender.lower(), body))
    return new_pairs


def main() -> None:
    new_pairs = load_new_pairs()

    with open(os.path.join(AUDIT, "bantai_labeled_full.csv"), encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    seen: set[str] = set()
    picked = []
    for r in rows:
        key = (r.get("sender", "").strip().lower(), r.get("text", "").strip())
        if key not in new_pairs:
            continue
        if r["text"] in seen:
            continue
        seen.add(r["text"])
        if r["confidence"] != "low":
            continue
        picked.append(r)

    out = os.path.join(AUDIT, "review_sheet_new_batch.csv")
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for i, r in enumerate(picked, 1):
            w.writerow(
                {
                    "id": f"new-{i:03d}",
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
        f"New-batch review sheet: {len(picked)} rows (full population, low-conf only) -> "
        f"{os.path.relpath(out, DATASETS)}"
    )
    print("-" * 68)
    for k, n in Counter(f"{r['reason']}" for r in picked).most_common():
        print(f"  {k:44} {n:3}")
    print("-" * 68)
    print(f"  labels: {Counter(r['label'] for r in picked)}")
    print("=" * 68)


if __name__ == "__main__":
    main()
