"""Review sheet: Scam-labeled rows that look like real institutional messages.

Found 2026-09-16, while reviewing generated augmentation data: real messages
from a school (DLSL) and from telcos (DITO, Globe) are sitting in the pool
labeled **Scam**. Two consequences, and the second is worse than the first:

1. ``scripts/augment_scam_dataset.py`` seeds variants from Scam rows, so it
   was manufacturing synthetic "scams" out of genuine school announcements.
2. The model already trains on those rows. Whatever the augmentation does, a
   mislabeled legitimate message teaches the classifier that school and telco
   notices are fraud -- which shows up as false alarms on exactly the
   messages a user most wants delivered.

Keyword matching cannot resolve these on its own: a real scam impersonating
GCash mentions GCash too, so "mentions a brand" is not evidence either way.
Only a human can separate "real DITO promo" from "scam pretending to be
DITO", which is what this sheet is for.

Writes ``datasets/audit/review_sheet_institutional_2026-09-16.csv`` in the
format ``apply_review_corrections.py`` already discovers and applies (any
``review_sheet*.csv`` in that directory). Fill in ``verdict`` (AGREE /
DISAGREE) and, for DISAGREE, ``correct_label`` (Ham / Spam / Scam).

Run:
    cd ai && .venv/Scripts/python.exe scripts/make_institutional_scam_review_sheet.py
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys

sys.path.insert(0, ".")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

LABELED_CSV = "datasets/labeled/bantai_labeled.csv"
OUT_CSV = "datasets/audit/review_sheet_institutional_2026-09-16.csv"

#: Names and wording that belong to real institutions a Filipino user actually
#: hears from. A Scam-labeled row containing one is not necessarily wrong --
#: impersonation is the whole point of smishing -- it is merely worth a human
#: look, which is all this sheet claims.
SUSPECT = re.compile(
    r"\b("
    r"dlsl|la ?salle|"  # the school whose parent notices started this
    r"dito|globe|smart|tnt|tm|pldt|sun cellular|"  # telcos
    r"student|enrol|enrollment|tuition|campus|semester|parent|classes|exam|"  # school wording
    r"promo|unli|subscribe|load|gb|data allowance"  # ordinary promo wording
    r")\b",
    re.I,
)

#: Reviewer-facing note per match, so the sheet says *why* each row is here.
WHY = [
    (
        re.compile(r"\b(dlsl|la ?salle|student|enrol|tuition|campus|semester|parent|classes|exam)\b", re.I),
        "school/institutional wording",
    ),
    (re.compile(r"\b(dito|globe|smart|tnt|tm|pldt|sun cellular)\b", re.I), "telco name"),
    (re.compile(r"\b(promo|unli|subscribe|load|gb|data allowance)\b", re.I), "ordinary promo wording"),
]

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


def why(text: str) -> str:
    return "; ".join(label for pattern, label in WHY if pattern.search(text)) or "institutional wording"


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--labeled", default=LABELED_CSV)
    parser.add_argument("--out", default=OUT_CSV)
    parser.add_argument(
        "--source",
        default=None,
        help="Only rows from this source (e.g. raw-inbox -- messages from a real phone, the likeliest mislabels).",
    )
    args = parser.parse_args(argv)

    with open(args.labeled, encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    suspects = [
        r
        for r in rows
        if r.get("label") == "Scam"
        and SUSPECT.search(r.get("text", ""))
        and (args.source is None or r.get("source") == args.source)
    ]
    # Phone-inbox rows first: those are messages this project's own user
    # actually received, so a mislabel there is both likelier and more costly.
    suspects.sort(key=lambda r: (r.get("source") != "raw-inbox", r.get("source", "")))

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for i, row in enumerate(suspects, start=1):
            writer.writerow(
                {
                    "id": f"INST-{i:04d}",
                    "verdict": "",
                    "correct_label": "",
                    "notes": "",
                    "text": row.get("text", ""),
                    "rule_label": "Scam",
                    "confidence": "",
                    "reason": why(row.get("text", "")),
                    "language": row.get("language", ""),
                    "source": row.get("source", ""),
                    "source_label": "",
                    "sender": row.get("sender", ""),
                }
            )

    by_source: dict = {}
    for row in suspects:
        by_source[row.get("source", "?")] = by_source.get(row.get("source", "?"), 0) + 1
    print(f"Wrote {args.out} -- {len(suspects)} Scam rows to review")
    for source, n in sorted(by_source.items(), key=lambda kv: -kv[1]):
        print(f"  {source:22}{n:>5}")
    print(
        "\nFill in verdict (AGREE/DISAGREE) and correct_label for the DISAGREEs, then:\n"
        "  .venv/Scripts/python.exe scripts/apply_review_corrections.py"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
