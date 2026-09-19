"""Conflicting labels for the same masked text must fail loudly (ML_READINESS_PLAN Gate 2).

``load_split`` de-duplicates on masked text because PII masking collapses
distinct raw messages onto one model input. That de-duplication used to keep
whichever row pandas happened to read first and silently discard the rest --
so a message labelled ``Ham`` in one source file and ``Scam`` in another
resolved to a coin flip decided by filename order, with no diagnostic.

A label conflict is an annotation defect, not a data-cleaning detail: it means
two annotators (or two sources) disagree about ground truth. Resolving it by
sort order manufactures a gold label nobody approved.
"""

import pytest

from training.config import TrainingConfig
from training.dataset import LabelConflictError, load_split


def _write(tmp_path, rows, header="text,label"):
    (tmp_path / "data.csv").write_text(header + "\n" + "\n".join(rows) + "\n", encoding="utf-8")
    return TrainingConfig(dataset_path=str(tmp_path), seed=42)


def _filler(n, start=0):
    """Rows that split cleanly, so a test fails on the conflict and not on stratification."""
    return [f"filler message number {i},{'Ham' if i % 2 else 'Scam'}" for i in range(start, start + n)]


def test_identical_text_with_two_different_labels_raises(tmp_path):
    rows = _filler(40) + ["your account is locked,Ham", "your account is locked,Scam"]

    with pytest.raises(LabelConflictError):
        load_split(_write(tmp_path, rows))


def test_rows_that_collapse_to_the_same_masked_text_raise(tmp_path):
    """The case the de-duplication exists for: two raw URLs, one masked input.

    ``bit.ly/aaa`` and ``bit.ly/bbb`` are different raw strings, so a
    de-duplication pass over raw text keeps both -- but the model only ever
    sees ``claim your prize at <URL>``. Conflicting labels on that single
    input are unresolvable.
    """
    rows = _filler(40) + [
        "claim your prize at bit.ly/aaa,Scam",
        "claim your prize at bit.ly/bbb,Ham",
    ]

    with pytest.raises(LabelConflictError):
        load_split(_write(tmp_path, rows))


def test_duplicate_rows_that_agree_still_de_duplicate_silently(tmp_path):
    """Agreement is not a conflict -- the existing collapse behaviour must survive."""
    rows = _filler(40) + ["you have won a prize,Scam"] * 3

    train_texts, val_texts, _, _ = load_split(_write(tmp_path, rows))

    winners = [t for t in train_texts + val_texts if "you have won a prize" in t]
    assert len(winners) == 1, "agreeing duplicates should collapse to one row, not raise"


def test_the_error_reports_the_text_and_every_label_claimed_for_it(tmp_path):
    """The failure has to be actionable: an adjudicator needs to know *what* to review."""
    rows = _filler(40) + ["your account is locked,Ham", "your account is locked,Scam"]

    with pytest.raises(LabelConflictError) as excinfo:
        load_split(_write(tmp_path, rows))

    message = str(excinfo.value)
    assert "your account is locked" in message
    assert "Ham" in message and "Scam" in message


def test_the_error_exposes_conflicts_so_a_caller_can_write_a_review_file(tmp_path):
    """Structured access, so the annotation-QA step is not left parsing a string."""
    rows = _filler(40) + [
        "your account is locked,Ham",
        "your account is locked,Scam",
        "verify now at bit.ly/aaa,Scam",
        "verify now at bit.ly/bbb,Spam",
    ]

    with pytest.raises(LabelConflictError) as excinfo:
        load_split(_write(tmp_path, rows))

    conflicts = excinfo.value.conflicts
    assert len(conflicts) == 2
    assert {"Ham", "Scam"} in [set(labels) for labels in conflicts.values()]
    assert {"Scam", "Spam"} in [set(labels) for labels in conflicts.values()]


def test_a_synthetic_row_may_not_silently_override_a_real_label(tmp_path):
    """Generated text that lands on a real message's masked form is still a conflict.

    Synthetic rows are training-only, so a silent overwrite here would let a
    template author change a human-reviewed gold label without review.
    """
    rows = [f"real message number {i},{'Ham' if i % 2 else 'Scam'},dataset" for i in range(40)]
    rows += ["your account is locked,Ham,dataset", "your account is locked,Scam,authored"]

    with pytest.raises(LabelConflictError):
        load_split(_write(tmp_path, rows, header="text,label,origin"))


def test_a_clean_dataset_is_unaffected(tmp_path):
    """Regression guard: the conflict check must not fire on well-formed data."""
    train_texts, val_texts, _, _ = load_split(_write(tmp_path, _filler(40)))

    assert len(val_texts) == 8
    assert len(train_texts) == 32
