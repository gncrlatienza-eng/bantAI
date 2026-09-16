"""Tests for scripts/sync_campaigns_to_backend.py."""

import importlib.util
import os
import sys

import pytest

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SPEC = importlib.util.spec_from_file_location(
    "sync_campaigns_to_backend", os.path.join(_AI_DIR, "scripts", "sync_campaigns_to_backend.py")
)
sync_mod = importlib.util.module_from_spec(_SPEC)
sys.modules["sync_campaigns_to_backend"] = sync_mod
_SPEC.loader.exec_module(sync_mod)


def cluster(cid, scam, spam, domains, centroid=(0.1, 0.2)):
    return {
        "cluster_id": cid,
        "labels": {"Scam": scam, "Spam": spam},
        "top_domains": list(domains),
        "centroid": list(centroid),
        "lexical": {"shingles": ["x"], "domains": list(domains)},
    }


# --- which domains may be used for link suppression ---------------------
def test_spam_cluster_contributes_no_domains():
    """Spam is honest marketing -- hiding its links would hide official promos."""
    assert sync_mod.suppression_domains(cluster(1, 0, 40, ["glbe.co", "evil.xyz"])) == []


def test_tied_cluster_contributes_no_domains():
    assert sync_mod.suppression_domains(cluster(1, 5, 5, ["evil.xyz"])) == []


def test_scam_cluster_drops_official_domains_and_their_subdomains():
    domains = ["gcash-verify.xyz", "go.gcash.com", "s.lazada.com.ph", "globe.com.ph"]
    assert sync_mod.suppression_domains(cluster(1, 30, 1, domains)) == ["gcash-verify.xyz"]


def test_scam_cluster_drops_shared_platforms_and_shorteners():
    """Hiding facebook.com would hide every ordinary Facebook link from non-contacts."""
    domains = ["facebook.com", "m.facebook.com", "onelink.to", "bit.ly", "winplus.vegas"]
    assert sync_mod.suppression_domains(cluster(1, 30, 0, domains)) == ["winplus.vegas"]


def test_scam_cluster_drops_malformed_hostnames_and_duplicates():
    domains = ["jackpotcity.vegas!", 'mon21.com"', "BDO.mom", "bdo.mom"]
    assert sync_mod.suppression_domains(cluster(1, 30, 0, domains)) == ["bdo.mom"]


# --- payload shape -------------------------------------------------------
def test_payload_has_only_fields_the_backend_accepts():
    """The backend rejects unknown fields, and has no column for ``lexical``."""
    (payload,) = sync_mod.build_payloads({"clusters": [cluster(7, 10, 0, ["evil.xyz"])]})
    assert payload == {"label": "cluster-7", "centroid": [0.1, 0.2], "urlDomains": ["evil.xyz"]}


def test_clusters_without_a_centroid_are_skipped():
    data = {"clusters": [cluster(1, 1, 0, [], centroid=()), cluster(2, 1, 0, [])]}
    assert [p["label"] for p in sync_mod.build_payloads(data)] == ["cluster-2"]


# --- rate limiting -------------------------------------------------------
class FakeResponse:
    def __init__(self, body):
        self._body = body

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False

    def read(self):
        return self._body


def test_request_waits_and_retries_when_rate_limited(monkeypatch):
    """The backend allows 120 req/min; a full sync needs ~520, so a 429 is expected."""
    import urllib.error

    calls, sleeps = [], []

    def fake_urlopen(req, timeout):
        calls.append(req.full_url)
        if len(calls) == 1:
            raise urllib.error.HTTPError(req.full_url, 429, "Too Many Requests", {"Retry-After-global": "7"}, None)
        return FakeResponse(b'{"id": "new-1"}')

    monkeypatch.setattr(sync_mod.urllib.request, "urlopen", fake_urlopen)
    monkeypatch.setattr(sync_mod.time, "sleep", sleeps.append)

    result = sync_mod.make_request("http://backend/api", "key")("POST", "/campaigns", {"label": "x"})

    assert result == {"id": "new-1"}
    assert len(calls) == 2
    assert sleeps == [8]


def test_request_does_not_retry_other_errors(monkeypatch):
    import urllib.error

    def fake_urlopen(req, timeout):
        raise urllib.error.HTTPError(req.full_url, 401, "Unauthorized", {}, None)

    monkeypatch.setattr(sync_mod.urllib.request, "urlopen", fake_urlopen)
    with pytest.raises(urllib.error.HTTPError):
        sync_mod.make_request("http://backend/api", "key")("GET", "/campaigns/centroids")


# --- sync ordering -------------------------------------------------------
class FakeBackend:
    def __init__(self, active_ids, fail_on_create=None):
        self.calls = []
        self.active_ids = active_ids
        self.fail_on_create = fail_on_create
        self._n = 0

    def __call__(self, method, path, body):
        self.calls.append((method, path))
        if method == "GET":
            return [{"id": i, "centroid": [0.0]} for i in self.active_ids]
        if method == "POST":
            self._n += 1
            if self._n == self.fail_on_create:
                raise RuntimeError("backend error")
            return {"id": f"new-{self._n}"}
        return None


def test_creates_all_new_before_deactivating_any_old():
    backend = FakeBackend(active_ids=["old-a", "old-b"])
    created, deactivated = sync_mod.sync([{"label": "x"}, {"label": "y"}], backend)

    assert created == ["new-1", "new-2"]
    assert deactivated == ["old-a", "old-b"]
    methods = [m for m, _ in backend.calls]
    assert methods.index("PATCH") > max(i for i, m in enumerate(methods) if m == "POST")


def test_failed_create_rolls_back_new_and_leaves_old_active():
    backend = FakeBackend(active_ids=["old-a"], fail_on_create=2)
    with pytest.raises(RuntimeError):
        sync_mod.sync([{"label": "x"}, {"label": "y"}, {"label": "z"}], backend)

    patched = [p for m, p in backend.calls if m == "PATCH"]
    assert patched == ["/campaigns/new-1/deactivate"]
