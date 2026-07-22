"""Unit tests for NFKC normalization (ai/preprocessing/normalization.py)."""

from preprocessing.normalization import normalize_text


def test_folds_fullwidth_characters():
    # Full-width "ＧＣａｓｈ" should fold to ASCII "GCash" under NFKC.
    assert normalize_text("ＧＣａｓｈ") == "GCash"


def test_folds_fullwidth_digits():
    assert normalize_text("１２３４") == "1234"


def test_folds_ligatures():
    assert normalize_text("ﬁle") == "file"


def test_collapses_whitespace():
    assert normalize_text("hello\t\n  world  ") == "hello world"


def test_preserves_casing():
    assert normalize_text("CLAIM your PRIZE") == "CLAIM your PRIZE"


def test_empty_input():
    assert normalize_text("") == ""
