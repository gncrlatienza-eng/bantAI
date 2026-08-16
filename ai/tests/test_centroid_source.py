"""Unit tests for campaign centroid loading (WBS 3.3.4 wiring).

Covers the file path (live today) and the backend path (written, switched off
until the backend returns the `centroid` field -- see service/centroid_source.py).
"""

import json

from service.centroid_source import load_centroids, load_from_file


def write_clusters(tmp_path, clusters):
    path = tmp_path / "campaign_clusters.json"
    path.write_text(json.dumps({"clusters": clusters}), encoding="utf-8")
    return str(path)


# --- file source ------------------------------------------------------------
def test_loads_centroids_from_file(tmp_path):
    path = write_clusters(
        tmp_path,
        [
            {"cluster_id": 3, "centroid": [1.0, 0.0], "top_domains": ["bit.ly"]},
            {"cluster_id": 7, "centroid": [0.0, 1.0], "top_domains": []},
        ],
    )
    centroids = load_from_file(path)
    assert [c.cluster_id for c in centroids] == ["3", "7"]
    assert centroids[0].url_domains == ["bit.ly"]


def test_cluster_id_is_stringified(tmp_path):
    """Cluster ids arrive as ints from HDBSCAN but are strings everywhere
    downstream (API field, database id)."""
    path = write_clusters(tmp_path, [{"cluster_id": 12, "centroid": [1.0]}])
    assert load_from_file(path)[0].cluster_id == "12"


def test_missing_file_is_a_cold_start_not_an_error(tmp_path):
    """No clustering run yet is a valid state, not a crash."""
    assert load_from_file(str(tmp_path / "nope.json")) == []


def test_clusters_without_a_centroid_are_skipped(tmp_path):
    path = write_clusters(
        tmp_path,
        [{"cluster_id": 1, "centroid": []}, {"cluster_id": 2, "centroid": [1.0]}],
    )
    assert [c.cluster_id for c in load_from_file(path)] == ["2"]


# --- load_centroids dispatch ------------------------------------------------
def test_source_none_disables_matching(tmp_path):
    path = write_clusters(tmp_path, [{"cluster_id": 1, "centroid": [1.0]}])
    assert load_centroids(source="none", cluster_file=path) == []


def test_source_file_reads_the_file(tmp_path):
    path = write_clusters(tmp_path, [{"cluster_id": 1, "centroid": [1.0]}])
    assert len(load_centroids(source="file", cluster_file=path)) == 1


def test_unreadable_source_degrades_instead_of_raising(tmp_path):
    """Campaign matching is an enhancement -- a bad centroid file must never
    stop the service from classifying messages."""
    bad = tmp_path / "bad.json"
    bad.write_text("{not valid json", encoding="utf-8")
    assert load_centroids(source="file", cluster_file=str(bad)) == []


def test_backend_source_falls_back_when_unreachable():
    assert load_centroids(source="backend", backend_url="http://127.0.0.1:9/api") == []


class _FakeResponse:
    """Stands in for urllib's response object."""

    def __init__(self, payload):
        self._body = json.dumps(payload).encode("utf-8")

    def read(self):
        return self._body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


def test_backend_parses_cluster_payload(monkeypatch):
    """Exercises the real parsing against a backend-shaped payload, so the
    day `centroid` starts being returned this simply begins working."""
    import urllib.request

    payload = [
        {"id": "abc", "centroid": [1.0, 0.0], "urlDomains": ["bit.ly"], "label": "gambling"},
        {"id": "def", "centroid": [0.0, 1.0], "urlDomains": []},
    ]
    monkeypatch.setattr(urllib.request, "urlopen", lambda url, timeout=5.0: _FakeResponse(payload))

    result = load_centroids(source="backend", backend_url="http://x/api")
    assert [c.cluster_id for c in result] == ["abc", "def"]
    assert result[0].url_domains == ["bit.ly"]
    assert result[0].label == "gambling"


def test_backend_skips_clusters_missing_a_centroid(monkeypatch):
    """Exactly today's situation: the backend returns campaigns but omits the
    centroid field. Skip them rather than crash the service on startup."""
    import urllib.request

    payload = [
        {"id": "abc", "urlDomains": [], "messageCount": 12},  # no centroid
        {"id": "def", "centroid": [0.0, 1.0], "urlDomains": []},
    ]
    monkeypatch.setattr(urllib.request, "urlopen", lambda url, timeout=5.0: _FakeResponse(payload))

    result = load_centroids(source="backend", backend_url="http://x/api")
    assert [c.cluster_id for c in result] == ["def"]
