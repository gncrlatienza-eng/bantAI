"""Build a human-review sheet for the labeled dataset.

Sprint 2 Track B (AI/ML) — supports WBS 2.3.4. The rule-based labeler in
``build_dataset.py`` marks every row with a confidence and a reason; this script
pulls the rows whose label is a *judgement call* into one spreadsheet so a human
can confirm or overturn each one against ``datasets/LABEL_DEFINITIONS.md``.

Two populations are sampled, because they carry different risks:

  * ``override``  — every row where the rules overturned the corpus's own label
                    (e.g. a Kaggle row stamped ``scam`` that is really marketing).
                    ALL of these are included: they are the changes that most
                    need a human signature before they go into training.
  * ``low``       — a stratified random sample of low-confidence rows, split
                    between ``source-label-unverified`` (possible Ham/Spam still
                    sitting in the Scam class) and ``unclassified-review``
                    (possible Scam still sitting in the Ham class).

The reviewer fills in three columns; everything left of them is read-only
context. ``verdict`` is the only required field.

  * ``verdict``       — AGREE / DISAGREE
  * ``correct_label`` — Ham | Spam | Scam   (only when DISAGREE)
  * ``notes``         — optional free text

Run:  cd ai && python scripts/make_review_sheet.py
Out:  datasets/audit/review_sheet.csv
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

# Fixed seed: re-running must not reshuffle a sheet someone is part-way through.
SEED = 20260727
N_LOW = 150

FIELDS = [
    "id", "verdict", "correct_label", "notes",
    "text", "rule_label", "language", "confidence", "reason",
    "source", "source_label", "sender",
]


def _read(name):
    path = os.path.join(AUDIT, name)
    with open(path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def main() -> None:
    # Both audit files list every *occurrence*, so the same text can appear more
    # than once (the corpora overlap). Reviewing a duplicate twice is wasted
    # effort and can produce two conflicting verdicts, so collapse on text.
    def _dedupe(rows):
        seen, out = set(), []
        for r in rows:
            if r["text"] not in seen:
                seen.add(r["text"])
                out.append(r)
        return out

    changes = _dedupe(_read("label_changes.csv"))
    review = _dedupe(_read("needs_review.csv"))

    # De-dupe the low-confidence pool against the overrides (a row can be both).
    changed_texts = {r["text"] for r in changes}
    pool = [r for r in review if r["text"] not in changed_texts]

    # Stratify the low-confidence sample by reason so neither risk dominates.
    by_reason = defaultdict(list)
    for r in pool:
        by_reason[r["reason"]].append(r)

    rng = random.Random(SEED)
    picked = []
    reasons = sorted(by_reason)
    per = max(1, N_LOW // max(1, len(reasons)))
    for reason in reasons:
        rows = by_reason[reason]
        rng.shuffle(rows)
        picked.extend(rows[:per])
    # Top up to N_LOW if a stratum was too small to fill its quota.
    if len(picked) < N_LOW:
        rest = [r for r in pool if r not in picked]
        rng.shuffle(rest)
        picked.extend(rest[: N_LOW - len(picked)])

    rows = [("override", r) for r in changes] + [("low", r) for r in picked]

    out_path = os.path.join(AUDIT, "review_sheet.csv")
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for i, (group, r) in enumerate(rows, start=1):
            w.writerow({
                "id": f"{group}-{i:03d}",
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
            })

    groups = Counter(g for g, _ in rows)
    labels = Counter(r["label"] for _, r in rows)
    print("=" * 60)
    print(f"Review sheet: {len(rows)} rows -> {os.path.relpath(out_path, DATASETS)}")
    print("-" * 60)
    print(f"  overrides (rules overturned the corpus): {groups['override']}")
    print(f"  low-confidence sample:                   {groups['low']}")
    print("-" * 60)
    print("Rule label under review:")
    for k in ("Ham", "Spam", "Scam"):
        print(f"  {k:5s} {labels.get(k, 0):4d}")
    print("-" * 60)
    print("Fill in: verdict (AGREE/DISAGREE), correct_label (if DISAGREE), notes")
    print("=" * 60)


if __name__ == "__main__":
    main()
