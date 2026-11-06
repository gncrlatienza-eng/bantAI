"""Grade the ONNX exports against the frozen holdout set (on-device feasibility).

``scripts/export_onnx_poc.py`` checks that the export *runs* and compares it to
PyTorch on three hand-picked messages. Its own docstring says that is not
accuracy validation and points here. This is that validation: the same holdout
set, the same metrics, and the same integrity checks every promoted model is
graded with, run against the artifact that would actually ship on the phone.

Why this has to exist before any on-device work starts: dynamic int8
quantization rewrites the weights. The label can change even when the export is
"correct", and the number the thesis defends has to be measured on the thing
that ships, not on the PyTorch model it came from. A 4x smaller model that
misses more scams is not a win.

Reports all three side by side (PyTorch / ONNX fp32 / ONNX int8) with fp32 as
the control: fp32 should be numerically identical to PyTorch, so any gap there
is an export bug, while a gap that appears only at int8 is the quantization
cost. Separating those two is the whole point of grading both.

Run:
    cd ai && .venv/Scripts/python.exe scripts/evaluate_onnx_holdout.py

Needs onnx/onnxruntime (not in requirements.txt -- see export_onnx_poc.py).
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import os
import sys
from datetime import datetime, timezone

sys.path.insert(0, ".")

import onnxruntime as ort  # noqa: E402
from transformers import AutoTokenizer  # noqa: E402

from retraining.checksum import verify_against_manifest  # noqa: E402
from retraining.pipeline import _predict  # noqa: E402
from retraining.promotion import SCAM_RECALL_TOLERANCE  # noqa: E402
from retraining.version_file import verify_version  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))

# Imported by path rather than ``from evaluate_holdout import ...`` so the
# metric code has exactly one definition. Re-deriving a confusion matrix here
# would risk this script and the promoted-model script disagreeing on what
# "recall" means, which is the one thing that must not happen between two
# numbers that get compared to each other.
_SPEC = importlib.util.spec_from_file_location("evaluate_holdout", os.path.join(HERE, "evaluate_holdout.py"))
_EH = importlib.util.module_from_spec(_SPEC)
sys.modules["evaluate_holdout"] = _EH
_SPEC.loader.exec_module(_EH)

MAX_LENGTH = 128
LABELS = _EH.LABELS
DEFAULT_MODEL_DIR = "models/xlm-roberta-smishing"
DEFAULT_ONNX_DIR = "models/onnx_export"


def onnx_predict(onnx_path: str, tokenizer, texts, batch_size: int = 32) -> list:
    """Label ids from an ONNX session, tokenized exactly as the export was traced.

    ``padding="max_length"`` with the same 128 the training config uses: a
    shorter pad would be a different input to the model than training saw, and
    the comparison against PyTorch would be measuring padding, not quantization.
    """
    session = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])
    out: list = []
    for i in range(0, len(texts), batch_size):
        enc = tokenizer(
            list(texts[i : i + batch_size]),
            return_tensors="np",
            padding="max_length",
            truncation=True,
            max_length=MAX_LENGTH,
        )
        logits = session.run(
            None,
            {"input_ids": enc["input_ids"], "attention_mask": enc["attention_mask"]},
        )[0]
        out.extend(int(x) for x in logits.argmax(axis=1))
        done = min(i + batch_size, len(texts))
        print(f"  {done}/{len(texts)}", end="\r", flush=True)
    print()
    return out


def grade(name: str, labels, preds) -> dict:
    matrix = _EH.confusion_matrix(labels, preds)
    metrics = _EH.per_class_metrics(matrix)
    macro_f1 = sum(metrics[c]["f1"] for c in LABELS) / len(LABELS)
    scam_missed = metrics["Scam"]["false_negatives"]
    scam_support = metrics["Scam"]["support"]
    ham_flagged = matrix["Ham"]["Scam"]
    ham_support = metrics["Ham"]["support"]
    return {
        "name": name,
        "confusion_matrix": matrix,
        "per_class": metrics,
        "macro_f1": round(macro_f1, 4),
        "scam_recall": metrics["Scam"]["recall"],
        "scam_missed": scam_missed,
        "scam_support": scam_support,
        "scam_miss_rate_pct": round(100 * scam_missed / scam_support, 2) if scam_support else 0.0,
        "ham_flagged_scam": ham_flagged,
        "ham_support": ham_support,
        "ham_false_alarm_pct": round(100 * ham_flagged / ham_support, 2) if ham_support else 0.0,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model-dir", default=DEFAULT_MODEL_DIR)
    parser.add_argument("--onnx-dir", default=DEFAULT_ONNX_DIR)
    parser.add_argument("--holdout-csv", default=_EH.HOLDOUT_CSV)
    parser.add_argument("--output-dir", default="evaluation")
    parser.add_argument("--allow-drift", action="store_true")
    args = parser.parse_args()

    fp32 = os.path.join(args.onnx_dir, "model_fp32.onnx")
    int8 = os.path.join(args.onnx_dir, "model_int8.onnx")
    for path in (fp32, int8):
        if not os.path.isfile(path):
            sys.exit(f"error: {path} not found. Run scripts/export_onnx_poc.py first.")

    # Same two integrity checks evaluate_holdout.py makes, for the same reason:
    # a score is only meaningful as a pair of *this* checkpoint and *this*
    # frozen set, and the ONNX files are derived from that same checkpoint.
    holdout_status, holdout_detail, holdout_digest = verify_against_manifest(
        args.holdout_csv, _EH.HOLDOUT_MANIFEST, "holdout_csv_sha256"
    )
    integrity = verify_version(args.model_dir)
    for label, status, detail in (
        ("HOLDOUT", holdout_status, holdout_detail),
        ("CHECKPOINT", integrity.status, integrity.detail),
    ):
        if status == "mismatch" and not args.allow_drift:
            sys.exit(f"error: {label} INTEGRITY -- {detail}. Refusing to grade (see --allow-drift).")
        print(f"{label}: {status} -- {detail}")

    texts, labels = _EH.load_holdout(args.holdout_csv)
    print(f"\nHoldout: {len(texts)} rows")

    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)

    print("\nPyTorch (the control) ...")
    torch_preds = _predict(args.model_dir, texts)
    print("ONNX fp32 ...")
    fp32_preds = onnx_predict(fp32, tokenizer, texts)
    print("ONNX int8 ...")
    int8_preds = onnx_predict(int8, tokenizer, texts)

    results = [
        grade("pytorch", labels, torch_preds),
        grade("onnx_fp32", labels, fp32_preds),
        grade("onnx_int8", labels, int8_preds),
    ]
    base = results[0]

    print("\n" + "=" * 78)
    print(f"{'variant':<12}{'macro-F1':>10}{'Scam recall':>13}{'Scam missed':>14}{'Ham->Scam':>11}{'disagree':>10}")
    for r, preds in zip(results, (torch_preds, fp32_preds, int8_preds)):
        disagree = sum(1 for a, b in zip(torch_preds, preds) if a != b)
        missed = f"{r['scam_missed']}/{r['scam_support']}"
        print(
            f"{r['name']:<12}{r['macro_f1']:>10.4f}{r['scam_recall']:>13.4f}"
            f"{missed:>14}{r['ham_flagged_scam']:>11}{disagree:>10}"
        )
    print("=" * 78)

    for r in results[1:]:
        d_f1 = r["macro_f1"] - base["macro_f1"]
        d_recall = r["scam_recall"] - base["scam_recall"]
        print(
            f"\n{r['name']} vs PyTorch: macro-F1 {d_f1:+.4f}, "
            f"Scam recall {d_recall:+.4f} ({d_recall * 100:+.2f}pp), "
            f"{r['scam_missed'] - base['scam_missed']:+d} scams missed"
        )

    # The gate's own tolerance, quoted so the verdict is not a fresh judgement
    # call: retraining/promotion.py refuses a candidate whose Scam recall falls
    # more than this below the incumbent. An on-device model is a replacement
    # classifier, so holding it to a laxer bar than a retrained one would be
    # inconsistent.
    int8_drop = base["scam_recall"] - results[2]["scam_recall"]
    verdict = "WITHIN" if int8_drop <= SCAM_RECALL_TOLERANCE else "EXCEEDS"
    print(
        f"\nint8 Scam-recall drop {int8_drop:.4f} {verdict} the promotion gate's "
        f"{SCAM_RECALL_TOLERANCE:.4f} tolerance (retraining/promotion.py)"
    )

    os.makedirs(args.output_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    out = os.path.join(args.output_dir, f"onnx_holdout_{stamp}.json")
    payload = {
        "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "model_dir": args.model_dir,
        "onnx_dir": args.onnx_dir,
        "holdout_csv_sha256": holdout_digest,
        "holdout_rows": len(texts),
        "max_length": MAX_LENGTH,
        "scam_recall_tolerance": SCAM_RECALL_TOLERANCE,
        "int8_scam_recall_drop": round(int8_drop, 4),
        "int8_within_gate_tolerance": bool(int8_drop <= SCAM_RECALL_TOLERANCE),
        "results": results,
        "disagreements_vs_pytorch": {
            "onnx_fp32": sum(1 for a, b in zip(torch_preds, fp32_preds) if a != b),
            "onnx_int8": sum(1 for a, b in zip(torch_preds, int8_preds) if a != b),
        },
        "onnx_file_sizes_mb": {
            "fp32": round(os.path.getsize(fp32) / (1024 * 1024), 1),
            "int8": round(os.path.getsize(int8) / (1024 * 1024), 1),
        },
    }
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)
    print(f"\nWrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
