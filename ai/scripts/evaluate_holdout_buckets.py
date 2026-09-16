"""What users actually see: production routing applied to the frozen holdout.

``evaluate_holdout.py`` scores the raw label (argmax). The deployed service
then applies ``service.classifier.route`` (gap check + per-class thresholds),
which decides whether a message is shown as safe, hidden as spam, blocked, or
left in the inbox as unknown. This reports those buckets on the same frozen
holdout, so the numbers can't drift as ``datasets/labeled/`` changes.

    cd ai && .venv/Scripts/python.exe scripts/evaluate_holdout_buckets.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from typing import Dict, List, Sequence

sys.path.insert(0, ".")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from evaluate_holdout import (  # noqa: E402
    HOLDOUT_CSV,
    HOLDOUT_MANIFEST,
    LABELS,
    confusion_matrix,
    load_holdout,
    per_class_metrics,
)

from retraining.checksum import verify_against_manifest  # noqa: E402
from retraining.version_file import verify_version  # noqa: E402
from service.classifier import route  # noqa: E402
from service.config import settings  # noqa: E402
from training.config import ID2LABEL, TrainingConfig  # noqa: E402

DEFAULT_MODEL_DIR = "models/xlm-roberta-smishing"
BUCKETS = ["safe", "spam", "blocked", "unknown"]
EXPECTED = {"Ham": "safe", "Spam": "spam", "Scam": "blocked"}

# --- release limits on what users actually experience (audit item 12) --------
# The promotion gate compares a candidate against the incumbent on raw labels.
# Neither it nor the raw holdout score says anything about the two outcomes a
# user would actually be harmed by, both of which the committed evaluation
# artifacts already contain in non-zero quantities:
#
#   a real scam delivered looking safe      -- the harm this system exists to prevent
#   a legitimate message blocked outright   -- the harm that makes it unusable
#
# So they get named ceilings, checked explicitly, rather than being numbers
# someone notices in a JSON file afterwards. The values are round bars above
# current performance (measured 2026-09-12 on v2026-08-27T09-46-20Z: 3.41%
# scams shown safe, 0.17% legitimate blocked), chosen to catch a regression
# without failing on a row or two of noise -- 5% is ~25 of 498 holdout scams,
# 1% is ~18 of 1,785 holdout Hams.
#
# ⚠️ Proposed, not signed off. The manuscript sets no release criteria at all,
# and neither the adviser nor the panel has seen these. Treat a PASS as "did
# not trip the bar we set ourselves", not as an external standard met.
MAX_SCAM_SHOWN_AS_SAFE = 0.05
MAX_HAM_BLOCKED = 0.01


def predict_scores(model_dir: str, masked_texts: Sequence[str], batch_size: int = 32) -> List[Dict[str, float]]:
    """Softmax distribution per message, tokenized exactly like ``retraining.pipeline._predict``."""
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir)
    model.eval()
    max_length = TrainingConfig().max_length

    out: List[Dict[str, float]] = []
    with torch.no_grad():
        for start in range(0, len(masked_texts), batch_size):
            batch = list(masked_texts[start : start + batch_size])
            inputs = tokenizer(batch, truncation=True, max_length=max_length, padding=True, return_tensors="pt")
            probs = torch.softmax(model(**inputs).logits, dim=-1)
            out.extend({ID2LABEL[j]: float(row[j]) for j in range(len(row))} for row in probs)
    return out


def bucket_report(true_labels: Sequence[str], buckets: Sequence[str]) -> dict:
    """Cross-table of true label x bucket, per-class routing rates, and the two safety numbers."""
    cross = Counter(zip(true_labels, buckets))
    table = {t: {b: cross.get((t, b), 0) for b in BUCKETS} for t in LABELS}
    per_class = {}
    for t in LABELS:
        total = sum(table[t].values())
        correct = table[t][EXPECTED[t]]
        unknown = table[t]["unknown"]
        per_class[t] = {
            "total": total,
            "correct": correct,
            "unknown": unknown,
            "wrong_bucket": total - correct - unknown,
        }
    return {
        "table": table,
        "per_class": per_class,
        # A real scam shown as safe is the worst miss; a real message blocked is the worst false alarm.
        "scam_shown_as_safe": table["Scam"]["safe"],
        "ham_blocked": table["Ham"]["blocked"],
        "n_unknown": sum(table[t]["unknown"] for t in LABELS),
    }


def _pct(n: int, d: int) -> str:
    return f"{100 * n / d:.2f}%" if d else "n/a"


def release_gate(report: dict, max_scam_safe: float, max_ham_blocked: float) -> dict:
    """Check the two user-visible harms against their ceilings.

    Returns the verdict and both measured rates, so the JSON records what was
    checked rather than only whether it passed.
    """
    n_scam = report["per_class"]["Scam"]["total"]
    n_ham = report["per_class"]["Ham"]["total"]
    scam_rate = report["scam_shown_as_safe"] / n_scam if n_scam else 0.0
    ham_rate = report["ham_blocked"] / n_ham if n_ham else 0.0

    checks = [
        ("real scams shown as safe", scam_rate, max_scam_safe),
        ("legitimate messages blocked", ham_rate, max_ham_blocked),
    ]
    failures = [f"{name} {rate:.4f} exceeds {limit:.4f}" for name, rate, limit in checks if rate > limit]
    return {
        "passed": not failures,
        "failures": failures,
        "scam_shown_as_safe_rate": round(scam_rate, 4),
        "max_scam_shown_as_safe": max_scam_safe,
        "ham_blocked_rate": round(ham_rate, 4),
        "max_ham_blocked": max_ham_blocked,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model-dir", default=DEFAULT_MODEL_DIR)
    parser.add_argument("--holdout-csv", default=HOLDOUT_CSV)
    parser.add_argument("--output-dir", default="evaluation")
    parser.add_argument("--max-scam-safe", type=float, default=MAX_SCAM_SHOWN_AS_SAFE)
    parser.add_argument("--max-ham-blocked", type=float, default=MAX_HAM_BLOCKED)
    parser.add_argument(
        "--no-gate",
        action="store_true",
        help="Report the rates without failing on them (exploration, not a release check).",
    )
    parser.add_argument(
        "--allow-drift",
        action="store_true",
        help="Run even if the holdout file or checkpoint no longer matches its recorded digest.",
    )
    args = parser.parse_args()

    holdout_status, holdout_detail, holdout_digest = verify_against_manifest(
        args.holdout_csv, HOLDOUT_MANIFEST, "holdout_csv_sha256"
    )
    integrity = verify_version(args.model_dir)
    for label, status, detail in (
        ("HOLDOUT", holdout_status, holdout_detail),
        ("CHECKPOINT", integrity.status, integrity.detail),
    ):
        if status == "mismatch" and not args.allow_drift:
            sys.exit(f"error: {label} INTEGRITY -- {detail}.\nRefusing to grade; see --allow-drift.")
        print(f"{label} integrity: {status} -- {detail}")

    texts, label_ids = load_holdout(args.holdout_csv)
    true_labels = [ID2LABEL[i] for i in label_ids]
    thresholds = {
        "safe": settings.safe_threshold,
        "spam": settings.spam_threshold,
        "block": settings.block_threshold,
        "review_margin": settings.review_margin,
    }
    print(f"Scoring {args.model_dir} on {len(texts)} holdout rows with thresholds {thresholds}...")

    scores = predict_scores(args.model_dir, texts)
    buckets = [route(s) for s in scores]
    argmax_ids = [max(range(len(LABELS)), key=lambda j: s[ID2LABEL[j]]) for s in scores]
    raw_matrix = confusion_matrix(label_ids, argmax_ids)
    raw_metrics = per_class_metrics(raw_matrix)
    report = bucket_report(true_labels, buckets)

    print("\nTrue label x bucket:")
    print("  " + f"{'':6}" + "".join(f"{b:>10}" for b in BUCKETS))
    for t in LABELS:
        print(f"  {t:<6}" + "".join(f"{report['table'][t][b]:>10}" for b in BUCKETS))
    print("\nRouted correctly / left as unknown / wrong bucket:")
    for t in LABELS:
        c = report["per_class"][t]
        print(
            f"  {t:<6} {_pct(c['correct'], c['total']):>8} / {_pct(c['unknown'], c['total']):>7}"
            f" / {_pct(c['wrong_bucket'], c['total']):>7}"
        )
    n_scam = report["per_class"]["Scam"]["total"]
    n_ham = report["per_class"]["Ham"]["total"]
    print(
        f"\nReal scams shown as safe: {report['scam_shown_as_safe']}/{n_scam}"
        f" ({_pct(report['scam_shown_as_safe'], n_scam)})"
    )
    print(f"Real (Ham) messages blocked: {report['ham_blocked']}/{n_ham} ({_pct(report['ham_blocked'], n_ham)})")
    print(f"Left as unknown overall: {report['n_unknown']}/{len(texts)} ({_pct(report['n_unknown'], len(texts))})")

    gate = release_gate(report, args.max_scam_safe, args.max_ham_blocked)
    print(
        f"\nRelease gate: {'PASS' if gate['passed'] else 'FAIL'} "
        f"(scams shown safe {gate['scam_shown_as_safe_rate']:.4f} <= {gate['max_scam_shown_as_safe']}, "
        f"legitimate blocked {gate['ham_blocked_rate']:.4f} <= {gate['max_ham_blocked']})"
    )
    for failure in gate["failures"]:
        print(f"  FAIL  {failure}")

    version = None
    version_file = os.path.join(args.model_dir, "version.json")
    if os.path.isfile(version_file):
        with open(version_file, encoding="utf-8") as f:
            version = json.load(f).get("version_tag")

    os.makedirs(args.output_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    out_path = os.path.join(args.output_dir, f"holdout_buckets_{stamp}.json")
    payload = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(),
        "model_dir": args.model_dir,
        "model_version": version,
        "holdout_csv": args.holdout_csv,
        "n_total": len(texts),
        "thresholds": thresholds,
        "release_gate": gate,
        "holdout_sha256": holdout_digest,
        "holdout_integrity": holdout_status,
        "checkpoint_integrity": integrity.status,
        "buckets": report,
        "raw_argmax_confusion_matrix": raw_matrix,
        "raw_argmax_macro_f1": round(sum(raw_metrics[t]["f1"] for t in LABELS) / len(LABELS), 4),
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
    print(f"\nWrote {out_path}")
    # Non-zero on a failed gate so this can be used as a check, not just a
    # report -- the numbers are written either way, including on failure.
    return 0 if (gate["passed"] or args.no_gate) else 1


if __name__ == "__main__":
    raise SystemExit(main())
