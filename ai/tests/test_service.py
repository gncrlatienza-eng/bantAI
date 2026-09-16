"""API tests for the FastAPI ML service.

The "no model loaded" contract (/health reports model_ready=False, /classify
returns 503 while still masking PII) is tested against a classifier pointed at
an empty directory, not the module-level singleton -- a real fine-tuned model
now lives at ai/models/xlm-roberta-smishing/, so asserting on global state
would pass or fail depending on whether that model happens to be installed.
Requires fastapi + httpx (see requirements.txt).
"""

from fastapi.testclient import TestClient

from service import routers
from service.campaign import CampaignCentroid, CampaignMatcher
from service.classifier import SmishingClassifier
from service.main import app

client = TestClient(app)


def test_health_ok_model_not_ready(tmp_path, monkeypatch):
    empty = SmishingClassifier(model_dir=str(tmp_path))
    monkeypatch.setattr(routers.health, "classifier", empty)
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["model_ready"] is False


def test_classify_returns_503_without_model(tmp_path, monkeypatch):
    empty = SmishingClassifier(model_dir=str(tmp_path))
    monkeypatch.setattr(routers.classify, "classifier", empty)
    resp = client.post("/classify", json={"message": "Claim ₱5000 at http://x.ph"})
    assert resp.status_code == 503


def test_classify_returns_503_when_checkpoint_exists_but_fails_to_load(tmp_path, monkeypatch):
    """_has_weights() only checks that config.json exists, not that the
    checkpoint actually loads -- a corrupted/incompatible checkpoint must
    still surface as the existing 503 path, not an unhandled 500."""
    (tmp_path / "config.json").write_text("not valid json", encoding="utf-8")
    broken = SmishingClassifier(model_dir=str(tmp_path))
    monkeypatch.setattr(routers.classify, "classifier", broken)
    resp = client.post("/classify", json={"message": "Claim ₱5000 at http://x.ph"})
    assert resp.status_code == 503
    assert "failed to load" in resp.json()["detail"]


def test_classify_validates_empty_message():
    resp = client.post("/classify", json={"message": ""})
    assert resp.status_code == 422  # min_length=1


# --- Sprint 3: campaign clustering field on /classify -----------------------
class _StubClassifier:
    """Stands in for a loaded model so the response shape can be tested
    without a 1.1 GB checkpoint."""

    def classify_full(self, message):
        import numpy as np

        from service.classifier import ClassificationResult

        return ClassificationResult(
            label="Scam",
            score=0.96,
            scores={"Ham": 0.01, "Spam": 0.03, "Scam": 0.96},
            masked_text="masked",
            embedding=np.array([1.0, 0.0, 0.0], dtype="float32"),
        )


def test_campaign_is_null_at_cold_start(monkeypatch):
    """No centroids loaded yet -- report nothing rather than a misleading
    'no match', and stay backward-compatible for callers ignoring the field."""
    monkeypatch.setattr(routers.classify, "classifier", _StubClassifier())
    monkeypatch.setattr(routers.classify, "matcher", CampaignMatcher([]))
    body = client.post("/classify", json={"message": "hi"}).json()
    assert body["campaign"] is None


def test_campaign_reports_a_match(monkeypatch):
    monkeypatch.setattr(routers.classify, "classifier", _StubClassifier())
    monkeypatch.setattr(
        routers.classify,
        "matcher",
        CampaignMatcher([CampaignCentroid("c7", [1.0, 0.0, 0.0])]),
    )
    campaign = client.post("/classify", json={"message": "hi"}).json()["campaign"]
    assert campaign["matched"] is True
    assert campaign["cluster_id"] == "c7"
    assert campaign["should_buffer"] is False


def test_ham_is_not_matched_against_campaigns(monkeypatch):
    """Regression, found 2026-07-30: clusters are built from the Spam+Scam
    population, so matching a Ham message against them is meaningless -- and
    empirically a real personal message matched a money-transfer cluster at
    0.96 because both are short and transactional."""

    class _HamClassifier(_StubClassifier):
        def classify_full(self, message):
            result = super().classify_full(message)
            result.label = "Ham"
            result.scores = {"Ham": 0.98, "Spam": 0.01, "Scam": 0.01}
            return result

    monkeypatch.setattr(routers.classify, "classifier", _HamClassifier())
    monkeypatch.setattr(
        routers.classify,
        "matcher",
        CampaignMatcher([CampaignCentroid("c7", [1.0, 0.0, 0.0])]),
    )
    body = client.post("/classify", json={"message": "hi"}).json()
    assert body["label"] == "Ham"
    assert body["campaign"] is None


def test_campaign_reports_buffering_when_unmatched(monkeypatch):
    monkeypatch.setattr(routers.classify, "classifier", _StubClassifier())
    monkeypatch.setattr(
        routers.classify,
        "matcher",
        CampaignMatcher([CampaignCentroid("c7", [0.0, 1.0, 0.0])]),
    )
    campaign = client.post("/classify", json={"message": "hi"}).json()["campaign"]
    assert campaign["matched"] is False
    assert campaign["cluster_id"] is None
    assert campaign["should_buffer"] is True


# --- inbound authentication (Reymark's audit, item 7) ------------------------
def test_routes_are_open_when_no_service_key_is_configured():
    """The documented local default: only the backend can reach the port, and
    every existing dev setup relies on this still working."""
    from service import auth

    assert auth.settings.service_api_key == ""
    assert client.post("/classify", json={"message": "hi"}).status_code != 401


def test_a_configured_key_is_required(monkeypatch):
    from service import auth

    monkeypatch.setattr(auth.settings, "service_api_key", "s3cret")

    assert client.post("/classify", json={"message": "hi"}).status_code == 401
    assert client.post("/summarize", json={"messages": ["hi"]}).status_code == 401
    assert client.post("/retrain", json={"trigger": "f1_drop"}).status_code == 401
    assert client.post("/classify", json={"message": "hi"}, headers={"x-api-key": "wrong"}).status_code == 401
    # Correct key gets through to the route itself (503 here = no model loaded).
    assert client.post("/classify", json={"message": "hi"}, headers={"x-api-key": "s3cret"}).status_code != 401


def test_health_stays_open_even_with_a_key_configured(monkeypatch):
    """A health check that needs a secret is useless to whatever is deciding
    whether this process is alive."""
    from service import auth

    monkeypatch.setattr(auth.settings, "service_api_key", "s3cret")
    assert client.get("/health").status_code == 200
    assert client.get("/").status_code == 200


# --- request size limits (audit items 8, 9, 10) ------------------------------
def test_an_oversized_message_is_rejected_before_any_work():
    from service.schemas import MAX_MESSAGE_CHARS

    resp = client.post("/classify", json={"message": "x" * (MAX_MESSAGE_CHARS + 1)})
    assert resp.status_code == 422


def test_too_many_messages_to_summarize_are_rejected():
    from service.schemas import MAX_SUMMARIZE_MESSAGES

    resp = client.post("/summarize", json={"messages": ["hi"] * (MAX_SUMMARIZE_MESSAGES + 1)})
    assert resp.status_code == 422


def test_an_overlong_trigger_is_rejected():
    """Each distinct trigger is a queue row the dedupe cannot collapse."""
    from service.schemas import MAX_TRIGGER_CHARS

    resp = client.post("/retrain", json={"trigger": "t" * (MAX_TRIGGER_CHARS + 1)})
    assert resp.status_code == 422
