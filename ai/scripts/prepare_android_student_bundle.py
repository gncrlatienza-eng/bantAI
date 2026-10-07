"""Validate an existing Model-C export and stage an operator-approved student bundle.

Never upgrades the source bundle's production approval or claims physical-device
validation. Fixtures are synthetic; no dataset records are copied into the app.
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

from preprocessing import preprocess
from scripts.build_mobile_bundle import FIXTURES, sha256, stitch_graph_tokenization, verify_split_stitch_parity


def main() -> None:
    import numpy as np
    import onnxruntime as ort
    from onnxruntime_extensions import get_library_path
    from transformers import AutoTokenizer

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", type=Path, required=True)
    parser.add_argument("--checkpoint", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--operator-approval-reference", required=True)
    parser.add_argument("--quality-report", type=Path)
    parser.add_argument("--source-fixture-reference", type=Path)
    args = parser.parse_args()
    source = json.loads((args.bundle / "manifest.json").read_text())
    for name, key in (("model_int8.onnx", "model_sha256"), ("tokenizer.onnx", "tokenizer_sha256")):
        if sha256(args.bundle / name) != source[key]:
            raise ValueError(f"Bundle digest mismatch: {name}")
    if sha256(args.checkpoint / "model.safetensors") != source["checkpoint_sha256"]:
        raise ValueError("Checkpoint digest mismatch")
    quality = None
    if source.get("quantization_encoding") == "exact_u8u8_offset_v1":
        if args.quality_report is None or args.source_fixture_reference is None:
            raise ValueError("Portable encoding requires an exact Android-contract evaluation report")
        quality = json.loads(args.quality_report.read_text(encoding="utf-8"))
        if (
            quality.get("status") != "complete"
            or not quality.get("within_gate", {}).get("portable_android_unpadded")
            or quality.get("results", {}).get("portable_android_unpadded", {}).get("sha256") != source["model_sha256"]
            or quality.get("checkpoint_sha256") != source["checkpoint_sha256"]
        ):
            raise ValueError("Portable model quality gate or immutable identity does not match")
        if (
            quality.get("inference_contract") != "batch_1_unpadded_int64_attention_ones_v1"
            or quality.get("max_length") != 128
            or quality.get("holdout_reused") is not True
            or quality.get("independent_final_evaluation") is not False
            or quality.get("holdout_sha256") != "31e811205619d7968ad8c02d63f3bcdce0aa0a1427ee142c5b18fe7e9003a755"
            or quality.get("checkpoint_sha256") != "85580ba9edae8ce4428ccbd09c4e80d2ba7a6aaf24c61b14c173b40ab4e8e69b"
            or quality.get("results", {}).get("fp32_reference", {}).get("sha256")
            != "b402b28c8c9aa384e50068d25db86ae40287437e64942323829880901dd13253"
        ):
            raise ValueError("Quality report does not use the canonical reference and Android input contract")
        baseline_metrics = quality["results"]["fp32_reference"]
        candidate_metrics = quality["results"]["portable_android_unpadded"]
        if (
            quality.get("holdout_rows") != 3236
            or baseline_metrics["scam_recall"] - candidate_metrics["scam_recall"] > 0.01
            or baseline_metrics["macro_f1"] - candidate_metrics["macro_f1"] > 0.01
        ):
            raise ValueError("Measured portable model metrics exceed release tolerances")
        conversion_path = args.bundle / "portable_conversion.json"
        conversion = json.loads(conversion_path.read_text(encoding="utf-8"))
        original_fixtures = json.loads(args.source_fixture_reference.read_text(encoding="utf-8"))
        if (
            conversion.get("portable_model_sha256") != source["model_sha256"]
            or conversion.get("source_model_sha256") != source.get("source_int8_model_sha256")
            or conversion.get("source_model_sha256")
            != "2478923ccdb9fc9db9de0644f3eb3eb8cc7e4f6421a1b222dbae84b3b5feb57e"
            or len(conversion.get("converted_initializers", [])) != 148
            or conversion.get("encoding")
            != "U8U8 MatMulInteger; q_unsigned=q_signed+128; zero_unsigned=zero_signed+128"
            or original_fixtures.get("model_sha256") != conversion["source_model_sha256"]
            or original_fixtures.get("tokenizer_sha256") != source["tokenizer_sha256"]
            or sha256(args.source_fixture_reference)
            != "bc0e0fbe31eb5e2ccffdc063baabbe65bef6e8f2f4e8b45d74ca48f749f391cb"
        ):
            raise ValueError("Conversion and original fixture provenance do not match this portable artifact")
    config = json.loads((args.checkpoint / "config.json").read_text())
    if config["id2label"] != {"0": "Ham", "1": "Spam", "2": "Scam"}:
        raise ValueError("Unexpected label map")
    options = ort.SessionOptions()
    options.intra_op_num_threads = 2
    options.inter_op_num_threads = 1
    options.register_custom_ops_library(get_library_path())
    tokenizer = ort.InferenceSession(str(args.bundle / "tokenizer.onnx"), options)

    def graph(text):
        return tokenizer.run(["tokens_cast"], {"inputs": np.array([text], dtype=object)})[0].tolist()

    reference = AutoTokenizer.from_pretrained(args.checkpoint, local_files_only=True)
    verify_split_stitch_parity(reference, graph)
    model = ort.InferenceSession(str(args.bundle / "model_int8.onnx"), options)
    fixtures = []
    for raw in FIXTURES:
        masked = preprocess(raw)
        ids = stitch_graph_tokenization(masked, graph)
        if ids != reference(masked, truncation=True, max_length=128)["input_ids"]:
            raise ValueError("Preprocessed tokenizer parity failed")
        inputs = {
            "input_ids": np.array([ids], dtype=np.int64),
            "attention_mask": np.ones((1, len(ids)), dtype=np.int64),
        }
        logits = model.run(["logits"], inputs)[0][0]
        probabilities = np.exp(logits - np.max(logits))
        probabilities /= probabilities.sum()
        fixtures.append(
            {
                "raw": raw,
                "preprocessed": masked,
                "input_ids": ids,
                "logits": logits.tolist(),
                "probabilities": probabilities.tolist(),
                "label": source["labels"][int(probabilities.argmax())],
            }
        )
    args.output.mkdir(parents=True, exist_ok=True)
    for name in ("model_int8.onnx", "tokenizer.onnx"):
        dest = args.output / name
        if not dest.exists() or sha256(dest) != sha256(args.bundle / name):
            shutil.copyfile(args.bundle / name, dest)
    source.update(
        {
            "model_version": source.get("model_version", "candidate-2026-09-21-colab-C-local-int8"),
            "student_test_approved": True,
            "operator_approval_reference": args.operator_approval_reference,
            "production_release_approved": False,
            "physical_device_validated": False,
            "preprocessing_contract": "nfkc_whitespace_pii_v1",
            "thresholds": {"Ham": 0.5, "Spam": 0.6, "Scam": 0.9},
            "review_margin": 0.15,
            "inference_contract": "batch_1_unpadded_int64_attention_ones_v1",
            "note": (
                "Operator-approved student testing; independent final evaluation "
                "and physical-device validation remain pending."
            ),
        }
    )
    if quality is not None:
        source["quality_report_sha256"] = sha256(args.quality_report)
        source["conversion_report_sha256"] = sha256(args.bundle / "portable_conversion.json")
        source["quality_holdout_sha256"] = quality["holdout_sha256"]
        source["quality_holdout_reused"] = True
        source["original_cpu_specific_fixture_sha256"] = sha256(args.source_fixture_reference)
        source["parity_reference_reason"] = (
            "Portable U8U8 host reference after exact unpadded quality gate; "
            "original U8S8 x86 reference affected by integer saturation"
        )
        shutil.copyfile(args.quality_report, args.output / "quality_evaluation.json")
        shutil.copyfile(args.bundle / "portable_conversion.json", args.output / "portable_conversion.json")
    (args.output / "manifest.json").write_text(json.dumps(source, indent=2) + "\n", encoding="utf-8")
    (args.output / "parity_fixtures.json").write_text(
        json.dumps(
            {
                "schema": 1,
                "reference_runtime": ort.__version__,
                "inference_contract": "batch_1_unpadded_int64_attention_ones_v1",
                "model_sha256": source["model_sha256"],
                "tokenizer_sha256": source["tokenizer_sha256"],
                "fixtures": fixtures,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(
        json.dumps(
            {
                "output": str(args.output),
                "synthetic_fixture_count": len(fixtures),
                "source_tokenizer_parity": True,
                "model_sha256": source["model_sha256"],
            }
        )
    )


if __name__ == "__main__":
    main()
