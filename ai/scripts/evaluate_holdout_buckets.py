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

from evaluate_holdout import HOLDOUT_CSV, LABELS, confusion_matrix, load_holdout, per_class_metrics  # noqa: E402

from service.classifier import route  # noqa: E402
from service.config import settings  # noqa: E402
from training.config import ID2LABEL, TrainingConfig  # noqa: E402

DEFAULT_MODEL_DIR = "models/xlm-roberta-smishing"
BUCKETS = ["safe", "spam", "blocked", "unknown"]
EXPECTED = {"Ham": "safe", "Spam": "spam", "Scam": "blocked"}


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


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model-dir", default=DEFAULT_MODEL_DIR)
    parser.add_argument("--holdout-csv", default=HOLDOUT_CSV)
    parser.add_argument("--output-dir", default="evaluation")
    args = parser.parse_args()

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
        "buckets": report,
        "raw_argmax_confusion_matrix": raw_matrix,
        "raw_argmax_macro_f1": round(sum(raw_metrics[t]["f1"] for t in LABELS) / len(LABELS), 4),
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2, sort_keys=True)
    print(f"\nWrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
