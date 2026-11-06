from __future__ import annotations

from pathlib import Path

import pytest

from scripts.build_mobile_bundle import (
    CANONICAL_SPECIAL_TOKEN_FLAGS,
    CANONICAL_SPECIAL_TOKEN_IDS,
    split_special_tokens,
    stitch_graph_tokenization,
    verify_model_c_special_tokens,
)


def graph_for(segment: str) -> list[int]:
    """A deterministic stand-in for a graph that wraps every ordinary segment."""
    return [0, *(100 + ord(character) for character in segment), 2]


def test_split_special_tokens_scans_all_model_c_tokens_left_to_right():
    assert split_special_tokens("a<s>b<pad>c</s>d<unk>e<mask>f") == [
        "a",
        0,
        "b",
        1,
        "c",
        2,
        "d",
        3,
        "e",
        250001,
        "f",
    ]


def test_mask_whitespace_is_preserved_by_model_c_metadata_contract():
    assert split_special_tokens("before \t<mask> after") == ["before \t", 250001, " after"]


def test_stitch_wraps_once_and_preserves_adjacent_special_tokens():
    assert stitch_graph_tokenization("x<s><pad></s><unk><mask>y", graph_for, max_length=32) == [
        0,
        220,
        0,
        1,
        2,
        3,
        250001,
        221,
        2,
    ]


def test_stitch_handles_empty_unicode_and_truncation_and_padding():
    assert stitch_graph_tokenization("", graph_for, max_length=8) == [0, 2]
    assert stitch_graph_tokenization("é👋", graph_for, max_length=8) == [0, 333, 128175, 2]
    assert stitch_graph_tokenization("abcdef", graph_for, max_length=5) == [0, 197, 198, 199, 2]
    assert stitch_graph_tokenization("a", graph_for, max_length=5, pad_to_max_length=True) == [0, 197, 2, 1, 1]


def test_stitch_rejects_graph_without_one_bos_eos_wrapper():
    with pytest.raises(RuntimeError, match="BOS/EOS"):
        stitch_graph_tokenization("ordinary", lambda _segment: [1, 2])


class FakeAddedToken:
    def __init__(self, content: str, **flags: bool) -> None:
        self.content = content
        for field, value in flags.items():
            setattr(self, field, value)

    def __str__(self) -> str:
        return self.content


class FakeTokenizer:
    def __init__(self) -> None:
        self.added_tokens_decoder = {
            token_id: FakeAddedToken(token, **CANONICAL_SPECIAL_TOKEN_FLAGS[token])
            for token, token_id in CANONICAL_SPECIAL_TOKEN_IDS.items()
        }

    def convert_tokens_to_ids(self, token: str) -> int:
        return CANONICAL_SPECIAL_TOKEN_IDS[token]


def test_source_special_metadata_must_match_model_c_contract():
    tokenizer = FakeTokenizer()
    verify_model_c_special_tokens(tokenizer)

    tokenizer.added_tokens_decoder[250001].normalized = True
    with pytest.raises(RuntimeError, match="normalized"):
        verify_model_c_special_tokens(tokenizer)


def test_private_model_c_bundle_tokenizes_and_runs_int8_onnx():
    """Exercise the packaged tokenizer plus model when private artifacts are present."""
    model_dir = Path(__file__).resolve().parents[1] / "models/candidates/2026-09-21-colab-C"
    bundle_dir = Path(__file__).resolve().parents[1] / "models/mobile_bundle_colab_C"
    if not all(
        path.is_file()
        for path in (
            model_dir / "tokenizer.json",
            bundle_dir / "tokenizer.onnx",
            bundle_dir / "model_int8.onnx",
        )
    ):
        pytest.skip("private Model-C bundle is not available")

    import numpy as np
    import onnxruntime as ort
    from onnxruntime_extensions import get_library_path
    from transformers import AutoTokenizer

    from preprocessing import preprocess

    source_tokenizer = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
    options = ort.SessionOptions()
    options.register_custom_ops_library(get_library_path())
    token_session = ort.InferenceSession(
        str(bundle_dir / "tokenizer.onnx"), options, providers=["CPUExecutionProvider"]
    )
    model_session = ort.InferenceSession(str(bundle_dir / "model_int8.onnx"), providers=["CPUExecutionProvider"])

    def graph_tokenize(segment: str) -> list[int]:
        return token_session.run(["tokens_cast"], {"inputs": np.array([segment], dtype=object)})[0].tolist()

    for raw in ("GCash alert: claim now", "before <mask> after", "Kumusta po! Magkita tayo bukas."):
        prepared = preprocess(raw)
        expected = source_tokenizer(prepared, truncation=True, max_length=128, padding="max_length")
        ids = stitch_graph_tokenization(prepared, graph_tokenize, max_length=128, pad_to_max_length=True)
        assert ids == expected["input_ids"]
        mask = [int(token != 1) for token in ids]
        assert mask == expected["attention_mask"]
        inputs = {"input_ids": np.array([ids], dtype=np.int64), "attention_mask": np.array([mask], dtype=np.int64)}
        logits = model_session.run(None, inputs)[0]
        assert logits.shape == (1, 3)
        assert np.isfinite(logits).all()
