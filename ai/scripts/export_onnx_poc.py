"""On-device feasibility spike (2026-09-16) -- NOT a pipeline script yet.

Exports a checkpoint to ONNX, quantizes it to int8 (dynamic), and reports (a)
size, (b) output parity against the original PyTorch model on a handful of
hand-picked examples, (c) rough CPU latency. This is "does the export path
work and roughly how big/fast is it" -- not accuracy validation. That needs
the real holdout set with true labels (see evaluate_holdout.py for the
pattern); this script deliberately doesn't attempt it.

Needs onnx, onnxruntime, onnxscript -- none are in requirements.txt yet
(deliberate: no point putting three deps through CI for a spike). Install
into the venv first:

    .venv/Scripts/python.exe -m pip install onnx onnxruntime onnxscript

Run from ai/:

    .venv/Scripts/python.exe scripts/export_onnx_poc.py
        Exports models/xlm-roberta-smishing (the deployed checkpoint).
        Confirm it's actually the checkpoint you mean to export first --
        Get-FileHash model.safetensors -Algorithm SHA256 against version.json
        or ModelVersion in the DB before trusting a --model-dir blindly.

    .venv/Scripts/python.exe scripts/export_onnx_poc.py --model-dir models/some-other-checkpoint --output-dir models/onnx_export
"""

from __future__ import annotations

import argparse
import os
import sys
import time

import numpy as np
import onnxruntime as ort
import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

DEFAULT_MODEL_DIR = "models/xlm-roberta-smishing"
DEFAULT_OUTPUT_DIR = "models/onnx_export"
MAX_LENGTH = 128

SAMPLE_MESSAGES = [
    "Congratulations! You have won a prize. Click here to claim now: bit.ly/abc123",
    "Your GCash OTP is 123456. Do not share this with anyone.",
    "Hi mom, I'll be home late tonight, don't wait up for dinner.",
]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model-dir", default=DEFAULT_MODEL_DIR)
    parser.add_argument("--output-dir", default=DEFAULT_OUTPUT_DIR)
    args = parser.parse_args()

    os.makedirs(args.output_dir, exist_ok=True)
    onnx_fp32 = os.path.join(args.output_dir, "model_fp32.onnx")
    onnx_int8 = os.path.join(args.output_dir, "model_int8.onnx")

    print(f"Loading checkpoint from {args.model_dir}")
    if not os.path.isdir(args.model_dir):
        sys.exit(f"error: model dir not found at {args.model_dir}")

    tokenizer = AutoTokenizer.from_pretrained(args.model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(args.model_dir)
    model.eval()
    print(f"Model class: {type(model).__name__}, labels: {model.config.id2label}")

    # Fixed shape for the trace; dynamic_axes below still allows variable
    # batch/sequence length at inference time.
    sample = tokenizer(
        SAMPLE_MESSAGES[0], return_tensors="pt", padding="max_length", truncation=True, max_length=MAX_LENGTH
    )

    print(f"\nExporting to {onnx_fp32} ...")
    t0 = time.time()
    torch.onnx.export(
        model,
        (sample["input_ids"], sample["attention_mask"]),
        onnx_fp32,
        input_names=["input_ids", "attention_mask"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch", 1: "seq"},
            "attention_mask": {0: "batch", 1: "seq"},
            "logits": {0: "batch"},
        },
        opset_version=17,
        # torch 2.9+'s default dynamo-based exporter chokes on a Windows
        # console's cp1252 stdout (tries to print a unicode checkmark) --
        # dynamo=False uses the older, still-supported TorchScript exporter
        # and sidesteps it entirely.
        dynamo=False,
    )
    print(f"Export took {time.time() - t0:.1f}s")

    fp32_size_mb = os.path.getsize(onnx_fp32) / (1024 * 1024)
    print(f"fp32 ONNX size: {fp32_size_mb:.1f} MB")

    print("\nQuantizing to int8 (dynamic) ...")
    from onnxruntime.quantization import QuantType, quantize_dynamic

    quantize_dynamic(onnx_fp32, onnx_int8, weight_type=QuantType.QInt8)
    int8_size_mb = os.path.getsize(onnx_int8) / (1024 * 1024)
    print(f"int8 ONNX size: {int8_size_mb:.1f} MB  ({fp32_size_mb / int8_size_mb:.1f}x smaller)")

    # --- Parity + rough latency check across both ONNX variants vs PyTorch ---
    # Sanity check only -- 3 examples says nothing about accuracy. Compare
    # against the real holdout set with true labels for that.
    print("\n--- Parity + rough CPU latency (whatever machine this runs on) ---")
    torch_logits = {}
    with torch.no_grad():
        for msg in SAMPLE_MESSAGES:
            enc = tokenizer(msg, return_tensors="pt", padding="max_length", truncation=True, max_length=MAX_LENGTH)
            torch_logits[msg] = model(**enc).logits.numpy()

    for label, path in (("fp32", onnx_fp32), ("int8", onnx_int8)):
        session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        max_abs_diff = 0.0
        label_mismatches = 0
        for msg in SAMPLE_MESSAGES:
            enc = tokenizer(msg, return_tensors="np", padding="max_length", truncation=True, max_length=MAX_LENGTH)
            feed = {"input_ids": enc["input_ids"], "attention_mask": enc["attention_mask"]}
            onnx_logits = session.run(None, feed)[0]
            max_abs_diff = max(max_abs_diff, float(np.abs(onnx_logits - torch_logits[msg]).max()))
            if onnx_logits.argmax() != torch_logits[msg].argmax():
                label_mismatches += 1

        # Warm run + repeated timed runs for a less noisy latency figure.
        enc = tokenizer(SAMPLE_MESSAGES[0], return_tensors="np", padding="max_length", truncation=True, max_length=MAX_LENGTH)
        feed = {"input_ids": enc["input_ids"], "attention_mask": enc["attention_mask"]}
        for _ in range(5):
            session.run(None, feed)
        timed = []
        for _ in range(30):
            t0 = time.perf_counter()
            session.run(None, feed)
            timed.append((time.perf_counter() - t0) * 1000)

        print(
            f"{label}: max logit diff vs PyTorch = {max_abs_diff:.5f}, "
            f"label mismatches = {label_mismatches}/{len(SAMPLE_MESSAGES)}, "
            f"mean latency over 30 runs = {sum(timed) / len(timed):.2f} ms "
            f"(min {min(timed):.2f} / max {max(timed):.2f})"
        )

    print(f"\nDone. fp32: {onnx_fp32} ({fp32_size_mb:.1f} MB) | int8: {onnx_int8} ({int8_size_mb:.1f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
