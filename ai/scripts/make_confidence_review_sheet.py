"""Build a human-review sheet for HIGH and MEDIUM confidence rows.

Sprint 2 Track B (AI/ML) -- review round 4.

Rounds 1-3 all sampled from low-confidence rows and rule overrides, i.e. the
places the rules already admitted doubt. That leaves a blind spot: **86% of the
dataset is high- or medium-confidence and has never been looked at.** If one of
those rules is systematically wrong it silently mislabels thousands of rows,
and no previous round could have detected it -- exactly the failure mode found
in round 3, but on a much larger blast radius.

This samples proportionally across the rules that actually carry the dataset,
capped per rule so one big rule cannot crowd out the rest.

Run:  cd ai && python scripts/make_confidence_review_sheet.py
Out:  datasets/audit/review_sheet_confidence.csv
"""

from __future__ import annotations

import csv
import os
import random
import sys
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATASETS = os.environ.get(
    "BANTAI_DATASETS", os.path.normpath(os.path.join(HERE, "..", "datasets"))
)
AUDIT = os.path.join(os.environ.get("BANTAI_OUT_ROOT", DATASETS), "audit")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

SEED = 20260729          # distinct from rounds 1-3 (20260727 / 20260729-trusted)
PER_RULE_CAP = 12        # no single rule dominates the sheet
TARGET = 140

FIELDS = [
    "id", "verdict", "correct_label", "notes",
    "text", "rule_label", "confidence", "reason", "language",
    "source", "source_label", "sender",
]

# Sheets whose rows are already reviewed -- never ask twice.
PRIOR = ["review_sheet.csv", "review_sheet_trusted.csv",
         "review_sheet_promo_link.csv"]


def main() -> None:
    with open(os.path.join(AUDIT, "bantai_labeled_full.csv"),
              encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    already = set()
    for sheet in PRIOR:
        p = os.path.join(AUDIT, sheet)
        if not os.path.exists(p):
            continue
        with open(p, encoding="utf-8-sig", newline="") as f:
            already |= {r["text"] for r in csv.DictReader(f)}

    # Deduplicate to the training view, keep only unreviewed high/medium rows.
    seen: set[str] = set()
    pool: dict[str, list] = defaultdict(list)
    for r in rows:
        if r["text"] in seen or r["text"] in already:
            continue
        seen.add(r["text"])
        if r["confidence"] not in ("high", "medium"):
            continue
        pool[f'{r["reason"]}|{r["confidence"]}'].append(r)

    rng = random.Random(SEED)
    total = sum(len(v) for v in pool.values())

    picked = []
    for key, group in sorted(pool.items(), key=lambda kv: -len(kv[1])):
        share = max(1, round(TARGET * len(group) / total))
        n = min(len(group), share, PER_RULE_CAP)
        picked.extend(rng.sample(group, n))
    rng.shuffle(picked)

    out = os.path.join(AUDIT, "review_sheet_confidence.csv")
    with open(out, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for i, r in enumerate(picked, 1):
            w.writerow({
                "id": f"conf-{i:03d}", "verdict": "", "correct_label": "",
                "notes": "", "text": r["text"], "rule_label": r["label"],
                "confidence": r["confidence"], "reason": r["reason"],
                "language": r.get("language", ""), "source": r.get("source", ""),
                "source_label": r.get("source_label", ""),
                "sender": r.get("sender", ""),
            })

    print("=" * 68)
    print(f"Confidence review sheet: {len(picked)} rows -> "
          f"{os.path.relpath(out, DATASETS)}")
    print(f"sampled from {total} unreviewed high/medium rows")
    print("-" * 68)
    for k, n in Counter(f'{r["reason"]} ({r["confidence"]})'
                        for r in picked).most_common():
        print(f"  {k:44} {n:3}")
    print("-" * 68)
    print(f"  labels: {Counter(r['label'] for r in picked)}")
    print("=" * 68)


if __name__ == "__main__":
    main()
