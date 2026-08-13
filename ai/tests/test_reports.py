"""Unit tests for validated-report sources (WBS 4.3.5)."""

import json
from datetime import datetime, timezone

import pytest

from retraining.reports import (
    FileReportSource,
    NullReportSource,
    ReportFormatError,
    ValidatedReport,
    _coerce_label,
)


def write_csv(directory, name, rows, header="text,label"):
    path = directory / name
    path.write_text(
        header + "\n" + "\n".join(rows) + "\n", encoding="utf-8"
    )
    return path


# --- label coercion ---------------------------------------------------------
@pytest.mark.parametrize(
    "value,expected",
    [
        ("Scam", "Scam"),
        ("scam", "Scam"),
        ("SCAM", "Scam"),
        ("  Spam  ", "Spam"),
        (0, "Ham"),
        (2, "Scam"),
        ("2", "Scam"),
    ],
)
def test_labels_are_normalized_to_canonical_names(value, expected):
    """Exports come from several places and none of them agree on casing."""
    assert _coerce_label(value) == expected


@pytest.mark.parametrize("value", ["Phishing", "", 7, -1, None])
def test_unrecognised_labels_raise(value):
    with pytest.raises(ReportFormatError):
        _coerce_label(value)


# --- file source ------------------------------------------------------------
def test_reads_csv_reports(tmp_path):
    write_csv(tmp_path, "batch.csv", ["you won,Scam", "meeting at 3,Ham"])
    reports = list(FileReportSource(str(tmp_path)).fetch())
    assert [(r.text, r.label) for r in reports] == [
        ("you won", "Scam"),
        ("meeting at 3", "Ham"),
    ]


def test_reads_jsonl_reports(tmp_path):
    path = tmp_path / "batch.jsonl"
    path.write_text(
        json.dumps({"text": "you won", "label": "Scam", "report_id": "r1"})
        + "\n",
        encoding="utf-8",
    )
    (report,) = list(FileReportSource(str(tmp_path)).fetch())
    assert (report.text, report.label, report.report_id) == (
        "you won",
        "Scam",
        "r1",
    )


def test_missing_required_column_raises(tmp_path):
    """A broken column mapping is far likelier than one bad row.

    Skipping instead of raising would quietly shrink the correction set that
    justified retraining in the first place.
    """
    write_csv(tmp_path, "bad.csv", ["you won,Scam"], header="body,verdict")
    with pytest.raises(ReportFormatError):
        list(FileReportSource(str(tmp_path)).fetch())


def test_empty_text_raises(tmp_path):
    write_csv(tmp_path, "bad.csv", [",Scam"])
    with pytest.raises(ReportFormatError):
        list(FileReportSource(str(tmp_path)).fetch())


def test_missing_directory_yields_nothing(tmp_path):
    source = FileReportSource(str(tmp_path / "nope"))
    assert list(source.fetch()) == []
    assert "no report files present" in source.describe()


def test_describe_names_the_files_it_read(tmp_path):
    write_csv(tmp_path, "batch.csv", ["you won,Scam"])
    assert "batch.csv" in FileReportSource(str(tmp_path)).describe()


# --- `since` filtering ------------------------------------------------------
def test_since_excludes_older_reports(tmp_path):
    write_csv(
        tmp_path,
        "batch.csv",
        [
            "old,Scam,2026-08-01T00:00:00+00:00",
            "new,Scam,2026-08-10T00:00:00+00:00",
        ],
        header="text,label,validated_at",
    )
    cutoff = datetime(2026, 8, 5, tzinfo=timezone.utc)
    reports = list(FileReportSource(str(tmp_path)).fetch(since=cutoff))
    assert [r.text for r in reports] == ["new"]


def test_reports_without_a_timestamp_survive_the_since_filter(tmp_path):
    """Missing metadata must not silently discard a real correction.

    Re-including a report the previous run already saw is harmless -- the
    snapshot de-duplicates -- whereas dropping one loses signal outright.
    """
    write_csv(tmp_path, "batch.csv", ["undated,Scam"])
    cutoff = datetime(2026, 8, 5, tzinfo=timezone.utc)
    assert len(list(FileReportSource(str(tmp_path)).fetch(since=cutoff))) == 1


def test_unparseable_timestamp_is_treated_as_absent(tmp_path):
    write_csv(
        tmp_path,
        "batch.csv",
        ["weird,Scam,not-a-date"],
        header="text,label,validated_at",
    )
    (report,) = list(FileReportSource(str(tmp_path)).fetch())
    assert report.validated_at is None


def test_naive_and_aware_timestamps_compare_without_crashing(tmp_path):
    """An ISO string without an offset parses naive; with one, aware.

    Python raises TypeError on comparing the two, so a single un-offset row in
    an export would otherwise crash the whole retrain.
    """
    write_csv(
        tmp_path,
        "batch.csv",
        [
            "naive old,Scam,2026-08-01T00:00:00",
            "aware new,Scam,2026-08-10T00:00:00+00:00",
        ],
        header="text,label,validated_at",
    )
    naive_cutoff = datetime(2026, 8, 5)
    aware_cutoff = datetime(2026, 8, 5, tzinfo=timezone.utc)

    for cutoff in (naive_cutoff, aware_cutoff):
        kept = [r.text for r in FileReportSource(str(tmp_path)).fetch(since=cutoff)]
        assert kept == ["aware new"]


def test_datetime_min_as_since_keeps_everything(tmp_path):
    """`--since all` passes datetime.min, which is naive."""
    write_csv(
        tmp_path,
        "batch.csv",
        ["old,Scam,2026-01-01T00:00:00+00:00"],
        header="text,label,validated_at",
    )
    kept = list(FileReportSource(str(tmp_path)).fetch(since=datetime.min))
    assert len(kept) == 1


def test_trailing_z_timestamps_parse(tmp_path):
    write_csv(
        tmp_path,
        "batch.csv",
        ["z,Scam,2026-08-10T00:00:00Z"],
        header="text,label,validated_at",
    )
    (report,) = list(FileReportSource(str(tmp_path)).fetch())
    assert report.validated_at == datetime(2026, 8, 10, tzinfo=timezone.utc)


# --- null source ------------------------------------------------------------
def test_null_source_yields_nothing_and_says_so():
    """"0 reports" from a null source and from a live empty store are
    different facts when investigating a regression months later."""
    source = NullReportSource()
    assert list(source.fetch()) == []
    assert "null" in source.describe()
    assert "4.3.1" in source.describe()


def test_validated_report_is_hashable_and_frozen():
    report = ValidatedReport(text="x", label="Scam")
    with pytest.raises(Exception):
        report.text = "y"
