"""Bind passing Android emulator regression evidence to a student bundle."""

import argparse
import hashlib
import json
import math
import shutil
from pathlib import Path


def sha256(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bundle", required=True, type=Path)
    parser.add_argument("--report", required=True, type=Path)
    args = parser.parse_args()
    manifest_path = args.bundle / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    report = json.loads(args.report.read_text(encoding="utf-8"))
    reference = report.get("reference", {})
    if not (
        report.get("status") == "complete"
        and report.get("within_gate") is True
        and report.get("native_runtime") == "Android ONNX Runtime 1.30.0"
        and report.get("model_sha256") == manifest["model_sha256"]
        and sha256(args.bundle / "model_int8.onnx") == manifest["model_sha256"]
        and report.get("checkpoint_sha256") == manifest["checkpoint_sha256"]
        and report.get("holdout_sha256") == "31e811205619d7968ad8c02d63f3bcdce0aa0a1427ee142c5b18fe7e9003a755"
        and report.get("inference_contract") == manifest["inference_contract"]
        and report.get("rows") == 3236
        and report.get("holdout_reused") is True
        and report.get("independent_final_evaluation") is False
        and report.get("physical_device_validated") is False
        and reference.get("sha256") == "b402b28c8c9aa384e50068d25db86ae40287437e64942323829880901dd13253"
    ):
        raise ValueError("Native regression evidence differs from the canonical student model")
    matrix = report["confusion_matrix"]
    if (
        len(matrix) != 3
        or any(len(row) != 3 or any(type(value) is not int or value < 0 for value in row) for row in matrix)
        or list(map(sum, matrix)) != [1787, 958, 491]
    ):
        raise ValueError("Native confusion matrix does not cover the canonical holdout")
    f1s = []
    for label in range(3):
        tp = matrix[label][label]
        fp = sum(row[label] for row in matrix) - tp
        fn = sum(matrix[label]) - tp
        f1s.append(2.0 * tp / (2.0 * tp + fp + fn))
    macro_f1 = sum(f1s) / 3
    recall = matrix[2][2] / 491
    if (
        not math.isclose(macro_f1, report["macro_f1"], abs_tol=1e-9)
        or not math.isclose(recall, report["scam_recall"], abs_tol=1e-9)
        or 0.9635 - macro_f1 > 0.01
        or 0.9572 - recall > 0.01
    ):
        raise ValueError("Actual Android native quality exceeds the regression tolerance")
    if not manifest["student_test_approved"] or manifest["production_release_approved"]:
        raise ValueError("Native evidence must retain the student-only approval boundary")
    destination = args.bundle / "native_quality_evaluation.json"
    if args.report.resolve() != destination.resolve():
        shutil.copyfile(args.report, destination)
    manifest["native_quality_report_sha256"] = sha256(destination)
    manifest["native_emulator_validated"] = True
    manifest["physical_device_validated"] = False
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(
        json.dumps(
            {
                "native_quality_report_sha256": manifest["native_quality_report_sha256"],
                "macro_f1": macro_f1,
                "scam_recall": recall,
            }
        )
    )


if __name__ == "__main__":
    main()
