"""The automated, CI-safe half of WBS 4.4.3 -- integration test: full
retraining round trip (report -> validate -> retrain -> deploy).

Before this, the round trip had two real gaps, both on the AI side:
``retraining.service.ts`` (backend) posted to ``{AI_SERVICE_URL}/retrain``
and got a 404, caught as a warning; and ``pipeline.py`` never told
``ModelVersions`` about a candidate, so the table stayed empty and the
backend's own F1-degradation trigger and rollback route were dead code.

This test walks every stage with everything stubbed -- no GPU, no Docker, no
real network -- proving the wiring rather than the model:

    validated report (stubbed backend)
        -> DatabaseReportSource.fetch()
        -> a gate verdict (stubbed _predict, same pattern as
           test_retraining_pipeline.py)
        -> ModelRegistry.register() / .activate() (stubbed backend)
        -> version_file.write_version() / read_version()
           (the served version_tag actually changes)

The live counterpart -- real backend, real AI service, a real forward pass --
is ``scripts/round_trip.py``, meant to be run by hand as the WBS 4.5.1 demo,
not as a CI gate.
"""

from __future__ import annotations

import io
import json
import urllib.error
import urllib.request

import pytest
from fastapi.testclient import TestClient

from retraining import pipeline as pl
from retraining.pipeline import evaluate_candidate
from retraining.registry import ModelRegistry, ModelRegistryError
from retraining.reports import DatabaseReportSource
from retraining.version_file import read_version, write_version
from service import retrain_queue
from service.main import app
from service.routers import retrain as retrain_router

# Not entered as `with TestClient(app) as client`, matching test_service.py --
# that would run the FastAPI lifespan (campaign centroid load + the WBS 4.4.3
# version check), which is exactly the network activity these tests stub out.
client = TestClient(app)


# --- shared urlopen stub (mirrors tests/test_reports.py) -------------------- #
class _FakeResponse(io.BytesIO):
    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()
        return False


def fake_urlopen(payload, capture=None, raises=None):
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


# =============================================================================
# Stage: trigger -- POST /retrain used to 404. Now it queues.
# =============================================================================
@pytest.fixture
def queue_path(tmp_path, monkeypatch):
    path = str(tmp_path / "queue.jsonl")
    monkeypatch.setattr(retrain_router.settings, "retrain_queue_path", path)
    return path


def test_retrain_endpoint_accepts_and_queues(queue_path):
    resp = client.post("/retrain", json={"trigger": "validated_report_count"})
    assert resp.status_code == 202
    body = resp.json()
    assert body["status"] == "queued"
    assert body["trigger"] == "validated_report_count"
    assert body["job_id"]


def test_repeated_trigger_dedupes_to_the_same_job(queue_path):
    """The backend's hourly cron re-fires every hour until a model is
    promoted. Without dedupe the queue grows one row per hour, forever."""
    first = client.post("/retrain", json={"trigger": "f1_degradation"}).json()
    second = client.post("/retrain", json={"trigger": "f1_degradation"}).json()
    assert first["job_id"] == second["job_id"]

    jobs = client.get("/retrain/jobs").json()["jobs"]
    assert len([j for j in jobs if j["trigger"] == "f1_degradation"]) == 1


def test_different_triggers_queue_separately(queue_path):
    a = client.post("/retrain", json={"trigger": "f1_degradation"}).json()
    b = client.post("/retrain", json={"trigger": "page_hinkley_drift"}).json()
    assert a["job_id"] != b["job_id"]


def test_jobs_endpoint_lists_what_was_queued(queue_path):
    assert client.get("/retrain/jobs").json()["jobs"] == []
    client.post("/retrain", json={"trigger": "validated_report_count"})
    jobs = client.get("/retrain/jobs").json()["jobs"]
    assert [j["trigger"] for j in jobs] == ["validated_report_count"]


def test_empty_trigger_is_rejected(queue_path):
    resp = client.post("/retrain", json={"trigger": ""})
    assert resp.status_code == 422


def test_enqueue_helper_is_reusable_outside_the_http_layer(tmp_path):
    """service/retrain_queue.py's functions are what the router calls --
    tested directly too, since a router-only test would miss a bug in the
    dedupe logic that happened to look right through the one path HTTP
    tests exercise."""
    path = str(tmp_path / "queue.jsonl")
    job = retrain_queue.enqueue(path, "validated_report_count")
    same = retrain_queue.enqueue(path, "validated_report_count")
    assert job.job_id == same.job_id
    assert retrain_queue.list_jobs(path) == [job]


# =============================================================================
# Stage: register / activate -- ModelVersions used to stay empty forever.
# =============================================================================
def test_register_posts_the_expected_payload_and_returns_the_id(monkeypatch):
    sent = []
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen({"id": "mv-1"}, capture=sent))

    model_id = ModelRegistry("http://localhost:3000/api", "secret").register(
        version_tag="v2026-08-17T04-15-33Z", f1_score=0.9648, notes="97 fixes vs 44 regressions"
    )

    assert model_id == "mv-1"
    (request,) = sent
    assert request.full_url == "http://localhost:3000/api/models"
    assert request.get_header("X-api-key") == "secret"
    body = json.loads(request.data.decode("utf-8"))
    assert body == {
        "versionTag": "v2026-08-17T04-15-33Z",
        "f1Score": 0.9648,
        "notes": "97 fixes vs 44 regressions",
    }


def test_register_without_an_id_in_the_response_raises(monkeypatch):
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen({}))
    with pytest.raises(ModelRegistryError):
        ModelRegistry("http://localhost:3000/api", "k").register("v1", 0.9)


def test_register_401_hints_at_the_api_key(monkeypatch):
    err = urllib.error.HTTPError("http://x/models", 401, "Unauthorized", {}, None)
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen(None, raises=err))
    with pytest.raises(ModelRegistryError, match="INTERNAL_API_KEY"):
        ModelRegistry("http://localhost:3000/api", "k").register("v1", 0.9)


def test_register_409_hints_at_a_duplicate_tag(monkeypatch):
    err = urllib.error.HTTPError("http://x/models", 409, "Conflict", {}, None)
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen(None, raises=err))
    with pytest.raises(ModelRegistryError, match="already registered"):
        ModelRegistry("http://localhost:3000/api", "k").register("v1", 0.9)


def test_activate_posts_to_the_right_url(monkeypatch):
    sent = []
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen({}, capture=sent))
    ModelRegistry("http://localhost:3000/api", "k").activate("mv-1")
    (request,) = sent
    assert request.full_url == "http://localhost:3000/api/models/mv-1/activate"
    assert request.get_method() == "POST"


def test_get_active_returns_none_when_the_backend_says_so(monkeypatch):
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen(None))
    assert ModelRegistry("http://localhost:3000/api", "k").get_active() is None


def test_get_active_is_a_get_not_a_post(monkeypatch):
    sent = []
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen({"versionTag": "v1"}, capture=sent))
    active = ModelRegistry("http://localhost:3000/api", "k").get_active()
    assert active == {"versionTag": "v1"}
    assert sent[0].get_method() == "GET"


def test_unreachable_backend_raises_not_degrades(monkeypatch):
    monkeypatch.setattr(
        urllib.request, "urlopen", fake_urlopen(None, raises=urllib.error.URLError("connection refused"))
    )
    with pytest.raises(ModelRegistryError, match="backend running"):
        ModelRegistry("http://localhost:3000/api", "k").register("v1", 0.9)


# =============================================================================
# Stage: deploy -- version.json is how a served checkpoint says who it is.
# =============================================================================
def test_version_round_trips_through_the_file(tmp_path):
    write_version(str(tmp_path), "v2026-08-17T04-15-33Z")
    assert read_version(str(tmp_path)) == "v2026-08-17T04-15-33Z"


def test_version_hashes_the_weights_file_when_present(tmp_path):
    (tmp_path / "model.safetensors").write_bytes(b"pretend weights")
    write_version(str(tmp_path), "v1")
    payload = json.loads((tmp_path / "version.json").read_text(encoding="utf-8"))
    assert payload["sha256"] == __import__("hashlib").sha256(b"pretend weights").hexdigest()


def test_version_is_null_without_weights(tmp_path):
    write_version(str(tmp_path), "v1")
    payload = json.loads((tmp_path / "version.json").read_text(encoding="utf-8"))
    assert payload["sha256"] is None


def test_read_version_is_none_for_a_pre_wbs_4_4_3_checkpoint(tmp_path):
    """No version.json at all -- true of every checkpoint deployed before
    this existed, including the one currently live."""
    assert read_version(str(tmp_path)) is None


def test_health_endpoint_reports_the_served_version(tmp_path, monkeypatch):
    from service.routers import health as health_router

    write_version(str(tmp_path), "v2026-08-17T04-15-33Z")
    monkeypatch.setattr(health_router.settings, "model_dir", str(tmp_path))

    resp = client.get("/health")
    assert resp.json()["version_tag"] == "v2026-08-17T04-15-33Z"


def test_health_endpoint_is_null_before_any_version_is_recorded(tmp_path, monkeypatch):
    from service.routers import health as health_router

    monkeypatch.setattr(health_router.settings, "model_dir", str(tmp_path))
    resp = client.get("/health")
    assert resp.json()["version_tag"] is None


# =============================================================================
# The full chain: report -> gate -> register -> activate -> deploy
# =============================================================================
def test_the_whole_round_trip_with_everything_stubbed(monkeypatch, tmp_path):
    """One test walking every stage 4.4.3 needed, end to end.

    Each piece already has its own focused tests above (and, for the
    report -> snapshot half, in test_retraining_pipeline.py's
    ``test_dry_run_includes_reports_from_the_database_source``). This one
    exists because the pieces being individually correct does not prove they
    compose -- a version_tag typo between ``pipeline.py`` and ``registry.py``
    would pass every test above and still break the real round trip.
    """
    # 1. A validated report, from a stubbed backend -- same shape
    #    scripts/round_trip.py's live phase 1/2 exercise for real.
    report_payload = [
        {
            "id": "rpt-1",
            "status": "Validated",
            "reportedLabel": "Scam",
            "updatedAt": "2026-08-17T00:00:00.000Z",
            "message": {"id": "m1", "body": "you won a prize, claim at http://x.ph"},
        }
    ]
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen(report_payload))
    reports = DatabaseReportSource("http://localhost:3000/api", "k").fetch()
    assert len(reports) == 1

    # 2. A gate verdict -- _predict stubbed, same pattern as
    #    test_retraining_pipeline.py's test_evaluate_candidate_* tests.
    def fake_predict(model_dir, texts, batch_size=32):
        # 80 rows both get right; baseline misses the last 20, candidate
        # fixes all of them -- same shape as
        # test_retraining_pipeline.py's test_evaluate_candidate_scores_both_models_on_the_same_rows,
        # large enough for McNemar to call it significant.
        return [0] * 80 + ([0] * 20 if model_dir == "baseline" else [2] * 20)

    monkeypatch.setattr(pl, "_predict", fake_predict)
    val_texts = [f"row {i}" for i in range(100)]
    val_labels = [0] * 80 + [2] * 20
    candidate_dir = tmp_path / "candidate"
    candidate_dir.mkdir()
    decision = evaluate_candidate("baseline", str(candidate_dir), val_texts, val_labels)
    assert decision.promote

    version_tag = "v2026-08-17T04-15-33Z"
    write_version(str(candidate_dir), version_tag)

    # 3. Register (inactive) then activate -- the two flags scripts/retrain.py
    #    gates this behind, exercised together here as the "adviser said yes"
    #    path.
    sent = []
    monkeypatch.setattr(urllib.request, "urlopen", fake_urlopen({"id": "mv-2"}, capture=sent))
    registry = ModelRegistry("http://localhost:3000/api", "k")
    model_id = registry.register(version_tag, decision.candidate_macro_f1, notes=decision.reason)
    registry.activate(model_id)

    assert sent[0].full_url == "http://localhost:3000/api/models"
    assert sent[1].full_url == f"http://localhost:3000/api/models/{model_id}/activate"

    # 4. Deploy -- "point the live model at candidate_dir" is the one manual
    #    step left (see scripts/retrain.py's printed instructions); what
    #    changes automatically is what /health reports once that happens.
    from service.routers import health as health_router

    monkeypatch.setattr(health_router.settings, "model_dir", str(candidate_dir))
    resp = client.get("/health")
    assert resp.json()["version_tag"] == version_tag
