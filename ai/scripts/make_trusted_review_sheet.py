"""Build a human-review sheet for the TRUSTED corpus specifically.

Sprint 2 Track B (AI/ML) — follow-up to ``make_review_sheet.py``.

The first review round sampled the two UNVERIFIED corpora (SPAM_SMS,
tagalog-sms) plus a general low-confidence pool. It never touched
``kaggle:text-messages`` ("Philippine Spam/Scam SMS"), because that corpus is
marked ``trusted=True`` in ``build_dataset.py`` and its "scam" stamp is taken
at face value whenever a rule finds nothing to say otherwise.

Validation-set error analysis (2026-07-28) found several trusted-corpus rows
that read as plain legitimate messages (a FedEx delivery notice, a Spotify
promo blast) carrying a "Scam" label with zero scam content -- i.e. the
"trusted" corpus is not perfectly clean either. This script samples its
low-confidence rows (``source-label-unverified``, meaning no rule found
positive scam evidence) for the same AGREE/DISAGREE review as before.

Run:  cd ai && python scripts/make_trusted_review_sheet.py
Out:  datasets/audit/review_sheet_trusted.csv
"""

from __future__ import annotations

import csv
import os
import random
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATASETS = os.environ.get("BANTAI_DATASETS", os.path.normpath(os.path.join(HERE, "..", "datasets")))
AUDIT = os.path.join(os.environ.get("BANTAI_OUT_ROOT", DATASETS), "audit")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

# Different seed from the first sheet (20260727) -- this is a separate sample,
# not a re-shuffle of the same one.
SEED = 20260729
N_SAMPLE = 120

FIELDS = [
    "id",
    "verdict",
    "correct_label",
    "notes",
    "text",
    "rule_label",
    "language",
    "confidence",
    "reason",
    "source",
    "source_label",
    "sender",
]

TRUSTED_SOURCE = "kaggle:text-messages"


def _read(name):
    path = os.path.join(AUDIT, name)
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def main() -> None:
    full = _read("bantai_labeled_full.csv")
    trusted_low = [r for r in full if r["source"] == TRUSTED_SOURCE and r["confidence"] == "low"]

    # Don't re-serve rows already reviewed in the first pass -- same wasted
    # -effort concern as the dedupe in make_review_sheet.py.
    already_path = os.path.join(AUDIT, "review_sheet.csv")
    already_reviewed = set()
    if os.path.exists(already_path):
        with open(already_path, encoding="utf-8-sig", newline="") as f:
            already_reviewed = {r["text"] for r in csv.DictReader(f)}

    seen, pool = set(), []
    for r in trusted_low:
        if r["text"] in seen or r["text"] in already_reviewed:
            continue
        seen.add(r["text"])
        pool.append(r)

    rng = random.Random(SEED)
    rng.shuffle(pool)
    picked = pool[:N_SAMPLE]

    out_path = os.path.join(AUDIT, "review_sheet_trusted.csv")
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for i, r in enumerate(picked, start=1):
            w.writerow(
                {
                    "id": f"trusted-{i:03d}",
                    "verdict": "",
                    "correct_label": "",
                    "notes": "",
                    "text": r["text"],
                    "rule_label": r["label"],
                    "language": r.get("language", ""),
                    "confidence": r.get("confidence", ""),
                    "reason": r.get("reason", ""),
                    "source": r.get("source", ""),
                    "source_label": r.get("source_label", ""),
                    "sender": r.get("sender", ""),
                }
            )

    print("=" * 60)
    print(f"Trusted-corpus review sheet: {len(picked)} rows -> {os.path.relpath(out_path, DATASETS)}")
    print("-" * 60)
    print(f"Eligible pool (low-confidence, never reviewed): {len(pool)}")
    print("All rows are currently labeled Scam (that is the corpus's own")
    print("blanket stamp) with reason 'source-label-unverified' -- no rule")
    print("found positive scam evidence for any of them.")
    print("-" * 60)
    print("Fill in: verdict (AGREE/DISAGREE), correct_label (if DISAGREE), notes")
    print("=" * 60)


if __name__ == "__main__":
    main()
