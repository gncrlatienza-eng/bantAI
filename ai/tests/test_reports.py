"""Unit tests for validated-report sources (WBS 4.3.5)."""

import io
import json
import urllib.error
from datetime import datetime, timezone

import pytest

from retraining.reports import (
    DatabaseReportSource,
    FileReportSource,
    NullReportSource,
    ReportFormatError,
    ReportSourceError,
    ValidatedReport,
    _coerce_label,
)


def write_csv(directory, name, rows, header="text,label"):
    path = directory / name
    path.write_text(header + "\n" + "\n".join(rows) + "\n", encoding="utf-8")
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
        json.dumps({"text": "you won", "label": "Scam", "report_id": "r1"}) + "\n",
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
    """ "0 reports" from a null source and from a live empty store are
    different facts when investigating a regression months later."""
    source = NullReportSource()
    assert list(source.fetch()) == []
    assert "null" in source.describe()
    # It must not read as "the store was empty" -- WBS 4.3.1 exists now, so
    # choosing not to consult it is a decision the manifest has to record.
    assert "consulted" in source.describe()


def test_validated_report_is_hashable_and_frozen():
    report = ValidatedReport(text="x", label="Scam")
    with pytest.raises(Exception):
        report.text = "y"


# --- database source --------------------------------------------------------
# No fake-HTTP pattern existed in this repo before -- test_centroid_source.py
# never covered its backend path, which is how a missing `x-api-key` header
# survived there unnoticed. These helpers establish one.


class _FakeResponse(io.BytesIO):
    """Minimal stand-in for what ``urlopen`` returns: a context-managed reader."""

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False


def fake_urlopen(payload, capture=None, raises=None):
    """Build a ``urlopen`` replacement.

    ``capture`` is a list the outgoing ``Request`` is appended to, so a test can
    assert on the URL and headers actually sent -- not just on what came back.
    """

    def _open(request, timeout=None):
        if capture is not None:
            capture.append(request)
        if raises is not None:
            raise raises
        body = payload if isinstance(payload, (str, bytes)) else json.dumps(payload)
        if isinstance(body, str):
            body = body.encode("utf-8")
        return _FakeResponse(body)

    return _open


def report_row(**overrides):
    """One row shaped like the backend's ``findAll()`` selection."""
    row = {
        "id": "rpt-1",
        "status": "Validated",
        "originalLabel": "Ham",
        "reportedLabel": "Scam",
        "adminNote": None,
        "createdAt": "2026-08-10T09:00:00.000Z",
        "updatedAt": "2026-08-12T14:30:00.000Z",
        "user": {"id": "u1", "phone": "+639171234567"},
        "message": {"id": "m1", "sender": "GCASH", "body": "Your account is suspended."},
    }
    row.update(overrides)
    return row


def db_source(monkeypatch, payload, capture=None, raises=None, api_key="secret"):
    monkeypatch.setattr(
        "urllib.request.urlopen",
        fake_urlopen(payload, capture=capture, raises=raises),
    )
    return DatabaseReportSource("http://localhost:3000/api", api_key)


def test_maps_backend_fields_onto_a_validated_report(monkeypatch):
    """message.body -> text, reportedLabel -> label, id, updatedAt."""
    (report,) = db_source(monkeypatch, [report_row()]).fetch()
    assert report.text == "Your account is suspended."
    assert report.label == "Scam"
    assert report.report_id == "rpt-1"
    assert report.validated_at == datetime(2026, 8, 12, 14, 30, tzinfo=timezone.utc)


def test_reported_label_wins_over_original_label(monkeypatch):
    """originalLabel is the mistake being corrected; training on it would
    teach the model to repeat exactly what was reported."""
    (report,) = db_source(monkeypatch, [report_row(originalLabel="Scam", reportedLabel="Ham")]).fetch()
    assert report.label == "Ham"


def test_only_validated_rows_are_kept(monkeypatch):
    """There is no server-side Validated filter -- findAll() returns every
    status -- so the filter has to hold here or the trigger's guarantee (a
    retrain fires on *validated* counts) is worthless."""
    payload = [
        report_row(id="a", status="Validated"),
        report_row(id="b", status="Pending"),
        report_row(id="c", status="Rejected"),
    ]
    kept = db_source(monkeypatch, payload).fetch()
    assert [r.report_id for r in kept] == ["a"]


def test_the_api_key_header_is_actually_sent(monkeypatch):
    sent = []
    db_source(monkeypatch, [], capture=sent, api_key="s3cret").fetch()
    (request,) = sent
    assert request.full_url == "http://localhost:3000/api/reports"
    # urllib title-cases header names on the Request object.
    assert request.get_header("X-api-key") == "s3cret"


def test_base_url_trailing_slash_does_not_double_up(monkeypatch):
    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen([]))
    source = DatabaseReportSource("http://localhost:3000/api/", "k")
    assert source.url == "http://localhost:3000/api/reports"


def test_since_filters_on_updated_at(monkeypatch):
    payload = [
        report_row(id="old", updatedAt="2026-08-01T00:00:00.000Z"),
        report_row(id="new", updatedAt="2026-08-20T00:00:00.000Z"),
    ]
    kept = db_source(monkeypatch, payload).fetch(since=datetime(2026, 8, 10, tzinfo=timezone.utc))
    assert [r.report_id for r in kept] == ["new"]


def test_rows_without_a_timestamp_are_kept(monkeypatch):
    """Same rule as FileReportSource: excluding a real correction over missing
    metadata is worse than re-consuming one the snapshot de-duplicates."""
    payload = [report_row(id="undated", updatedAt=None)]
    kept = db_source(monkeypatch, payload).fetch(since=datetime(2026, 8, 10, tzinfo=timezone.utc))
    assert [r.report_id for r in kept] == ["undated"]


# --- failures raise; they never degrade to "no corrections were filed" ------
def test_unreachable_backend_raises_and_does_not_return_empty(monkeypatch):
    """The dangerous regression is not a crash -- it is a clean run that
    trains on none of the corrections that triggered it."""
    source = db_source(monkeypatch, None, raises=urllib.error.URLError("connection refused"))
    with pytest.raises(ReportSourceError) as exc:
        source.fetch()
    assert "backend running" in str(exc.value)


def test_401_says_the_key_is_the_problem(monkeypatch):
    http_error = urllib.error.HTTPError("http://localhost:3000/api/reports", 401, "Unauthorized", {}, None)
    source = db_source(monkeypatch, None, raises=http_error)
    with pytest.raises(ReportSourceError) as exc:
        source.fetch()
    message = str(exc.value)
    assert "401" in message
    assert "INTERNAL_API_KEY" in message


def test_non_json_response_raises(monkeypatch):
    source = db_source(monkeypatch, "<html>502 Bad Gateway</html>")
    with pytest.raises(ReportSourceError):
        source.fetch()


def test_a_json_object_instead_of_a_list_raises(monkeypatch):
    """A future paginated `{items: [...]}` shape must fail loudly, not read as
    zero reports."""
    source = db_source(monkeypatch, {"items": [report_row()]})
    with pytest.raises(ReportSourceError):
        source.fetch()


def test_validated_report_with_no_message_body_raises(monkeypatch):
    source = db_source(monkeypatch, [report_row(message={"id": "m1", "body": ""})])
    with pytest.raises(ReportFormatError):
        source.fetch()


def test_unrecognised_reported_label_raises(monkeypatch):
    source = db_source(monkeypatch, [report_row(reportedLabel="Phishing")])
    with pytest.raises(ReportFormatError):
        source.fetch()


# --- describe ---------------------------------------------------------------
def test_describe_is_correct_before_any_fetch(monkeypatch):
    """pipeline.run_retraining passes fetch(...) and describe() as sibling
    arguments, so describe must never depend on a fetch having run."""
    source = DatabaseReportSource("http://localhost:3000/api", "k")
    described = source.describe()
    assert described.startswith("database:http://localhost:3000/api/reports")
    assert "Validated" in described


def test_describe_reports_real_counts_after_a_fetch(monkeypatch):
    """ "0 of 40" and "0 of 0" are different facts about the same retrain."""
    payload = [report_row(id="a"), report_row(id="b", status="Pending")]
    source = db_source(monkeypatch, payload)
    source.fetch()
    assert "1 of 2 reports" in source.describe()
