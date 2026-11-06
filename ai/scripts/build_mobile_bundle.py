"""Build and check a private Android ONNX bundle from an exported checkpoint.

The output belongs under ai/models/ (gitignored). This script does not approve a
model for release: approval requires an independent locked holdout and phone tests.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path
from typing import Callable, Mapping, Sequence

CANONICAL_SPECIAL_TOKEN_IDS = {
    "<s>": 0,
    "<pad>": 1,
    "</s>": 2,
    "<unk>": 3,
    "<mask>": 250001,
}
CANONICAL_SPECIAL_TOKEN_FLAGS = {
    "<s>": {"normalized": False, "lstrip": False, "rstrip": False, "single_word": False},
    "<pad>": {"normalized": False, "lstrip": False, "rstrip": False, "single_word": False},
    "</s>": {"normalized": False, "lstrip": False, "rstrip": False, "single_word": False},
    "<unk>": {"normalized": False, "lstrip": False, "rstrip": False, "single_word": False},
    "<mask>": {"normalized": False, "lstrip": False, "rstrip": False, "single_word": False},
}

FIXTURES = (
    "GCash alert: claim now",
    "Your OTP is 123456. Do not share it.",
    "Congratulations! Visit https://example.ph/claim for ₱5,000",
    "ＧＣａｓｈ account locked — verify now",
    "Kumusta po! Magkita tayo bukas.",
    "Email me at test@example.com",
    "नमस्ते! Kumusta 👋\u200d💻",
    "",
    "<s>start",
    "before<pad>after",
    "before</s>after",
    "before<unk>after",
    "before <mask> after",
    "<s><pad></s><unk><mask>",
    "<mask><mask>",
    ("a " * 200).strip(),
)
MAX_LENGTH = 128


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def verify_sentencepiece_compatibility(tokenizer_json: Path, sentencepiece_model: Path) -> None:
    """Ensure the supplied SentencePiece binary is the exact base vocabulary in tokenizer.json."""
    import sentencepiece as spm

    serialized = json.loads(tokenizer_json.read_text(encoding="utf-8"))
    vocab = serialized["model"]["vocab"]
    processor = spm.SentencePieceProcessor(model_file=str(sentencepiece_model))
    if len(vocab) != 250002 or processor.get_piece_size() != 250000:
        raise RuntimeError("SentencePiece vocabulary size does not match Model-C tokenizer")
    # XLM-R inserts <s> and <pad> ahead of the SentencePiece IDs, then <mask> last.
    mapping = {0: 3, 1: 0, 2: 2}
    for sp_id in range(processor.get_piece_size()):
        token_id = mapping.get(sp_id, sp_id + 1)
        piece, score = vocab[token_id]
        if piece != processor.id_to_piece(sp_id) or abs(score - processor.get_score(sp_id)) > 1e-5:
            raise RuntimeError(f"SentencePiece differs from tokenizer.json at piece {sp_id}")


def verify_model_c_special_tokens(tokenizer: object) -> None:
    """Fail closed unless Model-C's five added-token contracts are intact."""
    added_tokens = getattr(tokenizer, "added_tokens_decoder", None)
    convert_tokens_to_ids = getattr(tokenizer, "convert_tokens_to_ids", None)
    if not isinstance(added_tokens, Mapping) or not callable(convert_tokens_to_ids):
        raise RuntimeError("source tokenizer does not expose added-token metadata")

    for token, expected_id in CANONICAL_SPECIAL_TOKEN_IDS.items():
        actual_id = convert_tokens_to_ids(token)
        if actual_id != expected_id:
            raise RuntimeError(f"unexpected Model-C ID for {token}: {actual_id!r}")
        metadata = added_tokens.get(expected_id)
        if metadata is None or str(metadata) != token:
            raise RuntimeError(f"source tokenizer lacks metadata for {token}")
        for field, expected_value in CANONICAL_SPECIAL_TOKEN_FLAGS[token].items():
            if getattr(metadata, field, None) is not expected_value:
                raise RuntimeError(f"unexpected Model-C {field} metadata for {token}")


def split_special_tokens(text: str) -> list[str | int]:
    """Split text in source-tokenizer order, applying its added-token whitespace rules."""
    pieces: list[str | int] = []
    ordinary_start = 0
    cursor = 0
    special_tokens = tuple(CANONICAL_SPECIAL_TOKEN_IDS)

    while cursor < len(text):
        token = next((candidate for candidate in special_tokens if text.startswith(candidate, cursor)), None)
        if token is None:
            cursor += 1
            continue

        ordinary = text[ordinary_start:cursor]
        if CANONICAL_SPECIAL_TOKEN_FLAGS[token]["lstrip"]:
            ordinary = ordinary.rstrip()
        if ordinary:
            pieces.append(ordinary)
        pieces.append(CANONICAL_SPECIAL_TOKEN_IDS[token])
        cursor += len(token)
        if CANONICAL_SPECIAL_TOKEN_FLAGS[token]["rstrip"]:
            while cursor < len(text) and text[cursor].isspace():
                cursor += 1
        ordinary_start = cursor

    ordinary = text[ordinary_start:]
    if ordinary:
        pieces.append(ordinary)
    return pieces


def stitch_graph_tokenization(
    text: str,
    graph_tokenize: Callable[[str], Sequence[int]],
    *,
    max_length: int = MAX_LENGTH,
    pad_to_max_length: bool = False,
) -> list[int]:
    """Compose Model-C IDs from SentencePiece graph segments and source special tokens.

    The ONNX SentencePieceTokenizer graph handles only ordinary text.  It is
    deliberately never asked to encode a Model-C added token, because the ORT
    operator does not apply the tokenizer.json added-token rules.
    """
    if max_length < 2:
        raise ValueError("max_length must reserve room for Model-C BOS and EOS")

    content: list[int] = []
    for piece in split_special_tokens(text):
        if isinstance(piece, int):
            content.append(piece)
            continue
        segment_ids = list(graph_tokenize(piece))
        if (
            len(segment_ids) < 2
            or segment_ids[0] != CANONICAL_SPECIAL_TOKEN_IDS["<s>"]
            or segment_ids[-1] != CANONICAL_SPECIAL_TOKEN_IDS["</s>"]
        ):
            raise RuntimeError("SentencePiece graph segment does not have exactly one Model-C BOS/EOS wrapper")
        content.extend(segment_ids[1:-1])

    tokens = [CANONICAL_SPECIAL_TOKEN_IDS["<s>"], *content[: max_length - 2], CANONICAL_SPECIAL_TOKEN_IDS["</s>"]]
    if pad_to_max_length:
        tokens.extend([CANONICAL_SPECIAL_TOKEN_IDS["<pad>"]] * (max_length - len(tokens)))
    return tokens


def verify_split_stitch_parity(tokenizer: object, graph_tokenize: Callable[[str], Sequence[int]]) -> None:
    """Require exact source-tokenizer parity before writing a mobile bundle."""
    verify_model_c_special_tokens(tokenizer)
    for message in FIXTURES:
        expected = tokenizer(message, truncation=True, max_length=MAX_LENGTH)["input_ids"]
        actual = stitch_graph_tokenization(message, graph_tokenize, max_length=MAX_LENGTH)
        if actual != expected:
            raise RuntimeError(f"tokenizer split/stitch parity failed for fixture {message[:32]!r}")


def main() -> None:
    import numpy as np
    import onnx
    import onnxruntime as ort
    from onnxruntime_extensions import gen_processing_models, get_library_path
    from transformers import AutoTokenizer

    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--model-dir", type=Path, required=True)
    parser.add_argument("--onnx-dir", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument(
        "--sentencepiece-model",
        type=Path,
        help="Verified base-vocabulary binary for checkpoints distributed without sentencepiece.bpe.model",
    )
    args = parser.parse_args()

    weights = args.model_dir / "model.safetensors"
    int8 = args.onnx_dir / "model_int8.onnx"
    if not weights.is_file() or not int8.is_file():
        parser.error("checkpoint weights or INT8 ONNX export is missing")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    tokenizer = AutoTokenizer.from_pretrained(args.model_dir, local_files_only=True)
    verify_model_c_special_tokens(tokenizer)
    if not getattr(tokenizer, "vocab_file", None):
        if not args.sentencepiece_model or not args.sentencepiece_model.is_file():
            raise RuntimeError("checkpoint lacks SentencePiece binary; pass --sentencepiece-model")
        verify_sentencepiece_compatibility(args.model_dir / "tokenizer.json", args.sentencepiece_model)
        # The converter requires the binary path, but reads token metadata from
        # this Model-C tokenizer. Do not substitute an older tokenizer object.
        tokenizer.vocab_file = str(args.sentencepiece_model)
    pre, _ = gen_processing_models(tokenizer, pre_kwargs={"CAST_TOKEN_ID": True})
    tokenizer_path = args.output_dir / "tokenizer.onnx"
    onnx.save(pre, tokenizer_path)

    options = ort.SessionOptions()
    options.register_custom_ops_library(get_library_path())
    session = ort.InferenceSession(str(tokenizer_path), options, providers=["CPUExecutionProvider"])

    def graph_tokenize(segment: str) -> list[int]:
        return session.run(["tokens_cast"], {"inputs": np.array([segment], dtype=object)})[0].tolist()

    verify_split_stitch_parity(tokenizer, graph_tokenize)

    dest = args.output_dir / "model_int8.onnx"
    if int8.resolve() != dest.resolve():
        shutil.copy2(int8, dest)
    config = json.loads((args.model_dir / "config.json").read_text(encoding="utf-8"))
    if config["id2label"] != {"0": "Ham", "1": "Spam", "2": "Scam"}:
        raise RuntimeError("unexpected model label order")
    manifest = {
        "schema": 1,
        "release_approved": False,
        "checkpoint_sha256": sha256(weights),
        "model_sha256": sha256(dest),
        "tokenizer_sha256": sha256(tokenizer_path),
        "model_file": dest.name,
        "tokenizer_file": tokenizer_path.name,
        "labels": ["Ham", "Spam", "Scam"],
        "max_length": MAX_LENGTH,
        "bos_token_id": CANONICAL_SPECIAL_TOKEN_IDS["<s>"],
        "pad_token_id": CANONICAL_SPECIAL_TOKEN_IDS["<pad>"],
        "eos_token_id": CANONICAL_SPECIAL_TOKEN_IDS["</s>"],
        "special_token_ids": CANONICAL_SPECIAL_TOKEN_IDS,
        "tokenizer_contract": "model_c_sentencepiece_split_stitch_v1",
        "tokenizer_fixture_count": len(FIXTURES),
        "note": "Model-C tokenizer bundle; release approval requires independent evaluation and Android device tests.",
    }
    (args.output_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Bundle: {args.output_dir}; fixtures: {len(FIXTURES)}; release_approved: false")


if __name__ == "__main__":
    main()
