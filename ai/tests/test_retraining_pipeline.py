"""Unit tests for the retraining pipeline orchestration (WBS 4.3.5).

These exercise everything except the fine-tune itself, which needs a GPU to be
practical. ``--dry-run`` exists precisely so the snapshot, manifest, run-layout
and report-source wiring can be verified without one.
"""

import json
import os
from datetime import datetime, timezone

import pytest

from retraining import pipeline as pl
from retraining.pipeline import (
    CANDIDATE_SUBDIR,
    DECISION_JSON,
    RetrainingRun,
    evaluate_candidate,
    last_run_time,
    run_retraining,
)
from retraining.reports import (
    DatabaseReportSource,
    FileReportSource,
    NullReportSource,
    ReportSourceError,
)
from retraining.snapshot import MANIFEST_JSON, SNAPSHOT_CSV


@pytest.fixture
def labeled_dir(tmp_path):
    directory = tmp_path / "labeled"
    directory.mkdir()
    rows = "\n".join(f"message number {i},Ham" for i in range(20))
    (directory / "data.csv").write_text(f"text,label\n{rows}\n", encoding="utf-8")
    return str(directory)


# --- dry run ----------------------------------------------------------------
def test_dry_run_writes_a_snapshot_and_stops(labeled_dir, tmp_path):
    run = run_retraining(
        labeled_dir=labeled_dir,
        runs_root=str(tmp_path / "runs"),
        dry_run=True,
    )

    assert run.dry_run
    assert run.candidate_dir is None
    assert run.decision is None
    assert os.path.isfile(os.path.join(run.snapshot_dir, SNAPSHOT_CSV))
    assert os.path.isfile(os.path.join(run.run_dir, MANIFEST_JSON))
    # Nothing was trained, so no verdict may exist to be mistaken for one.
    assert not os.path.exists(os.path.join(run.run_dir, DECISION_JSON))
    assert not os.path.exists(os.path.join(run.run_dir, CANDIDATE_SUBDIR))


def test_dry_run_defaults_to_the_null_report_source(labeled_dir, tmp_path):
    """No report store exists until WBS 4.3.1; the manifest must say so."""
    run = run_retraining(labeled_dir=labeled_dir, runs_root=str(tmp_path / "runs"), dry_run=True)
    assert run.manifest.n_reports == 0
    assert "null" in run.manifest.report_source
    assert not run.promoted


def test_dry_run_includes_reports_from_a_file_source(labeled_dir, tmp_path):
    reports_dir = tmp_path / "reports"
    reports_dir.mkdir()
    (reports_dir / "batch.csv").write_text("text,label\nyou won a prize,Scam\nclaim here,Scam\n", encoding="utf-8")

    run = run_retraining(
        labeled_dir=labeled_dir,
        report_source=FileReportSource(str(reports_dir)),
        runs_root=str(tmp_path / "runs"),
        dry_run=True,
    )

    assert run.manifest.n_reports == 2
    assert run.manifest.label_counts["Scam"] == 2
    assert "batch.csv" in run.manifest.report_source


def test_dry_run_includes_reports_from_the_database_source(labeled_dir, tmp_path, monkeypatch):
    """The seam works end to end: no pipeline or snapshot code knows which
    source it was handed, which is the whole reason the interface exists."""
    import io
    import urllib.request

    payload = [
        {
            "id": "rpt-1",
            "status": "Validated",
            "reportedLabel": "Scam",
            "updatedAt": "2026-08-12T14:30:00.000Z",
            "message": {"id": "m1", "body": "you won a prize"},
        },
        {
            "id": "rpt-2",
            "status": "Pending",
            "reportedLabel": "Scam",
            "updatedAt": "2026-08-12T14:31:00.000Z",
            "message": {"id": "m2", "body": "not yet reviewed"},
        },
    ]

    class _Resp(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *exc):
            self.close()
            return False

    monkeypatch.setattr(
        urllib.request,
        "urlopen",
        lambda request, timeout=None: _Resp(json.dumps(payload).encode("utf-8")),
    )

    run = run_retraining(
        labeled_dir=labeled_dir,
        report_source=DatabaseReportSource("http://localhost:3000/api", "k"),
        runs_root=str(tmp_path / "runs"),
        dry_run=True,
    )

    # The Pending row must not reach the snapshot.
    assert run.manifest.n_reports == 1
    # The manifest has to name the live store, so "1 report" from a database
    # is never read as "1 report" from a hand-built CSV months later.
    assert run.manifest.report_source.startswith("database:")
    assert "1 of 2 reports" in run.manifest.report_source


def test_database_source_failure_stops_the_run(labeled_dir, tmp_path, monkeypatch):
    """A retrain that quietly trains on zero corrections is the outcome the
    whole report path exists to prevent -- so this must propagate, not degrade
    into a clean run with n_reports == 0."""
    import urllib.error
    import urllib.request

    def _boom(request, timeout=None):
        raise urllib.error.URLError("connection refused")

    monkeypatch.setattr(urllib.request, "urlopen", _boom)

    with pytest.raises(ReportSourceError):
        run_retraining(
            labeled_dir=labeled_dir,
            report_source=DatabaseReportSource("http://localhost:3000/api", "k"),
            runs_root=str(tmp_path / "runs"),
            dry_run=True,
        )


def test_run_directories_are_created_under_the_runs_root(labeled_dir, tmp_path):
    runs_root = tmp_path / "runs"
    run = run_retraining(labeled_dir=labeled_dir, runs_root=str(runs_root), dry_run=True)
    assert os.path.dirname(run.run_dir) == str(runs_root)


def test_run_directory_name_is_filesystem_portable(labeled_dir, tmp_path):
    """Colons are legal on POSIX but not Windows; this project uses both."""
    run = run_retraining(labeled_dir=labeled_dir, runs_root=str(tmp_path / "runs"), dry_run=True)
    assert ":" not in os.path.basename(run.run_dir)


# --- `since` bookkeeping ----------------------------------------------------
def test_last_run_time_is_none_when_nothing_has_run(tmp_path):
    assert last_run_time(str(tmp_path / "missing")) is None


def test_last_run_time_reads_the_newest_manifest(tmp_path):
    runs_root = tmp_path / "runs"
    for name, stamp in [
        ("run-a", "2026-08-01T00:00:00+00:00"),
        ("run-b", "2026-08-09T00:00:00+00:00"),
    ]:
        run_dir = runs_root / name
        run_dir.mkdir(parents=True)
        (run_dir / MANIFEST_JSON).write_text(json.dumps({"created_at": stamp}), encoding="utf-8")

    assert last_run_time(str(runs_root)) == datetime(2026, 8, 9, tzinfo=timezone.utc)


def test_a_corrupt_manifest_does_not_block_a_retrain(tmp_path):
    """Re-consuming reports is harmless; refusing to retrain is not."""
    runs_root = tmp_path / "runs"
    (runs_root / "broken").mkdir(parents=True)
    (runs_root / "broken" / MANIFEST_JSON).write_text("{not json", encoding="utf-8")
    (runs_root / "good").mkdir(parents=True)
    (runs_root / "good" / MANIFEST_JSON).write_text(
        json.dumps({"created_at": "2026-08-09T00:00:00+00:00"}), encoding="utf-8"
    )

    assert last_run_time(str(runs_root)) == datetime(2026, 8, 9, tzinfo=timezone.utc)


def test_a_dry_run_does_not_advance_the_report_watermark(labeled_dir, tmp_path):
    """A dry run trains nothing, so it consumed no reports.

    Letting it move the watermark would make the next *real* run silently skip
    every report the dry run merely looked at -- invisible until the retrained
    model inexplicably fails to learn a correction.
    """
    runs_root = str(tmp_path / "runs")
    reports_dir = tmp_path / "reports"
    reports_dir.mkdir()
    (reports_dir / "batch.csv").write_text(
        "text,label,validated_at\nold report,Scam,2026-01-01T00:00:00+00:00\n",
        encoding="utf-8",
    )

    for _ in range(2):
        run = run_retraining(
            labeled_dir=labeled_dir,
            report_source=FileReportSource(str(reports_dir)),
            runs_root=runs_root,
            dry_run=True,
        )
        assert run.manifest.n_reports == 1

    assert last_run_time(runs_root) is None


def test_a_real_run_does_advance_the_watermark(labeled_dir, tmp_path):
    runs_root = tmp_path / "runs"
    run_dir = runs_root / "real"
    run_dir.mkdir(parents=True)
    (run_dir / MANIFEST_JSON).write_text(
        json.dumps({"created_at": "2026-08-09T00:00:00+00:00", "dry_run": False}),
        encoding="utf-8",
    )
    assert last_run_time(str(runs_root)) == datetime(2026, 8, 9, tzinfo=timezone.utc)


def test_explicit_since_overrides_the_watermark(labeled_dir, tmp_path):
    runs_root = tmp_path / "runs"
    run_dir = runs_root / "real"
    run_dir.mkdir(parents=True)
    (run_dir / MANIFEST_JSON).write_text(
        json.dumps({"created_at": "2026-08-09T00:00:00+00:00", "dry_run": False}),
        encoding="utf-8",
    )
    reports_dir = tmp_path / "reports"
    reports_dir.mkdir()
    (reports_dir / "batch.csv").write_text(
        "text,label,validated_at\nold report,Scam,2026-01-01T00:00:00+00:00\n",
        encoding="utf-8",
    )

    run = run_retraining(
        labeled_dir=labeled_dir,
        report_source=FileReportSource(str(reports_dir)),
        runs_root=str(runs_root),
        since=datetime.min,
        dry_run=True,
    )
    assert run.manifest.n_reports == 1


# --- promotion gate wiring --------------------------------------------------
def test_evaluate_candidate_scores_both_models_on_the_same_rows(monkeypatch):
    """The pairing is the entire basis of McNemar's test."""
    seen = []

    def fake_predict(model_dir, masked_texts, batch_size=32):
        seen.append((model_dir, list(masked_texts)))
        # Baseline gets the last 20 rows wrong; candidate gets everything right.
        if model_dir == "baseline":
            return [0] * 80 + [0] * 20
        return [0] * 80 + [2] * 20

    monkeypatch.setattr(pl, "_predict", fake_predict)

    val_texts = [f"row {i}" for i in range(100)]
    val_labels = [0] * 80 + [2] * 20
    decision = evaluate_candidate("baseline", "candidate", val_texts, val_labels)

    assert seen[0][1] == seen[1][1] == val_texts
    assert decision.promote
    assert decision.n_fixes == 20
    assert decision.n_regressions == 0


def test_evaluate_candidate_rejects_a_worse_model(monkeypatch):
    def fake_predict(model_dir, masked_texts, batch_size=32):
        if model_dir == "baseline":
            return [0] * 80 + [2] * 20
        return [0] * 80 + [0] * 20

    monkeypatch.setattr(pl, "_predict", fake_predict)

    decision = evaluate_candidate(
        "baseline",
        "candidate",
        [f"row {i}" for i in range(100)],
        [0] * 80 + [2] * 20,
    )
    assert not decision.promote


# --- reporting --------------------------------------------------------------
def test_summary_marks_a_dry_run_as_such(labeled_dir, tmp_path):
    run = run_retraining(labeled_dir=labeled_dir, runs_root=str(tmp_path / "runs"), dry_run=True)
    summary = run.summary()
    assert "DRY RUN" in summary
    assert "no training run" in summary


def test_summary_reports_relabels_when_a_report_corrected_the_dataset(labeled_dir, tmp_path):
    reports_dir = tmp_path / "reports"
    reports_dir.mkdir()
    (reports_dir / "batch.csv").write_text("text,label\nmessage number 3,Scam\n", encoding="utf-8")
    run = run_retraining(
        labeled_dir=labeled_dir,
        report_source=FileReportSource(str(reports_dir)),
        runs_root=str(tmp_path / "runs"),
        dry_run=True,
    )
    assert run.manifest.n_reports_that_relabelled_a_row == 1
    assert "corrected by a validated report" in run.summary()


def test_promoted_is_false_without_a_decision(tmp_path):
    run = RetrainingRun(
        run_dir=str(tmp_path),
        snapshot_dir=str(tmp_path),
        manifest=run_manifest(),
        dry_run=True,
    )
    assert not run.promoted


def run_manifest():
    from retraining.snapshot import SnapshotManifest

    return SnapshotManifest(
        created_at="2026-08-11T00:00:00+00:00",
        seed=42,
        report_source=NullReportSource().describe(),
        max_history=None,
    )
