"""API tests for the FastAPI ML service.

The "no model loaded" contract (/health reports model_ready=False, /classify
returns 503 while still masking PII) is tested against a classifier pointed at
an empty directory, not the module-level singleton -- a real fine-tuned model
now lives at ai/models/xlm-roberta-smishing/, so asserting on global state
would pass or fail depending on whether that model happens to be installed.
Requires fastapi + httpx (see requirements.txt).
"""

import pytest
from fastapi.testclient import TestClient

from service import routers
from service.campaign import CampaignCentroid, CampaignMatcher
from service.classifier import SmishingClassifier
from service.main import app
from service.readiness import ReadinessReport, readiness

client = TestClient(app)


@pytest.fixture(autouse=True)
def _verified_model_gate_for_route_contract_tests():
    readiness.publish(
        ReadinessReport(
            True,
            "ready",
            artifact_integrity="verified",
            model_loaded=True,
            test_inference_passed=True,
        )
    )
    yield
    readiness.publish(ReadinessReport(False, "test_complete"))


def test_health_ok_model_not_ready():
    readiness.publish(ReadinessReport(False, "model_bundle_incomplete"))
    resp = client.get("/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["model_ready"] is False
    assert body["campaign_centroids_loaded"] >= 0


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


def test_classify_never_runs_shap_inline(monkeypatch):
    """SHAP takes 10-45 s per message; the backend gives up on /classify after
    3.5 s. If SHAP ever runs inside the request again, every message times out
    and the app silently stops using the model -- which is what happened on
    2026-09-20. This fails loudly instead.

    Records the call rather than raising inside it: ``explain()`` swallows any
    SHAP exception and falls back, so a raise would be hidden and the test
    would pass against the slow code too."""
    from service import explainer

    stub = _StubClassifier()
    stub._model, stub._tokenizer = object(), object()  # a loaded model is present
    shap_calls = []

    monkeypatch.setattr(explainer, "shap_available", lambda: True)

    def _fake_shap(*args, **kwargs):
        shap_calls.append(args)
        return explainer.Explanation(tags=[], method="shap", top_tokens=[])

    monkeypatch.setattr(explainer, "_explain_with_shap", _fake_shap)
    monkeypatch.setattr(routers.classify, "classifier", stub)
    monkeypatch.setattr(routers.classify, "matcher", CampaignMatcher([]))

    body = client.post("/classify", json={"message": "hi"}).json()
    assert shap_calls == [], "SHAP ran inside /classify"
    assert body["explanation_method"] == "keyword-fallback"


class _EchoClassifier(_StubClassifier):
    """Returns the real message as the masked text, so the tagger has words."""

    def classify_full(self, message):
        from dataclasses import replace

        return replace(super().classify_full(message), masked_text=message)


def test_classify_returns_keyword_indicators(monkeypatch):
    """The indicator tags still reach the app through /classify."""
    monkeypatch.setattr(routers.classify, "classifier", _EchoClassifier())
    monkeypatch.setattr(routers.classify, "matcher", CampaignMatcher([]))
    body = client.post(
        "/classify",
        json={"message": "Congratulations! You won P50,000. Claim your prize now at bit.ly/claim-prize"},
    ).json()
    assert body["indicators"], "a prize-bait scam should carry at least one indicator tag"


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


def test_classify_forwards_phone_extracted_domains_to_the_matcher(monkeypatch):
    """Audit 2026-09-30, finding 5: the backend sends masked text, so the
    domain tier only sees link identity through ``domains``."""
    seen = {}

    class _SpyMatcher(CampaignMatcher):
        def match(self, embedding, text=None, domains=None, label=None):
            seen.update(text=text, domains=domains, label=label)
            return super().match(embedding, text, domains=domains, label=label)

    monkeypatch.setattr(routers.classify, "classifier", _StubClassifier())
    monkeypatch.setattr(routers.classify, "matcher", _SpyMatcher([CampaignCentroid("c7", [1.0, 0.0, 0.0])]))
    resp = client.post("/classify", json={"message": "Claim at [URL]", "domains": ["gcash-promo.xyz"]})
    assert resp.status_code == 200
    assert seen == {
        "text": "Claim at [URL]",
        "domains": ["gcash-promo.xyz"],
        "label": "Scam",
    }


@pytest.mark.parametrize(
    "domains",
    [["https://evil.xyz/login"], ["UPPER.xyz"], ["juan@mail.com"], ["a.ph"] * 21],
)
def test_classify_refuses_anything_but_bare_hostnames(domains):
    assert client.post("/classify", json={"message": "hi", "domains": domains}).status_code == 422


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
def test_routes_are_open_only_under_the_explicit_local_opt_out():
    """test/local + ALLOW_UNAUTHENTICATED_DEV=true (conftest)."""
    from service import auth

    assert auth.settings.service_api_key == ""
    # Classification can independently return 503 when model readiness is
    # false. Summarize proves the authentication opt-out without conflating
    # those two gates.
    assert client.post("/summarize", json={"messages": ["hello there"]}).status_code not in (401, 503)


@pytest.mark.parametrize(
    ("environment", "allow"),
    [("development", False), ("development", True), ("production", True), ("staging", True), ("", True)],
)
def test_routes_fail_closed_without_a_key_or_opt_out(monkeypatch, environment, allow):
    """Audit 2026-09-30, finding 1: no key must never mean no authentication."""
    from service import auth

    monkeypatch.setattr(auth.settings, "environment", environment)
    monkeypatch.setattr(auth.settings, "allow_unauthenticated_dev", allow)

    for path, body in (
        ("/classify", {"message": "hi"}),
        ("/summarize", {"messages": ["hi"]}),
        ("/retrain", {"trigger": "f1_drop", "dataset_version": "dataset-a"}),
    ):
        assert client.post(path, json=body).status_code == 503


@pytest.mark.parametrize("environment", ["development", "production", "staging", ""])
def test_startup_is_refused_without_a_key_outside_local(monkeypatch, environment):
    from service import auth

    monkeypatch.setattr(auth.settings, "environment", environment)
    monkeypatch.setattr(auth.settings, "allow_unauthenticated_dev", True)
    with pytest.raises(RuntimeError, match="BANTAI_AI_SERVICE_API_KEY is required"):
        auth.enforce_inbound_auth_policy()


def test_startup_is_refused_in_development_without_the_opt_out(monkeypatch):
    from service import auth

    monkeypatch.setattr(auth.settings, "environment", "development")
    monkeypatch.setattr(auth.settings, "allow_unauthenticated_dev", False)
    with pytest.raises(RuntimeError):
        auth.enforce_inbound_auth_policy()


def test_startup_refuses_a_short_production_key(monkeypatch):
    from service import auth

    monkeypatch.setattr(auth.settings, "environment", "production")
    monkeypatch.setattr(auth.settings, "service_api_key", "s3cret")
    with pytest.raises(RuntimeError, match="at least 32"):
        auth.enforce_inbound_auth_policy()

    monkeypatch.setattr(auth.settings, "service_api_key", "k" * 32)
    auth.enforce_inbound_auth_policy()


def test_production_lifespan_refuses_to_start_without_a_key(monkeypatch):
    """The real app, not just the helper: uvicorn must exit during startup."""
    from service import auth

    monkeypatch.setattr(auth.settings, "environment", "production")
    with pytest.raises(RuntimeError, match="BANTAI_AI_SERVICE_API_KEY is required"):
        with TestClient(app):
            pass


def test_docs_are_not_served_outside_local_environments(monkeypatch):
    import importlib

    from service import main

    monkeypatch.setattr(main.settings, "environment", "production")
    try:
        prod = importlib.reload(main).app
        assert prod.docs_url is None and prod.openapi_url is None
        prod_client = TestClient(prod)
        assert prod_client.get("/docs").status_code == 404
        assert prod_client.get("/openapi.json").status_code == 404
        assert prod_client.get("/").json()["docs"] is None
    finally:
        monkeypatch.setattr(main.settings, "environment", "test")
        importlib.reload(main)


def test_a_configured_key_is_required(monkeypatch):
    from service import auth

    monkeypatch.setattr(auth.settings, "service_api_key", "s3cret")

    assert client.post("/classify", json={"message": "hi"}).status_code == 401
    assert client.post("/summarize", json={"messages": ["hi"]}).status_code == 401
    assert client.post("/retrain", json={"trigger": "f1_drop", "dataset_version": "dataset-a"}).status_code == 401
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


def test_the_work_limit_middleware_is_installed():
    from service.limits import WorkLimitMiddleware

    assert any(m.cls is WorkLimitMiddleware for m in app.user_middleware)


def test_an_oversized_body_is_rejected_before_validation():
    """Extra fields and padding are not bounded by schema field limits."""
    from service.limits import WorkLimitMiddleware

    middleware = next(m for m in app.user_middleware if m.cls is WorkLimitMiddleware)
    cap = middleware.kwargs["max_body_bytes"]
    padded = b'{"message": "hi", "pad": "' + b"x" * cap + b'"}'
    resp = client.post("/classify", content=padded, headers={"content-type": "application/json"})
    assert resp.status_code == 413


def test_a_false_content_length_is_still_capped():
    import asyncio

    from service.limits import WorkLimitMiddleware

    reached = []

    async def downstream(scope, receive, send):  # pragma: no cover - must not run
        reached.append(True)

    middleware = WorkLimitMiddleware(downstream, max_body_bytes=10, max_concurrent=1)
    chunks = [b"x" * 8, b"y" * 8]

    async def receive():
        body = chunks.pop(0)
        return {"type": "http.request", "body": body, "more_body": bool(chunks)}

    sent = []

    async def send(message):
        sent.append(message)

    scope = {
        "type": "http",
        "method": "POST",
        "path": "/classify",
        "headers": [(b"content-length", b"5"), (b"content-type", b"application/json")],
        "query_string": b"",
    }
    asyncio.run(middleware(scope, receive, send))
    assert sent[0]["status"] == 413
    assert not reached


def test_requests_beyond_the_concurrency_limit_are_rejected():
    import asyncio

    import httpx

    from service.limits import WorkLimitMiddleware

    async def scenario():
        release = asyncio.Event()
        started = asyncio.Event()

        async def slow_app(scope, receive, send):
            while (await receive()).get("more_body"):
                pass
            started.set()
            await release.wait()
            await send({"type": "http.response.start", "status": 200, "headers": []})
            await send({"type": "http.response.body", "body": b"ok"})

        limited = WorkLimitMiddleware(slow_app, max_body_bytes=1024, max_concurrent=1)
        transport = httpx.ASGITransport(app=limited)
        async with httpx.AsyncClient(transport=transport, base_url="http://ai") as http:
            first = asyncio.create_task(http.post("/classify", json={"message": "a"}))
            await asyncio.wait_for(started.wait(), timeout=5)
            second = await http.post("/classify", json={"message": "b"})
            release.set()
            return (await first).status_code, second

    first_status, second = asyncio.run(scenario())
    assert first_status == 200
    assert second.status_code == 503
    assert second.headers["retry-after"] == "1"


def test_an_overlong_trigger_is_rejected():
    """Each distinct trigger is a queue row the dedupe cannot collapse."""
    from service.schemas import MAX_TRIGGER_CHARS

    resp = client.post("/retrain", json={"trigger": "t" * (MAX_TRIGGER_CHARS + 1)})
    assert resp.status_code == 422
