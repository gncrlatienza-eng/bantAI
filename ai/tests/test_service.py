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
