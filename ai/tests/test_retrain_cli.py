"""Unit tests for the retraining CLI's source resolution (WBS 4.3.5).

Only the argument-to-source wiring is covered here -- the pipeline itself is
tested in ``test_retraining_pipeline.py``. What matters at this layer is that
a report store is never consulted by accident and never *skipped* by accident,
since both mistakes produce a run that looks entirely normal afterwards.
"""

import importlib.util
import os
import sys

import pytest

from retraining.reports import DatabaseReportSource, FileReportSource, NullReportSource

# scripts/ is not a package (the scripts insert "." on sys.path and are run as
# files), so load retrain.py by path rather than importing it.
_SPEC = importlib.util.spec_from_file_location(
    "retrain_cli",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "retrain.py"),
)
retrain = importlib.util.module_from_spec(_SPEC)
sys.modules["retrain_cli"] = retrain
_SPEC.loader.exec_module(retrain)


def resolve(argv, env=None, monkeypatch=None):
    """Parse ``argv`` and resolve a report source from it."""
    for name in (retrain.ENV_BACKEND_URL, retrain.ENV_BACKEND_API_KEY):
        monkeypatch.delenv(name, raising=False)
    for name, value in (env or {}).items():
        monkeypatch.setenv(name, value)
    args = retrain.build_parser().parse_args(argv)
    return retrain._build_report_source(args)


# --- the default ------------------------------------------------------------
def test_no_flags_gives_the_null_source(monkeypatch):
    source, error = resolve([], monkeypatch=monkeypatch)
    assert error is None
    assert isinstance(source, NullReportSource)


def test_environment_alone_never_turns_the_database_on(monkeypatch):
    """A configured backend URL is not consent to consult it. Inferring the
    source from ambient environment is how a run ends up reporting reports it
    was never asked to fetch -- or, worse, silently switching stores between
    two runs someone is comparing."""
    source, error = resolve(
        [],
        env={
            retrain.ENV_BACKEND_URL: "http://localhost:3000/api",
            retrain.ENV_BACKEND_API_KEY: "k",
        },
        monkeypatch=monkeypatch,
    )
    assert error is None
    assert isinstance(source, NullReportSource)


# --- file source ------------------------------------------------------------
def test_reports_dir_gives_a_file_source(tmp_path, monkeypatch):
    source, error = resolve(["--reports-dir", str(tmp_path)], monkeypatch=monkeypatch)
    assert error is None
    assert isinstance(source, FileReportSource)


def test_missing_reports_dir_is_an_error(tmp_path, monkeypatch):
    source, error = resolve(["--reports-dir", str(tmp_path / "nope")], monkeypatch=monkeypatch)
    assert source is None
    assert "does not exist" in error


# --- database source --------------------------------------------------------
def test_explicit_url_and_key_give_a_database_source(monkeypatch):
    source, error = resolve(
        ["--reports-url", "http://localhost:3000/api", "--reports-api-key", "k"],
        monkeypatch=monkeypatch,
    )
    assert error is None
    assert isinstance(source, DatabaseReportSource)
    assert source.url == "http://localhost:3000/api/reports"
    assert source.api_key == "k"


def test_bare_flag_resolves_both_values_from_the_environment(monkeypatch):
    source, error = resolve(
        ["--reports-url"],
        env={
            retrain.ENV_BACKEND_URL: "http://backend:3000/api",
            retrain.ENV_BACKEND_API_KEY: "envkey",
        },
        monkeypatch=monkeypatch,
    )
    assert error is None
    assert source.url == "http://backend:3000/api/reports"
    assert source.api_key == "envkey"


def test_bare_flag_with_no_environment_is_an_error(monkeypatch):
    source, error = resolve(["--reports-url"], monkeypatch=monkeypatch)
    assert source is None
    assert retrain.ENV_BACKEND_URL in error


def test_missing_api_key_fails_before_any_work(monkeypatch):
    """Checked up front so a wrong key costs a line of output rather than a
    snapshot build followed by a 401."""
    source, error = resolve(["--reports-url", "http://localhost:3000/api"], monkeypatch=monkeypatch)
    assert source is None
    assert retrain.ENV_BACKEND_API_KEY in error


def test_the_two_sources_are_mutually_exclusive(tmp_path, monkeypatch):
    source, error = resolve(
        ["--reports-dir", str(tmp_path), "--reports-url", "http://x/api"],
        monkeypatch=monkeypatch,
    )
    assert source is None
    assert "mutually exclusive" in error


def test_export_implies_the_database(monkeypatch):
    """Exporting *is* a database operation; requiring --reports-url alongside
    it would be ceremony."""
    source, error = resolve(
        ["--export-reports", "out.csv"],
        env={
            retrain.ENV_BACKEND_URL: "http://localhost:3000/api",
            retrain.ENV_BACKEND_API_KEY: "k",
        },
        monkeypatch=monkeypatch,
    )
    assert error is None
    assert isinstance(source, DatabaseReportSource)


# --- export -----------------------------------------------------------------
class _StubSource:
    def __init__(self, reports):
        self._reports = reports

    def fetch(self, since=None):
        return self._reports

    def describe(self):
        return "database:stub (status=Validated)"


def test_export_writes_the_documented_columns(tmp_path, capsys):
    from datetime import datetime, timezone

    from retraining.reports import ValidatedReport

    out = tmp_path / "nested" / "validated.csv"
    reports = [
        ValidatedReport(
            text="Your account is suspended.",
            label="Scam",
            report_id="rpt-1",
            validated_at=datetime(2026, 8, 12, 14, 30, tzinfo=timezone.utc),
        ),
        ValidatedReport(text="undated one", label="Ham"),
    ]

    assert retrain._export_reports(_StubSource(reports), str(out)) == 0

    lines = out.read_text(encoding="utf-8").splitlines()
    # Exactly the header datasets/reports/README.md documents, so the file
    # drops straight into --reports-dir on the GPU machine.
    assert lines[0] == "text,label,report_id,validated_at"
    assert lines[1] == "Your account is suspended.,Scam,rpt-1,2026-08-12T14:30:00+00:00"
    assert lines[2] == "undated one,Ham,,"


def test_export_round_trips_through_the_file_source(tmp_path):
    """The export is only useful if FileReportSource can read it back -- that
    round trip is the entire point of the flag."""
    from datetime import datetime, timezone

    from retraining.reports import ValidatedReport

    out = tmp_path / "validated.csv"
    original = ValidatedReport(
        text="you won a prize",
        label="Scam",
        report_id="rpt-9",
        validated_at=datetime(2026, 8, 12, 14, 30, tzinfo=timezone.utc),
    )
    retrain._export_reports(_StubSource([original]), str(out))

    (restored,) = list(FileReportSource(str(tmp_path)).fetch())
    assert restored == original


def test_empty_export_says_so_out_loud(tmp_path, capsys):
    """A silent empty CSV is how a GPU run "includes reports" while consuming
    none."""
    out = tmp_path / "validated.csv"
    retrain._export_reports(_StubSource([]), str(out))
    assert "consumes no corrections" in capsys.readouterr().out


# --- main() exit codes ------------------------------------------------------
def test_main_exits_2_on_a_bad_source(monkeypatch, capsys):
    monkeypatch.delenv(retrain.ENV_BACKEND_API_KEY, raising=False)
    code = retrain.main(["--reports-url", "http://localhost:3000/api", "--dry-run"])
    assert code == 2
    assert "error:" in capsys.readouterr().err


def test_main_exits_1_when_the_report_store_is_unreachable(monkeypatch, tmp_path, capsys):
    """Exit 1, not 0: the run is abandoned rather than completed without the
    corrections that justified it."""
    import urllib.error
    import urllib.request

    def _boom(request, timeout=None):
        raise urllib.error.URLError("connection refused")

    monkeypatch.setattr(urllib.request, "urlopen", _boom)

    labeled = tmp_path / "labeled"
    labeled.mkdir()
    (labeled / "d.csv").write_text(
        "text,label\n" + "\n".join(f"message {i},Ham" for i in range(20)) + "\n",
        encoding="utf-8",
    )

    code = retrain.main(
        [
            "--dry-run",
            "--labeled-dir",
            str(labeled),
            "--runs-root",
            str(tmp_path / "runs"),
            "--reports-url",
            "http://localhost:3000/api",
            "--reports-api-key",
            "k",
        ]
    )
    assert code == 1
    assert "backend running" in capsys.readouterr().err


@pytest.mark.parametrize("bad", ["not-a-date", "2026-13-99"])
def test_main_rejects_an_unparseable_since(bad, capsys):
    assert retrain.main(["--since", bad, "--dry-run"]) == 2
    assert "ISO-8601" in capsys.readouterr().err
