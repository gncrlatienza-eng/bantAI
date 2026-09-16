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


# --- synthetic rows train, never validate (2026-09-16) -----------------------
def _write(tmp_path, rows, header="text,label"):
    (tmp_path / "data.csv").write_text(header + "\n" + "\n".join(rows) + "\n", encoding="utf-8")
    return TrainingConfig(dataset_path=str(tmp_path), seed=42)


def test_synthetic_rows_are_kept_out_of_validation(tmp_path):
    """The failure this prevents: a candidate trained on generated text scores
    well on more generated text from the same templates, while the incumbent
    it is compared against has never seen any -- so the promotion gate would
    report "learned our templates" as "better at detecting scams"."""
    from training.dataset import load_split

    real = [f"real message number {i},{'Ham' if i % 2 else 'Scam'},dataset" for i in range(40)]
    synth = [f"generated message number {i},Scam,authored" for i in range(20)]
    config = _write(tmp_path, real + synth, header="text,label,origin")

    train_texts, val_texts, _, _ = load_split(config)

    assert not [t for t in val_texts if "generated" in t], "synthetic row reached the validation split"
    assert len([t for t in train_texts if "generated" in t]) == 20, "synthetic rows must still train"


def test_variants_are_excluded_from_validation_too(tmp_path):
    from training.dataset import load_split

    rows = [f"real message number {i},{'Ham' if i % 2 else 'Scam'},dataset" for i in range(40)]
    rows += [f"variant message number {i},Scam,variant" for i in range(10)]
    _, val_texts, _, _ = load_split(_write(tmp_path, rows, header="text,label,origin"))
    assert not [t for t in val_texts if "variant" in t]


def test_a_dataset_without_an_origin_column_splits_as_before(tmp_path):
    """Every file except the augmentation output has no origin column."""
    from training.dataset import load_split

    rows = [f"message number {i},{'Ham' if i % 2 else 'Scam'}" for i in range(40)]
    train_texts, val_texts, _, _ = load_split(_write(tmp_path, rows))
    assert len(val_texts) == 8  # 20% of 40, unchanged
    assert len(train_texts) == 32
