"""Build a human-review sheet for the low-confidence rows in the 2026-08-26 batch.

Track B (AI/ML) -- review round 8.

2026-08-26: 9 new phone-inbox export files folded into the pool (2026-07-25
through 2026-08-01), contributing 6,996 genuinely new unique messages. Most
landed high/medium confidence via the existing rules. This is the full
population of that new batch's low-confidence rows only -- the rules admitted
doubt, so a human should look. Same shape as round 5's
``make_new_batch_review_sheet.py``, but "new" is computed against a labeled-
dataset backup (``bantai_labeled.pre-2026-08-26-raw-batch.csv``) rather than a
single raw file, since this round's new data spans nine files at once.

Run:  cd ai && python scripts/make_new_batch_review_sheet_2026-08-26.py
Out:  datasets/audit/review_sheet_2026-08-26.csv
"""

from __future__ import annotations

import csv
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.normpath(os.path.join(HERE, "..")))
DATASETS = os.environ.get("BANTAI_DATASETS", os.path.normpath(os.path.join(HERE, "..", "datasets")))
LABELED = os.path.join(DATASETS, "labeled")
AUDIT = os.path.join(os.environ.get("BANTAI_OUT_ROOT", DATASETS), "audit")
OLD_BACKUP = os.path.join(LABELED, "bantai_labeled.pre-2026-08-26-raw-batch.csv")

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


def main() -> None:
    from preprocessing import preprocess

    with open(OLD_BACKUP, encoding="utf-8") as f:
        old_masked = {preprocess(str(row["text"])) for row in csv.DictReader(f)}

    # needs_review.csv is the authoritative low-confidence list -- it already
    # reflects the FINAL training file's dedup (build_dataset.py prefers a
    # higher-confidence duplicate when the same text appears more than once).
    # Re-deriving from bantai_labeled_full.csv's raw occurrences instead would
    # include rows that got superseded by a high-confidence duplicate and so
    # never actually landed as low-confidence in what the model trained on.
    with open(os.path.join(AUDIT, "needs_review.csv"), encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    seen: set[str] = set()
    picked = []
    for r in rows:
        text = r["text"]
        masked = preprocess(str(text))
        if masked not in old_masked and masked not in seen:
            seen.add(masked)
            picked.append(r)

    out_path = os.path.join(AUDIT, "review_sheet_2026-08-26.csv")
    with open(out_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for i, r in enumerate(picked, 1):
            w.writerow(
                {
                    "id": i,
                    "verdict": "",
                    "correct_label": "",
                    "notes": "",
                    "text": r["text"],
                    "rule_label": r["label"],
                    "confidence": r["confidence"],
                    "reason": r["reason"],
                    "language": r.get("language", ""),
                    "source": r["source"],
                    "source_label": r.get("source_label", ""),
                    "sender": r.get("sender", ""),
                }
            )

    print(f"Wrote {len(picked)} low-confidence new-batch rows -> {out_path}")


if __name__ == "__main__":
    main()
