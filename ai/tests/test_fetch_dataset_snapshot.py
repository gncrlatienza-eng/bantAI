import importlib.util
import io
import json
import os

_PATH = os.path.join(os.path.dirname(__file__), "..", "scripts", "fetch_dataset_snapshot.py")
_spec = importlib.util.spec_from_file_location("fetch_dataset_snapshot", _PATH)
fetch = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fetch)

SNAPSHOT = {
    "versionTag": "ds-1",
    "createdAt": "2026-10-01T00:00:00.000Z",
    "items": [
        {
            "sampleId": "s1",
            "sampleVersion": 2,
            "maskedText": "Claim at [URL]",
            "label": "Scam",
            "language": "en",
            "provenance": "report",
        },
    ],
}


class _Resp(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_fetch_sends_the_datasets_key_and_quotes_the_tag():
    seen = {}

    def opener(request, timeout):
        seen["url"] = request.full_url
        seen["key"] = request.get_header("X-api-key")
        return _Resp(json.dumps(SNAPSHOT).encode())

    assert fetch.fetch_snapshot("http://b/api/", "k", "ds 1", opener=opener) == SNAPSHOT
    assert seen == {"url": "http://b/api/internal/datasets/snapshots/ds%201", "key": "k"}


def test_rows_match_the_admin_jsonl_export_shape(tmp_path):
    rows = fetch.snapshot_to_rows(SNAPSHOT)
    assert rows == [
        {
            "text": "Claim at [URL]",
            "label": "Scam",
            "report_id": "s1@v2",
            "validated_at": "2026-10-01T00:00:00.000Z",
            "language": "en",
            "provenance": "report",
            "dataset_version": "ds-1",
        }
    ]
    path = fetch.write_jsonl(rows, str(tmp_path), "ds-1")
    assert json.loads(open(path, encoding="utf-8").readline())["dataset_version"] == "ds-1"
