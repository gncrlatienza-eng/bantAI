"""Unit tests for retraining snapshot assembly (WBS 4.3.5)."""

import csv
import json
import os
from datetime import datetime, timezone

import pytest

from retraining.reports import ValidatedReport
from retraining.snapshot import (
    MANIFEST_JSON,
    SNAPSHOT_CSV,
    build_snapshot,
    read_labeled_dataset,
    write_snapshot,
)


def dataset(n, label="Ham", prefix="msg"):
    return [(f"{prefix} number {i}", label) for i in range(n)]


# --- reports are never sampled away -----------------------------------------
def test_reports_survive_a_cap_smaller_than_the_dataset():
    """The corrections are the whole reason the retrain fired.

    Pooling reports with history and drawing uniformly would let the cap
    discard the one source of new signal in the run.
    """
    reports = [ValidatedReport(text=f"scam {i}", label="Scam") for i in range(50)]
    rows, manifest = build_snapshot(
        dataset_rows=dataset(5000),
        reports=reports,
        max_history=100,
        seed=42,
    )
    kept = [r for r in rows if r.origin == "report"]
    assert len(kept) == 50
    assert manifest.n_reports == 50
    assert manifest.n_history_after_sampling == 50  # 100 budget - 50 reports
    assert manifest.n_total == 100


def test_cap_below_report_count_keeps_every_report_and_no_history():
    reports = [ValidatedReport(text=f"scam {i}", label="Scam") for i in range(10)]
    rows, manifest = build_snapshot(dataset_rows=dataset(500), reports=reports, max_history=4, seed=42)
    assert manifest.n_reports == 10
    assert manifest.n_history_after_sampling == 0
    assert len(rows) == 10


def test_no_cap_uses_the_entire_dataset():
    """Sampling by default would silently discard training data."""
    rows, manifest = build_snapshot(dataset(300), reports=[], max_history=None)
    assert manifest.n_total == 300
    assert len(rows) == 300


# --- report labels win ------------------------------------------------------
def test_report_supersedes_the_dataset_row_it_corrects():
    """Keeping both copies would train on two readings of the same text."""
    rows, manifest = build_snapshot(
        dataset_rows=[("you won a prize", "Ham"), ("meeting at 3", "Ham")],
        reports=[ValidatedReport(text="you won a prize", label="Scam")],
    )
    by_text = {r.text: r for r in rows}
    assert by_text["you won a prize"].label == "Scam"
    assert by_text["you won a prize"].origin == "report"
    assert manifest.n_dataset_rows_superseded_by_report == 1
    assert manifest.n_reports_that_relabelled_a_row == 1
    assert manifest.n_total == 2


def test_agreeing_report_supersedes_without_counting_as_a_relabel():
    _, manifest = build_snapshot(
        dataset_rows=[("you won a prize", "Scam")],
        reports=[ValidatedReport(text="you won a prize", label="Scam")],
    )
    assert manifest.n_dataset_rows_superseded_by_report == 1
    assert manifest.n_reports_that_relabelled_a_row == 0


def test_supersession_matches_on_masked_text():
    """A report about one URL corrects every row that masks to the same input."""
    rows, manifest = build_snapshot(
        dataset_rows=[("claim now at 1q2w3e7.ca", "Ham")],
        reports=[ValidatedReport(text="claim now at 1q2w3e8.ca", label="Scam")],
    )
    assert manifest.n_dataset_rows_superseded_by_report == 1
    assert len(rows) == 1
    assert rows[0].label == "Scam"


def test_later_report_wins_over_an_earlier_one_for_the_same_message():
    rows, manifest = build_snapshot(
        dataset_rows=[],
        reports=[
            ValidatedReport(text="you won", label="Ham", report_id="r1"),
            ValidatedReport(text="you won", label="Scam", report_id="r2"),
        ],
    )
    assert manifest.n_reports == 1
    assert rows[0].label == "Scam"
    assert manifest.report_ids == ["r2"]


def test_most_recently_validated_report_wins_even_when_it_arrives_first():
    """``DatabaseReportSource`` preserves the backend's newest-first order.

    Last-write-wins over that order kept the *oldest* label, so the winner is
    decided by ``validated_at``, never by arrival order.
    """
    rows, manifest = build_snapshot(
        dataset_rows=[],
        reports=[
            ValidatedReport(text="you won", label="Scam", report_id="new", validated_at=datetime(2026, 9, 1)),
            ValidatedReport(
                text="you won", label="Ham", report_id="old", validated_at=datetime(2026, 8, 1, tzinfo=timezone.utc)
            ),
        ],
    )
    assert rows[0].label == "Scam"
    assert manifest.report_ids == ["new"]


def test_a_dated_report_beats_an_undated_one():
    rows, _ = build_snapshot(
        dataset_rows=[],
        reports=[
            ValidatedReport(text="you won", label="Scam", validated_at=datetime(2026, 8, 1, tzinfo=timezone.utc)),
            ValidatedReport(text="you won", label="Ham"),
        ],
    )
    assert rows[0].label == "Scam"


# --- de-duplication ---------------------------------------------------------
def test_dataset_rows_are_deduplicated_on_masked_text():
    """Two raw URLs collapse to one model input; both surviving is leakage."""
    rows, manifest = build_snapshot(
        dataset_rows=[
            ("claim now at 1q2w3e7.ca", "Scam"),
            ("claim now at 1q2w3e8.ca", "Scam"),
            ("meeting at 3", "Ham"),
        ],
        reports=[],
    )
    assert manifest.n_dataset_rows_seen == 3
    assert manifest.n_dataset_duplicates_dropped == 1
    assert len(rows) == 2


def test_snapshot_stores_raw_text_not_masked_text():
    """Masked text is a comparison key, never a stored artifact.

    The training path does its own preprocessing; writing pre-masked text
    would put a second pass over already-substituted input.
    """
    rows, _ = build_snapshot(dataset_rows=[("claim now at 1q2w3e7.ca", "Scam")], reports=[])
    assert rows[0].text == "claim now at 1q2w3e7.ca"


# --- determinism ------------------------------------------------------------
def test_same_seed_produces_the_same_snapshot():
    """A snapshot that cannot be regenerated makes a regression uninvestigable."""
    first, _ = build_snapshot(dataset(500), [], max_history=50, seed=7)
    second, _ = build_snapshot(dataset(500), [], max_history=50, seed=7)
    assert [r.text for r in first] == [r.text for r in second]


def test_different_seeds_produce_different_samples():
    first, _ = build_snapshot(dataset(500), [], max_history=50, seed=7)
    second, _ = build_snapshot(dataset(500), [], max_history=50, seed=8)
    assert [r.text for r in first] != [r.text for r in second]


# --- manifest ---------------------------------------------------------------
def test_manifest_records_label_distribution_and_source():
    _, manifest = build_snapshot(
        dataset_rows=dataset(3, "Ham") + dataset(2, "Scam", prefix="bad"),
        reports=[ValidatedReport(text="you won", label="Scam")],
        report_source="file:datasets/reports (batch.csv)",
    )
    assert manifest.label_counts == {"Ham": 3, "Scam": 3}
    assert manifest.report_source == "file:datasets/reports (batch.csv)"


def test_dataset_rows_are_consumed_exactly_once():
    """The reservoir's single-pass property is what lets callers stream."""
    consumed = []

    def stream():
        for row in dataset(100):
            consumed.append(row)
            yield row

    build_snapshot(stream(), [], max_history=10, seed=1)
    assert len(consumed) == 100


# --- writing ----------------------------------------------------------------
def test_write_snapshot_keeps_the_manifest_out_of_the_data_directory(tmp_path):
    """training/dataset.py globs *.json in its dataset path.

    A manifest beside the CSV would be parsed as training data.
    """
    rows, manifest = build_snapshot(dataset(3), [])
    data_dir = write_snapshot(rows, manifest, str(tmp_path))

    assert os.path.isfile(os.path.join(data_dir, SNAPSHOT_CSV))
    assert os.path.isfile(os.path.join(tmp_path, MANIFEST_JSON))
    assert not os.path.isfile(os.path.join(data_dir, MANIFEST_JSON))
    assert [f for f in os.listdir(data_dir) if f.endswith(".json")] == []


def test_written_csv_has_the_columns_training_expects(tmp_path):
    rows, manifest = build_snapshot(
        dataset_rows=[("meeting at 3", "Ham")],
        reports=[ValidatedReport(text="you won", label="Scam")],
    )
    data_dir = write_snapshot(rows, manifest, str(tmp_path))
    with open(os.path.join(data_dir, SNAPSHOT_CSV), newline="", encoding="utf-8") as f:
        written = list(csv.DictReader(f))

    assert {"text", "label", "origin"} <= set(written[0])
    assert {r["origin"] for r in written} == {"report", "dataset"}


def test_manifest_is_valid_json(tmp_path):
    rows, manifest = build_snapshot(dataset(3), [])
    write_snapshot(rows, manifest, str(tmp_path))
    payload = json.loads((tmp_path / MANIFEST_JSON).read_text(encoding="utf-8"))
    assert payload["n_total"] == 3
    assert "created_at" in payload


# --- reading the labeled dataset --------------------------------------------
def test_read_labeled_dataset_skips_the_sample_reference_file(tmp_path):
    """sample.csv is the format reference in ai/README.md, not real data."""
    (tmp_path / "sample.csv").write_text("text,label\ndummy,Ham\n", encoding="utf-8")
    (tmp_path / "real.csv").write_text("text,label\nreal row,Scam\n", encoding="utf-8")
    assert list(read_labeled_dataset(str(tmp_path))) == [("real row", "Scam", "dataset")]


def test_read_labeled_dataset_raises_on_an_empty_directory(tmp_path):
    with pytest.raises(FileNotFoundError):
        list(read_labeled_dataset(str(tmp_path)))


def test_read_labeled_dataset_ignores_extra_columns(tmp_path):
    (tmp_path / "real.csv").write_text("text,label,language,source\nkumusta,Ham,tl,inbox\n", encoding="utf-8")
    assert list(read_labeled_dataset(str(tmp_path))) == [("kumusta", "Ham", "dataset")]


def test_read_labeled_dataset_preserves_a_synthetic_origin(tmp_path):
    """Dropping this column would silently re-admit generated rows to the
    validation split -- see SYNTHETIC_ORIGINS in training/config.py."""
    (tmp_path / "aug.csv").write_text(
        "text,label,category,origin,seed_id\nyou won,Scam,Prize Lure,authored,\n", encoding="utf-8"
    )
    assert list(read_labeled_dataset(str(tmp_path))) == [("you won", "Scam", "authored")]


def test_snapshot_carries_origin_through_to_the_csv(tmp_path):
    rows, _ = build_snapshot(
        dataset_rows=[("real one", "Ham", "dataset"), ("generated one", "Scam", "authored")],
        reports=[],
    )
    assert {r.text: r.origin for r in rows} == {"real one": "dataset", "generated one": "authored"}


def test_build_snapshot_still_accepts_two_element_rows():
    """Hand-built callers and older tests pass bare (text, label)."""
    rows, _ = build_snapshot(dataset_rows=[("plain row", "Ham")], reports=[])
    assert rows[0].origin == "dataset"


# --- dataset fingerprint (2026-09-16) ----------------------------------------
def test_dataset_digest_is_stable_under_row_order():
    """Two snapshots of the same data must hash the same, or the digest tracks
    file ordering rather than content."""
    a, _ = build_snapshot(dataset_rows=[("first msg", "Ham"), ("second msg", "Scam")], reports=[])
    b, manifest_b = build_snapshot(dataset_rows=[("second msg", "Scam"), ("first msg", "Ham")], reports=[])
    _, manifest_a = build_snapshot(dataset_rows=[("first msg", "Ham"), ("second msg", "Scam")], reports=[])
    assert manifest_a.dataset_sha256 == manifest_b.dataset_sha256
    assert len(a) == len(b) == 2


def test_dataset_digest_changes_when_one_label_changes():
    """The case row counts cannot catch: on 2026-09-16 a review moved 99 rows
    out of Scam, leaving the pool the same size and a different dataset."""
    _, before = build_snapshot(dataset_rows=[("a msg", "Ham"), ("b msg", "Scam")], reports=[])
    _, after = build_snapshot(dataset_rows=[("a msg", "Ham"), ("b msg", "Spam")], reports=[])
    assert before.n_total == after.n_total
    assert before.dataset_sha256 != after.dataset_sha256


def test_dataset_digest_ignores_masked_away_differences():
    """Two rows differing only in a tracking URL are the same training input."""
    _, one = build_snapshot(dataset_rows=[("claim now at 1q2w3e7.ca", "Scam")], reports=[])
    _, two = build_snapshot(dataset_rows=[("claim now at 1q2w3e8.ca", "Scam")], reports=[])
    assert one.dataset_sha256 == two.dataset_sha256
