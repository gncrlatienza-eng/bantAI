"""Lightweight tests for training config + label handling (no torch needed)."""

from training.config import ID2LABEL, LABEL2ID, TrainingConfig
from training.dataset import _coerce_label


def test_label_maps_are_inverse():
    assert LABEL2ID == {v: k for k, v in ID2LABEL.items()}
    assert set(ID2LABEL.values()) == {"Ham", "Spam", "Scam"}
    assert ID2LABEL[0] == "Ham" and ID2LABEL[1] == "Spam" and ID2LABEL[2] == "Scam"


def test_config_defaults():
    cfg = TrainingConfig()
    assert cfg.model_name == "xlm-roberta-base"
    assert cfg.num_labels == 3
    assert cfg.test_size == 0.20  # 80/20 split


def test_coerce_label_accepts_names_and_ids():
    assert _coerce_label("Ham") == 0
    assert _coerce_label("Scam") == 2
    assert _coerce_label(1) == 1


def test_coerce_label_is_case_insensitive():
    assert _coerce_label("ham") == 0
    assert _coerce_label("  SCAM ") == 2
    assert _coerce_label("Spam") == 1


def test_coerce_label_rejects_out_of_range():
    import pytest

    with pytest.raises(ValueError):
        _coerce_label(5)


# --- class-weighted loss --------------------------------------------------- #


def test_class_weights_are_inverse_frequency():
    """Rarer classes get proportionally larger weights."""
    from training.train import compute_class_weights

    # 60 Ham / 30 Spam / 10 Scam
    ds = {"labels": [0] * 60 + [1] * 30 + [2] * 10}
    w = compute_class_weights(ds, 3)

    # n_samples / (n_classes * count)
    assert w == [100 / (3 * 60), 100 / (3 * 30), 100 / (3 * 10)]
    # The whole point: a Scam mistake must cost more than a Ham one.
    assert w[2] > w[1] > w[0]


def test_class_weights_are_flat_when_balanced():
    from training.train import compute_class_weights

    w = compute_class_weights({"labels": [0] * 10 + [1] * 10 + [2] * 10}, 3)
    assert w == [1.0, 1.0, 1.0]


def test_class_weights_none_when_a_class_is_missing():
    """No Scam rows -> weighting is meaningless and would divide by zero."""
    from training.train import compute_class_weights

    assert compute_class_weights({"labels": [0, 0, 1, 1]}, 3) is None


def test_class_weights_read_label_column_when_not_yet_collated():
    """The tokenized dataset carries `label`; the collator renames it later."""
    from training.train import compute_class_weights

    assert compute_class_weights({"label": [0, 0, 1, 2]}, 3) is not None


def test_class_weighted_loss_enabled_by_default():
    from training.config import TrainingConfig

    assert TrainingConfig().class_weighted_loss is True
