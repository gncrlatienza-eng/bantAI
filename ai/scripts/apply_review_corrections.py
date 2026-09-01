"""Overlay completed human-review verdicts onto the rule-built dataset.

Sprint 2 Track B (AI/ML).

``build_dataset.py`` regenerates ``labeled/bantai_labeled.csv`` from the rules
alone. Human corrections live in the review sheets, so **every rebuild wipes
them** unless this script runs afterwards. Always run:

    python scripts/build_dataset.py
    python scripts/apply_review_corrections.py

Matching is exact-text first, then a printable-ASCII fallback: Excel silently
rewrites curly apostrophes and other non-ASCII characters when saving CSV, so a
handful of reviewed rows never match byte-for-byte. The fallback is only
accepted when it resolves to exactly one row, so an ambiguous match is reported
rather than guessed at.
"""

from __future__ import annotations

import csv
import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DATASETS = os.environ.get("BANTAI_DATASETS", os.path.normpath(os.path.join(HERE, "..", "datasets")))
AUDIT = os.path.join(os.environ.get("BANTAI_OUT_ROOT", DATASETS), "audit")
LABELED = os.path.join(DATASETS, "labeled", "bantai_labeled.csv")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))


def _discover_sheets(audit_dir: str) -> list[str]:
    """All review_sheet*.csv files in audit_dir, sorted for deterministic order.

    Was a hardcoded list -- new sheets (e.g. review_sheet_2026-08-26.csv) were
    silently skipped until someone remembered to add them here, the same class
    of bug apply_corrections() itself exists to prevent for build_dataset.py.
    """
    if not os.path.isdir(audit_dir):
        return []
    return sorted(f for f in os.listdir(audit_dir) if f.startswith("review_sheet") and f.endswith(".csv"))


CANON = {"HAM": "Ham", "SPAM": "Spam", "SCAM": "Scam"}


def norm(s: str) -> str:
    """Drop non-printable-ASCII so Excel-mangled rows still match."""
    return re.sub(r"[^\x20-\x7E]", "", s or "")


def apply_corrections(labeled_path: str = LABELED, audit_dir: str = AUDIT, quiet: bool = False) -> dict:
    """Overlay every DISAGREE-verdict review correction onto ``labeled_path`` in place.

    Callable, not just a CLI, so ``build_dataset.py`` can invoke this as the
    last step of every rebuild -- the failure mode this exists to close is
    exactly "somebody rebuilt and forgot to run this script by hand"
    (found 2026-08-26: a rebuild left 163 already-confirmed corrections
    silently missing from the training data for hours before it was caught).

    Returns the same counters the CLI prints, for a caller to assert on.
    """
    with open(labeled_path, encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        rows = list(reader)

    by_text = {r["text"]: r for r in rows}
    by_norm: dict[str, list] = {}
    for r in rows:
        by_norm.setdefault(norm(r["text"]), []).append(r)

    applied = already = unresolved = ambiguous = 0
    per_sheet: Counter = Counter()
    moves: Counter = Counter()

    sheets = _discover_sheets(audit_dir)
    for sheet in sheets:
        path = os.path.join(audit_dir, sheet)
        if not os.path.exists(path):
            if not quiet:
                print(f"  (skip, not found: {sheet})")
            continue
        with open(path, encoding="utf-8-sig", newline="") as f:
            entries = list(csv.DictReader(f))

        for e in entries:
            if not e.get("verdict", "").strip().upper().startswith("DIS"):
                continue
            want = CANON.get(e.get("correct_label", "").strip().upper())
            if not want:
                continue

            row = by_text.get(e["text"])
            if row is None:
                cands = by_norm.get(norm(e["text"]), [])
                if len(cands) == 1:
                    row = cands[0]
                elif len(cands) > 1:
                    ambiguous += 1
                    continue
            if row is None:
                unresolved += 1
                continue

            if row["label"] == want:
                already += 1
            else:
                moves[f"{row['label']} -> {want}"] += 1
                row["label"] = want
                applied += 1
                per_sheet[sheet] += 1

    with open(labeled_path, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)

    if not quiet:
        print("=" * 68)
        print("Review corrections overlaid onto bantai_labeled.csv")
        print("-" * 68)
        for sheet in sheets:
            if per_sheet.get(sheet):
                print(f"  {sheet:32} {per_sheet[sheet]:4} applied")
        print("-" * 68)
        for move, n in moves.most_common():
            print(f"  {move:20} {n:4}")
        print("-" * 68)
        print(f"  applied      {applied:5}   (label actually changed)")
        print(f"  already ok   {already:5}   (rules now agree -- no change needed)")
        print(f"  unresolved   {unresolved:5}   (reviewed text not in dataset)")
        print(f"  ambiguous    {ambiguous:5}   (matched >1 row, skipped)")
        print("-" * 68)
        print(f"  final: {Counter(r['label'] for r in rows)}  total {len(rows)}")
        print("=" * 68)

    return {
        "applied": applied,
        "already_ok": already,
        "unresolved": unresolved,
        "ambiguous": ambiguous,
        "moves": dict(moves),
        "final_counts": dict(Counter(r["label"] for r in rows)),
    }


def main() -> None:
    apply_corrections()


if __name__ == "__main__":
    main()
