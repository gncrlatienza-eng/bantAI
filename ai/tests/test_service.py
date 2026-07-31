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
