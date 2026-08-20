"""False Positive / False Negative confusion matrix on the held-out test set
(Sprint 6, WBS 6.4.6).

Scores a trained checkpoint against ``datasets/holdout/holdout.csv`` -- the
rows ``scripts/create_holdout_set.py`` permanently removed from the training
pool. Produces the same shape of confusion matrix already published in
``docs/development/AI_MODEL_RESULTS.md`` (rows = actual, columns =
predicted), plus the per-class false-positive/false-negative breakdown the
WBS item names explicitly and the two worst-case safety numbers
(``evaluate_buckets.py`` and ``evaluate_dataset.py`` already report these for
the bucket-routing layer; this is the same framing one layer down, at the
raw label).

**Reads the holdout manifest's own warning and prints it every run**, rather
than trying to guess whether the checkpoint being graded predates the split
-- this script has no way to know that about an arbitrary ``--model-dir``,
and a warning that only shows up when "needed" is a warning that eventually
stops showing up when it actually is needed. See ``PIPELINE.md`` §
"Permanent held-out test set" for the full reasoning: this holdout set is
only a fair test for a model trained after 2026-08-18.

Output is a single JSON file under ``evaluation/`` -- counts and metrics
only, matching every other file already there (``retraining_run_*.json``,
``match_threshold_calibration.json``): never the message text itself, which
is why the holdout CSV stays git-ignored while this output does not.

Run:
    cd ai && .venv/Scripts/python.exe scripts/evaluate_holdout.py
        Scores models/xlm-roberta-smishing (the deployed checkpoint) --
        remember the caveat above before quoting this number anywhere.

    cd ai && .venv/Scripts/python.exe scripts/evaluate_holdout.py --model-dir models/retraining_runs/<run>/candidate
        Scores a specific retraining candidate instead.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, ".")

from preprocessing import preprocess  # noqa: E402
from retraining.pipeline import _predict  # noqa: E402
from training.config import ID2LABEL, LABEL2ID  # noqa: E402

HOLDOUT_CSV = "datasets/holdout/holdout.csv"
HOLDOUT_MANIFEST = "datasets/holdout/manifest.json"
DEFAULT_MODEL_DIR = "models/xlm-roberta-smishing"
DEFAULT_OUTPUT_DIR = "evaluation"

LABELS = ["Ham", "Spam", "Scam"]


def load_holdout(path: str) -> tuple:
    if not os.path.isfile(path):
        sys.exit(
            f"error: no holdout set at '{path}'. Run scripts/create_holdout_set.py first "
            "(see PIPELINE.md 'Permanent held-out test set')."
        )
    with open(path, newline="", encoding="utf-8") as handle:
        rows = list(csv.DictReader(handle))
    if not rows:
        sys.exit(f"error: '{path}' has no rows.")
    bad = {r["label"] for r in rows} - set(LABEL2ID)
    if bad:
        sys.exit(f"error: unrecognised label(s) {bad} in '{path}'; expected one of {sorted(LABEL2ID)}.")
    texts = [preprocess(r["text"]) for r in rows]
    labels = [LABEL2ID[r["label"]] for r in rows]
    return texts, labels


def confusion_matrix(y_true: list, y_pred: list) -> dict:
    """{actual_label: {predicted_label: count}} over the fixed Ham/Spam/Scam order."""
    matrix = {a: {p: 0 for p in LABELS} for a in LABELS}
    for t, p in zip(y_true, y_pred):
        matrix[ID2LABEL[t]][ID2LABEL[p]] += 1
    return matrix


def per_class_metrics(matrix: dict) -> dict:
    """Precision/recall/F1 plus explicit FP/FN counts, one-vs-rest per class.

    Computed directly off the matrix rather than via a library call -- the
    matrix is already the ground truth for this, and a hand-rolled version
    that agrees with it row-by-row is easier to trust than an opaque one.
    """
    out = {}
    for label in LABELS:
        tp = matrix[label][label]
        fn = sum(matrix[label][p] for p in LABELS if p != label)
        fp = sum(matrix[a][label] for a in LABELS if a != label)
        support = tp + fn
        precision = tp / (tp + fp) if (tp + fp) else 0.0
        recall = tp / (tp + fn) if (tp + fn) else 0.0
        f1 = 2 * precision * recall / (precision + recall) if (precision + recall) else 0.0
        out[label] = {
            "support": support,
            "true_positives": tp,
            "false_positives": fp,
            "false_negatives": fn,
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
        }
    return out


def print_report(matrix: dict, metrics: dict, n_total: int) -> None:
    print("\nConfusion matrix (rows = actual, columns = predicted):\n")
    print("  " + "".join(f"{p:>8}" for p in [""] + LABELS))
    for actual in LABELS:
        print(f"  {actual:<8}" + "".join(f"{matrix[actual][p]:>8}" for p in LABELS))

    print("\nPer-class metrics:\n")
    print(f"  {'':6}{'support':>9}{'precision':>11}{'recall':>9}{'f1':>8}{'FP':>6}{'FN':>6}")
    for label in LABELS:
        m = metrics[label]
        print(
            f"  {label:<6}{m['support']:>9}{m['precision']:>11.4f}{m['recall']:>9.4f}"
            f"{m['f1']:>8.4f}{m['false_positives']:>6}{m['false_negatives']:>6}"
        )

    macro_f1 = sum(metrics[label]["f1"] for label in LABELS) / len(LABELS)
    print(f"\nMacro-F1: {macro_f1:.4f}  (n = {n_total})")

    # The two safety-critical numbers, same framing as evaluate_buckets.py /
    # evaluate_dataset.py: a missed Scam is the worst-case outcome (defrauds
    # a user); a Ham wrongly called Scam specifically is the worst-case false
    # alarm -- that one has to come from the matrix cell directly, since
    # Ham's one-vs-rest false-positive count above mixes together "called
    # Scam" and "called Spam", and only one of those two is the alarming one.
    scam_missed = metrics["Scam"]["false_negatives"]
    scam_support = metrics["Scam"]["support"]
    ham_flagged_scam = matrix["Ham"]["Scam"]
    ham_support = metrics["Ham"]["support"]
    print(
        f"\nReal Scam messages the model missed (predicted Ham/Spam): "
        f"{scam_missed}/{scam_support} ({100 * scam_missed / scam_support:.2f}%)"
    )
    print(
        f"Real Ham messages wrongly flagged as Scam: "
        f"{ham_flagged_scam}/{ham_support} ({100 * ham_flagged_scam / ham_support:.2f}%)"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", default=DEFAULT_MODEL_DIR, help="Checkpoint to grade (default: %(default)s).")
    parser.add_argument("--holdout-csv", default=HOLDOUT_CSV, help="Default: %(default)s.")
    parser.add_argument(
        "--output-dir", default=DEFAULT_OUTPUT_DIR, help="Where to write the results JSON (default: %(default)s)."
    )
    args = parser.parse_args()

    if not os.path.isfile(os.path.join(args.model_dir, "config.json")):
        sys.exit(f"error: no checkpoint at '{args.model_dir}' (no config.json found).")

    if os.path.isfile(HOLDOUT_MANIFEST):
        with open(HOLDOUT_MANIFEST, encoding="utf-8") as handle:
            manifest = json.load(handle)
        print("=" * 78)
        print("HOLDOUT SET WARNING (from datasets/holdout/manifest.json):")
        print(manifest.get("warning", ""))
        print("=" * 78)

    texts, labels = load_holdout(args.holdout_csv)
    print(f"\nScoring {args.model_dir} against {len(texts)} held-out rows...")
    predictions = _predict(args.model_dir, texts)

    matrix = confusion_matrix(labels, predictions)
    metrics = per_class_metrics(matrix)
    print_report(matrix, metrics, len(texts))

    os.makedirs(args.output_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    out_path = os.path.join(args.output_dir, f"holdout_confusion_{stamp}.json")
    payload = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "model_dir": args.model_dir,
        "holdout_csv": args.holdout_csv,
        "n_total": len(texts),
        "confusion_matrix": matrix,
        "per_class_metrics": metrics,
        "macro_f1": round(sum(metrics[label]["f1"] for label in LABELS) / len(LABELS), 4),
    }
    with open(out_path, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
    print(f"\nWrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
