"""Lightweight tests for training config + label handling (no torch needed)."""

from training.config import ID2LABEL, LABEL2ID, TrainingConfig
from training.dataset import _coerce_label


def test_label_maps_are_inverse():
    assert LABEL2ID == {v: k for k, v in ID2LABEL.items()}
    assert set(ID2LABEL.values()) == {"Likely Smishing", "Suspicious", "Unknown"}


def test_config_defaults():
    cfg = TrainingConfig()
    assert cfg.model_name == "xlm-roberta-base"
    assert cfg.num_labels == 3
    assert cfg.test_size == 0.20  # 80/20 split


def test_coerce_label_accepts_names_and_ids():
    assert _coerce_label("Likely Smishing") == 0
    assert _coerce_label("Unknown") == 2
    assert _coerce_label(1) == 1


def test_coerce_label_rejects_out_of_range():
    import pytest

    with pytest.raises(ValueError):
        _coerce_label(5)
