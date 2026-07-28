"""API tests for the FastAPI ML service.

These exercise the contract in the Sprint 1 state (no trained model): /health
reports model_ready=False and /classify returns 503 while still masking PII.
Requires fastapi + httpx (see requirements.txt).
"""

from fastapi.testclient import TestClient

from service.main import app

client = TestClient(app)


def test_health_ok_model_not_ready():
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["model_ready"] is False


def test_classify_returns_503_without_model():
    resp = client.post("/classify", json={"message": "Claim ₱5000 at http://x.ph"})
    assert resp.status_code == 503


def test_classify_validates_empty_message():
    resp = client.post("/classify", json={"message": ""})
    assert resp.status_code == 422  # min_length=1
