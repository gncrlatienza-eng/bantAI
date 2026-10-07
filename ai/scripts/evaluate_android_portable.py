"""Compare the exact Android unpadded INT8 inference contract with FP32.

Reads the existing frozen holdout only. This reused set is a regression check,
not an independent final evaluation. Reports contain metrics/hashes, never SMS.
"""

from __future__ import annotations

import argparse
import ast
import csv
import gc
import json
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import onnxruntime as ort
from make_android_portable_model import sha256
from transformers import AutoTokenizer

CANONICAL_HOLDOUT_SHA256 = "31e811205619d7968ad8c02d63f3bcdce0aa0a1427ee142c5b18fe7e9003a755"
CANONICAL_FP32_SHA256 = "b402b28c8c9aa384e50068d25db86ae40287437e64942323829880901dd13253"
CANONICAL_CHECKPOINT_SHA256 = "85580ba9edae8ce4428ccbd09c4e80d2ba7a6aaf24c61b14c173b40ab4e8e69b"


def main() -> None:
    from preprocessing import preprocess

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--fp32", type=Path, required=True)
    parser.add_argument("--candidate", type=Path, required=True)
    parser.add_argument("--holdout", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    holdout_hash = sha256(args.holdout)
    if (
        holdout_hash != CANONICAL_HOLDOUT_SHA256
        or sha256(args.fp32) != CANONICAL_FP32_SHA256
        or sha256(args.checkpoint / "model.safetensors") != CANONICAL_CHECKPOINT_SHA256
    ):
        raise ValueError("Evaluation inputs differ from this Model C release's canonical artifacts")
    expected = json.loads(args.holdout.with_name("manifest.json").read_text(encoding="utf-8"))
    if holdout_hash != expected["holdout_csv_sha256"]:
        raise ValueError("Frozen holdout hash mismatch")
    with args.holdout.open(encoding="utf-8", newline="") as stream:
        rows = list(csv.DictReader(stream))
    labels = ["Ham", "Spam", "Scam"]
    truth = [labels.index(row["label"]) for row in rows]
    texts = [preprocess(row["text"]) for row in rows]
    tokenizer = AutoTokenizer.from_pretrained(args.checkpoint, local_files_only=True)
    inputs = [tokenizer(text, truncation=True, max_length=128)["input_ids"] for text in texts]
    # Reuse the repository's metric functions without importing its trainer.
    metric_source = Path(__file__).with_name("evaluate_holdout.py")
    tree = ast.parse(metric_source.read_text(encoding="utf-8"))
    functions = [
        node
        for node in tree.body
        if isinstance(node, ast.FunctionDef) and node.name in {"confusion_matrix", "per_class_metrics"}
    ]
    namespace = {"LABELS": labels, "ID2LABEL": dict(enumerate(labels))}
    exec(compile(ast.Module(body=functions, type_ignores=[]), str(metric_source), "exec"), namespace)
    results = {}
    predictions = {}
    for name, path, unpadded in [
        ("fp32_reference", args.fp32, True),
        ("portable_android_unpadded", args.candidate, True),
    ]:
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        options.inter_op_num_threads = 1
        session = ort.InferenceSession(str(path), options, providers=["CPUExecutionProvider"])
        outputs = []
        routed = {label: {route: 0 for route in ("safe", "spam", "high_risk_review", "review")} for label in labels}
        start = time.monotonic()
        batch_size = 1 if unpadded else 8
        for offset in range(0, len(inputs), batch_size):
            batch = inputs[offset : offset + batch_size]
            if unpadded:
                ids = np.array(batch, dtype=np.int64)
                attention = np.ones_like(ids)
            else:
                ids = np.array([values + [1] * (128 - len(values)) for values in batch], dtype=np.int64)
                attention = np.array(
                    [[1] * len(values) + [0] * (128 - len(values)) for values in batch], dtype=np.int64
                )
            logits = session.run(["logits"], {"input_ids": ids, "attention_mask": attention})[0]
            outputs.extend(int(value) for value in logits.argmax(axis=1))
            for batch_index, row_logits in enumerate(logits):
                probabilities = np.exp(row_logits - row_logits.max())
                probabilities /= probabilities.sum()
                order = np.argsort(-probabilities)
                winner = int(order[0])
                confident = (
                    probabilities[winner] >= (0.5, 0.6, 0.9)[winner]
                    and probabilities[winner] - probabilities[order[1]] >= 0.15
                )
                route = ("safe", "spam", "high_risk_review")[winner] if confident else "review"
                routed[labels[truth[offset + batch_index]]][route] += 1
            if offset % 100 == 0:
                print(f"{name}: {len(outputs)}/{len(inputs)} elapsed={time.monotonic() - start:.1f}s", flush=True)
        predictions[name] = outputs
        matrix = namespace["confusion_matrix"](truth, outputs)
        per_class = namespace["per_class_metrics"](matrix)
        results[name] = {
            "sha256": sha256(path),
            "confusion_matrix": matrix,
            "per_class": per_class,
            "macro_f1": round(sum(per_class[label]["f1"] for label in labels) / 3, 4),
            "scam_recall": per_class["Scam"]["recall"],
            "routed_by_true_label": routed,
            "elapsed_seconds": round(time.monotonic() - start, 2),
        }
        del session
        gc.collect()
        args.output.write_text(
            json.dumps({"status": "in_progress", "holdout_sha256": holdout_hash, "results": results}, indent=2) + "\n",
            encoding="utf-8",
        )
    baseline = results["fp32_reference"]
    gates = {}
    for name, result in results.items():
        if name == "fp32_reference":
            continue
        result["disagreements_vs_fp32"] = sum(a != b for a, b in zip(predictions[name], predictions["fp32_reference"]))
        gates[name] = (
            baseline["scam_recall"] - result["scam_recall"] <= 0.01
            and baseline["macro_f1"] - result["macro_f1"] <= 0.01
        )
    report = {
        "status": "complete",
        "evaluated_utc": datetime.now(timezone.utc).isoformat(),
        "holdout_sha256": holdout_hash,
        "holdout_rows": len(rows),
        "holdout_reused": True,
        "independent_final_evaluation": False,
        "max_length": 128,
        "onnxruntime_version": ort.__version__,
        "checkpoint_sha256": sha256(args.checkpoint / "model.safetensors"),
        "preprocessing_contract": "nfkc_whitespace_pii_v1",
        "gate_tolerance": 0.01,
        "within_gate": gates,
        "results": results,
    }
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    report["inference_contract"] = "batch_1_unpadded_int64_attention_ones_v1"
    report["evaluator_sha256"] = sha256(Path(__file__))
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"within_gate": gates, "results": results}, indent=2))


if __name__ == "__main__":
    main()
