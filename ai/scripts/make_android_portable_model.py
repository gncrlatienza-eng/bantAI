"""Re-encode signed MatMulInteger weights as unsigned bytes without requantizing.

For every value, q_u = q_s + 128 and z_u = z_s + 128. Therefore
(q_u - z_u) * scale == (q_s - z_s) * scale exactly. Original weights,
scales, graph operations and synthetic reference outputs remain unchanged.
This avoids the non-VNNI x86 U8S8 saturation path. No dataset is consumed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        while block := stream.read(1024 * 1024):
            digest.update(block)
    return digest.hexdigest()


def main() -> None:
    import numpy as np
    import onnx
    import onnxruntime as ort
    from onnx import numpy_helper

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-bundle", required=True, type=Path)
    parser.add_argument("--output-dir", required=True, type=Path)
    args = parser.parse_args()
    source = args.source_bundle / "model_int8.onnx"
    original_manifest = json.loads((args.source_bundle / "manifest.json").read_text(encoding="utf-8"))
    manifest = dict(original_manifest)
    original_hash = sha256(source)
    if original_hash != original_manifest["model_sha256"]:
        raise ValueError("Source model hash differs from immutable source manifest")
    if args.source_bundle.resolve() == args.output_dir.resolve():
        raise ValueError("Never overwrite the source model bundle")
    model = onnx.load(source)
    uses = defaultdict(list)
    initializers = {tensor.name: tensor for tensor in model.graph.initializer}
    for node in model.graph.node:
        for position, name in enumerate(node.input):
            uses[name].append((node.op_type, position))
        if node.op_type == "MatMulInteger" and initializers[node.input[1]].data_type == onnx.TensorProto.INT8:
            if len(node.input) != 4 or initializers[node.input[3]].data_type != onnx.TensorProto.INT8:
                raise ValueError("Signed matrix requires an explicit signed zero point")
    converted = []
    for tensor in model.graph.initializer:
        if tensor.data_type != onnx.TensorProto.INT8:
            continue
        if not uses[tensor.name] or any(
            use not in {("MatMulInteger", 1), ("MatMulInteger", 3)} for use in uses[tensor.name]
        ):
            raise ValueError(f"Unexpected signed initializer consumers: {tensor.name}: {uses[tensor.name]}")
        signed = numpy_helper.to_array(tensor)
        unsigned = np.bitwise_xor(signed.view(np.uint8), np.uint8(128))
        if not np.array_equal(unsigned.astype(np.int16) - 128, signed.astype(np.int16)):
            raise ValueError(f"Non-exact offset conversion: {tensor.name}")
        converted.append({"name": tensor.name, "shape": list(tensor.dims), "consumers": uses[tensor.name]})
        tensor.CopyFrom(numpy_helper.from_array(unsigned, name=tensor.name))
    if len(converted) != 148:
        raise ValueError(f"Unexpected Model C signed tensor count: {len(converted)}")
    onnx.checker.check_model(model)
    args.output_dir.mkdir(parents=True, exist_ok=True)
    output = args.output_dir / "model_int8.onnx"
    temporary = output.with_suffix(".onnx.portable.tmp")
    onnx.save(model, temporary)
    del model
    new_hash = sha256(temporary)
    temporary.replace(output)
    report = {
        "created_utc": datetime.now(timezone.utc).isoformat(),
        "source_model_sha256": original_hash,
        "portable_model_sha256": new_hash,
        "encoding": "U8U8 MatMulInteger; q_unsigned=q_signed+128; zero_unsigned=zero_signed+128",
        "invariant": "Exact signed-to-unsigned offset; scale tensors and dequantized weight values unchanged",
        "onnx_version": onnx.__version__,
        "onnxruntime_version": ort.__version__,
        "converted_initializers": converted,
        "reference_outputs_rewritten": False,
        "quality_gate": "pending exact unpadded batch-one evaluation; not approved for packaging",
        "training_or_calibration_data_used": False,
        "production_release_approved": False,
        "physical_device_validated": False,
    }
    (args.output_dir / "portable_conversion.json").write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    import shutil

    shutil.copyfile(args.source_bundle / "tokenizer.onnx", args.output_dir / "tokenizer.onnx")
    manifest.update(
        model_sha256=new_hash,
        model_version="candidate-2026-09-21-colab-C-local-u8u8",
        quantization_encoding="exact_u8u8_offset_v1",
        source_int8_model_sha256=original_hash,
        student_test_approved=False,
        production_release_approved=False,
        physical_device_validated=False,
    )
    manifest_path = args.output_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "converted_initializers"}, indent=2))


if __name__ == "__main__":
    main()
