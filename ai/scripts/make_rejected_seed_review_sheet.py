"""Review sheet: Scam rows whose *generated variants* a human rejected.

Closes the loop that `scripts/augment_scam_dataset.py` opens. Reviewing a
generated batch means marking rows that are not really scams; when such a row
is a **variant**, the judgement is really about the real message it was seeded
from. The generator already stops re-using that seed
(``rejected_seed_ids``), but that is a patch on the symptom: the mislabelled
row is still in the training data, still teaching the classifier that a
legitimate message is fraud.

This is how those seeds get fixed rather than merely skipped. It has now found
mislabels twice, both times by the same route:

- **2026-09-16** -- real DLSL school notices and DITO/Globe telco messages
  labelled Scam (handled by ``make_institutional_scam_review_sheet.py``).
- **2026-09-18** -- a batch review rejected 11 rows tracing to 5 seeds, every
  one a legitimate message: a GCash account-link confirmation, a Google refund
  receipt, a Maya savings promo, and a Globe GoSURF freebie. Three OTP
  ("your verification code") messages came from the round before.

**Why the variant's verdict is shown but not applied.** A variant is not its
seed. The generator adds urgency phrases and swaps wording, so a reviewer may
have been reacting to something the original does not say -- and the reverse
happened on 2026-09-18, where variants of an Atome credit-card advert were
marked Spam while the original was later judged Scam on a direct read. The
sheet therefore carries the earlier verdict as *context* and leaves `verdict`
blank. The reviewer looks at the real message and decides again.

Writes ``datasets/audit/review_sheet_rejected_seeds_<date>.csv`` in the format
``apply_review_corrections.py`` already discovers and applies (any
``review_sheet*.csv`` in that directory). Fill in ``verdict`` (AGREE /
DISAGREE) and, for DISAGREE, ``correct_label`` (Ham / Spam / Scam).

Run:
    cd ai && .venv/Scripts/python.exe scripts/make_rejected_seed_review_sheet.py
"""

from __future__ import annotations

import argparse
import csv
import glob
import hashlib
import os
import sys
from datetime import date

sys.path.insert(0, ".")

from preprocessing import preprocess  # noqa: E402

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))

LABELED_CSV = "datasets/labeled/bantai_labeled.csv"
AUGMENTED_DIR = "datasets/augmented"
AUDIT_DIR = "datasets/audit"

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


def _digest(text: str) -> str:
    """Seed fingerprint, matching ``augment_scam_dataset._digest``."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:12]


def rejections(augmented_dir: str) -> dict:
    """``{seed_id: [(verdict, variant_text), ...]}`` for rejected variants.

    A verdict counts only when it *disagrees* with the row's own label -- the
    column is used to confirm as well as to correct, and a 2026-09-18 review
    marked 485 of 514 rows "SCAM" meaning "yes, this is right".
    """
    out: dict = {}
    for path in glob.glob(os.path.join(augmented_dir, "*.csv")):
        try:
            with open(path, encoding="utf-8-sig", newline="") as handle:
                for row in csv.DictReader(handle):
                    verdict = (row.get("correct_label") or "").strip()
                    label = (row.get("label") or "Scam").strip()
                    seed = row.get("seed_id") or ""
                    if verdict and seed and verdict.casefold() != label.casefold():
                        out.setdefault(seed, []).append((verdict, (row.get("text") or "").strip()))
        except (OSError, csv.Error):
            continue
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--labeled", default=LABELED_CSV)
    parser.add_argument("--augmented-dir", default=AUGMENTED_DIR)
    parser.add_argument("--out", default=None)
    args = parser.parse_args(argv)

    out_path = args.out or os.path.join(AUDIT_DIR, f"review_sheet_rejected_seeds_{date.today().isoformat()}.csv")

    rejected = rejections(args.augmented_dir)
    if not rejected:
        print("No rejected variants found -- nothing to review.")
        return 0

    with open(args.labeled, encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    seeds = [r for r in rows if r.get("label") == "Scam" and _digest(preprocess(r.get("text", ""))) in rejected]

    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=FIELDS)
        writer.writeheader()
        for i, row in enumerate(seeds, start=1):
            verdicts = rejected[_digest(preprocess(row.get("text", "")))]
            said = ", ".join(sorted({v for v, _ in verdicts}))
            writer.writerow(
                {
                    "id": f"SEED-{i:04d}",
                    "verdict": "",
                    "correct_label": "",
                    "notes": "",
                    "text": row.get("text", ""),
                    "rule_label": "Scam",
                    "confidence": "",
                    "reason": (
                        f"{len(verdicts)} generated variant(s) of this message were reviewed and "
                        f"marked {said}, not Scam -- judge the real message above on its own terms"
                    ),
                    "language": row.get("language", ""),
                    "source": row.get("source", ""),
                    "source_label": "",
                    "sender": row.get("sender", ""),
                }
            )

    print(f"Wrote {out_path} -- {len(seeds)} row(s) to review")
    missing = len(rejected) - len(seeds)
    if missing > 0:
        print(
            f"  {missing} rejected seed(s) are no longer Scam rows in the dataset -- "
            "already corrected by an earlier round, or relabelled since."
        )
    print(
        "\nEach row is a REAL message currently labelled Scam. Its generated variants were\n"
        "rejected, which is why it is here -- but decide on the real message, not the variant.\n\n"
        "Fill in verdict (AGREE / DISAGREE) and, for DISAGREE, correct_label.\n"
        "Then run: .venv/Scripts/python.exe scripts/apply_review_corrections.py\n"
        "Save as CSV, not xlsx -- Excel mangles curly punctuation (Bug History section 5)."
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
