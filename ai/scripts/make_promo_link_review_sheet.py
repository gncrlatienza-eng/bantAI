"""Build a human-review sheet for the brand-new 'promo-unverified-link' rule.

Sprint 2 Track B (AI/ML) -- follow-up to make_review_sheet.py /
make_trusted_review_sheet.py.

``build_dataset.py`` (2026-07-28) added a rule: promotional language + a link
that isn't on the official whitelist, from a sender we don't recognize as a
brand, now labels Spam (low confidence) instead of falling through to the Ham
default. It was verified against exactly one hand-picked example ("LOT FOR
SALE... facebook.com/..."). Since this rule is new and about to shape training
data at scale, review ALL of it (not a sample -- there are only ~91 rows)
before the next retrain.

Run:  cd ai && python scripts/make_promo_link_review_sheet.py
Out:  datasets/audit/review_sheet_promo_link.csv
"""

from __future__ import annotations

import csv
import os
import sys

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
    "language",
    "confidence",
    "reason",
    "source",
    "source_label",
    "sender",
]


def main() -> None:
    path = os.path.join(AUDIT, "needs_review.csv")
    with open(path, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))

    seen, picked = set(), []
    for r in rows:
        if r["reason"] != "promo-unverified-link":
            continue
        if r["text"] in seen:
            continue
        seen.add(r["text"])
        picked.append(r)

    out_path = os.path.join(AUDIT, "review_sheet_promo_link.csv")
    with open(out_path, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS, extrasaction="ignore")
        w.writeheader()
        for i, r in enumerate(picked, start=1):
            w.writerow(
                {
                    "id": f"promo-{i:03d}",
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
    print(
        f"Promo-link review sheet: {len(picked)} rows (ALL of them, no "
        f"sampling) -> {os.path.relpath(out_path, DATASETS)}"
    )
    print("-" * 60)
    print("Every row here is currently labeled Spam by the brand-new rule.")
    print("Checking whether that's right is the point of this sheet.")
    print("-" * 60)
    print("Fill in: verdict (AGREE/DISAGREE), correct_label (if DISAGREE), notes")
    print("=" * 60)


if __name__ == "__main__":
    main()
