import hashlib
import json

import numpy as np
from fastapi.testclient import TestClient

from retraining.checksum import bundle_digest, hash_bundle
from service.classifier import ClassificationResult
from service.config import settings
from service.main import app
from service.readiness import ReadinessReport, prepare_model_readiness, readiness

client = TestClient(app)


class _GoodClassifier:
    def __init__(self, *, fail=False, invalid_scores=False):
        self.calls = 0
        self.fail = fail
        self.invalid_scores = invalid_scores

    def classify_full(self, message):
        self.calls += 1
        if self.fail:
            raise RuntimeError("load failed")
        result = ClassificationResult(
            label="Ham",
            score=0.98,
            scores={"Ham": 0.98, "Spam": 0.01, "Scam": 0.01},
            masked_text=message,
            embedding=np.array([1.0, 0.0, 0.0], dtype="float32"),
        )
        if self.invalid_scores:
            result.scores["Ham"] = float("nan")
            result.score = float("nan")
        return result


def _model_bundle(tmp_path):
    model_dir = tmp_path / "model"
    model_dir.mkdir()
    (model_dir / "config.json").write_text(
        json.dumps({"id2label": {"0": "Ham", "1": "Spam", "2": "Scam"}}),
        encoding="utf-8",
    )
    (model_dir / "model.safetensors").write_bytes(b"test weights")
    (model_dir / "tokenizer.json").write_text("{}", encoding="utf-8")
    (model_dir / "version.json").write_text(json.dumps({"version_tag": "v-test"}), encoding="utf-8")
    return model_dir


def _approval(model_dir, tmp_path, *, approved=True, scope="local_validation_only"):
    artifacts = {
        path.relative_to(model_dir).as_posix(): hashlib.sha256(path.read_bytes()).hexdigest()
        for path in model_dir.rglob("*")
        if path.is_file()
    }
    approval_path = tmp_path / "approval.json"
    approval_path.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "approved": approved,
                "scope": scope,
                "version_tag": "v-test",
                "artifacts": artifacts,
            }
        ),
        encoding="utf-8",
    )
    return approval_path


def test_ready_only_after_approval_integrity_load_and_probe(tmp_path):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)
    classifier = _GoodClassifier()

    report = prepare_model_readiness(classifier, str(model_dir), str(approval_path))

    assert report.ready
    assert report.artifact_integrity == "verified"
    assert report.model_loaded
    assert report.test_inference_passed
    assert report.version_tag == "v-test"
    assert report.checked_artifacts == 4
    assert classifier.calls == 1
    # The digest the backend compares before confirming a deployment: the
    # verified files, the same way a candidate directory is registered.
    assert report.bundle_digest == bundle_digest(hash_bundle(str(model_dir)))
    health = client.get("/health").json()
    assert health["bundle_digest"] == report.bundle_digest


def test_missing_approval_fails_before_model_load(tmp_path):
    model_dir = _model_bundle(tmp_path)
    classifier = _GoodClassifier()

    report = prepare_model_readiness(classifier, str(model_dir), "")

    assert not report.ready
    assert report.reason == "approval_manifest_not_configured"
    assert classifier.calls == 0


def test_production_rejects_pickle_checkpoint_before_approval_or_load(tmp_path, monkeypatch):
    model_dir = _model_bundle(tmp_path)
    (model_dir / "model.safetensors").unlink()
    (model_dir / "pytorch_model.bin").write_bytes(b"not a safe serving format")
    approval_path = _approval(model_dir, tmp_path)
    classifier = _GoodClassifier()
    monkeypatch.setattr(settings, "environment", "production")

    report = prepare_model_readiness(classifier, str(model_dir), str(approval_path))

    assert not report.ready
    assert report.reason == "production_requires_safetensors"
    assert classifier.calls == 0


def test_production_rejects_local_validation_manifest(tmp_path, monkeypatch):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)
    approval = json.loads(approval_path.read_text(encoding="utf-8"))
    approval["scope"] = "local_validation_only"
    approval_path.write_text(json.dumps(approval), encoding="utf-8")
    classifier = _GoodClassifier()
    monkeypatch.setattr(settings, "environment", "production")

    report = prepare_model_readiness(classifier, str(model_dir), str(approval_path))

    assert not report.ready
    assert report.reason == "production_approval_scope_required"
    assert classifier.calls == 0


def test_production_requires_approval_reference(tmp_path, monkeypatch):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)
    approval = json.loads(approval_path.read_text(encoding="utf-8"))
    approval["scope"] = "production"
    approval.pop("approval_reference", None)
    approval_path.write_text(json.dumps(approval), encoding="utf-8")
    classifier = _GoodClassifier()
    monkeypatch.setattr(settings, "environment", "production")

    report = prepare_model_readiness(classifier, str(model_dir), str(approval_path))

    assert not report.ready
    assert report.reason == "production_approval_reference_required"
    assert classifier.calls == 0


def test_development_requires_a_development_manifest_and_reference(tmp_path, monkeypatch):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)
    classifier = _GoodClassifier()
    monkeypatch.setattr(settings, "environment", "development")

    report = prepare_model_readiness(classifier, str(model_dir), str(approval_path))
    assert report.reason == "development_approval_scope_required"
    assert classifier.calls == 0

    payload = json.loads(approval_path.read_text(encoding="utf-8"))
    payload["scope"] = "development"
    approval_path.write_text(json.dumps(payload), encoding="utf-8")
    report = prepare_model_readiness(classifier, str(model_dir), str(approval_path))
    assert report.reason == "development_approval_reference_required"
    assert classifier.calls == 0

    payload["approval_reference"] = "team-release-record-41"
    approval_path.write_text(json.dumps(payload), encoding="utf-8")
    assert prepare_model_readiness(classifier, str(model_dir), str(approval_path)).ready


def test_unknown_environment_fails_closed(tmp_path, monkeypatch):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)
    classifier = _GoodClassifier()
    monkeypatch.setattr(settings, "environment", "shared")

    report = prepare_model_readiness(classifier, str(model_dir), str(approval_path))

    assert report.reason == "unsupported_deployment_environment"
    assert classifier.calls == 0


def test_unapproved_manifest_fails_closed(tmp_path):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path, approved=False)

    report = prepare_model_readiness(_GoodClassifier(), str(model_dir), str(approval_path))

    assert not report.ready
    assert report.reason == "model_not_approved"


def test_changed_artifact_fails_integrity_check_before_load(tmp_path):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)
    (model_dir / "model.safetensors").write_bytes(b"changed weights")
    classifier = _GoodClassifier()

    report = prepare_model_readiness(classifier, str(model_dir), str(approval_path))

    assert not report.ready
    assert report.reason == "approval_artifact_digest_mismatch"
    assert classifier.calls == 0


def test_successful_integrity_is_not_enough_when_load_or_probe_fails(tmp_path):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)

    report = prepare_model_readiness(_GoodClassifier(fail=True), str(model_dir), str(approval_path))

    assert not report.ready
    assert report.reason == "model_load_or_probe_failed"
    assert report.artifact_integrity == "verified"
    assert not report.model_loaded
    assert not report.test_inference_passed


def test_unlisted_artifact_fails_closed_before_model_load(tmp_path):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)
    (model_dir / "unexpected.bin").write_bytes(b"not approved")
    classifier = _GoodClassifier()

    report = prepare_model_readiness(classifier, str(model_dir), str(approval_path))

    assert not report.ready
    assert report.reason == "approval_artifact_set_mismatch"
    assert classifier.calls == 0


def test_approval_version_must_match_the_bundle(tmp_path):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)
    payload = json.loads(approval_path.read_text(encoding="utf-8"))
    payload["version_tag"] = "different-version"
    approval_path.write_text(json.dumps(payload), encoding="utf-8")

    report = prepare_model_readiness(_GoodClassifier(), str(model_dir), str(approval_path))

    assert not report.ready
    assert report.reason == "approval_version_mismatch"


def test_nonfinite_probe_output_stays_unready(tmp_path):
    model_dir = _model_bundle(tmp_path)
    approval_path = _approval(model_dir, tmp_path)

    report = prepare_model_readiness(
        _GoodClassifier(invalid_scores=True),
        str(model_dir),
        str(approval_path),
    )

    assert not report.ready
    assert report.reason == "model_load_or_probe_failed"
    assert report.model_loaded
    assert not report.test_inference_passed


def test_liveness_stays_up_while_readiness_and_classification_fail_closed(monkeypatch):
    from service import routers

    classifier = _GoodClassifier()
    monkeypatch.setattr(routers.classify, "classifier", classifier)
    readiness.publish(ReadinessReport(False, "model_not_approved"))

    health_response = client.get("/health")
    ready_response = client.get("/ready")
    classify_response = client.post("/classify", json={"message": "hello"})

    assert health_response.status_code == 200
    assert health_response.json()["status"] == "ok"
    assert health_response.json()["model_ready"] is False
    assert ready_response.status_code == 503
    assert ready_response.json()["reason"] == "model_not_approved"
    assert classify_response.status_code == 503
    assert classifier.calls == 0


def test_ready_endpoint_reports_verified_startup_state():
    readiness.publish(
        ReadinessReport(
            True,
            "ready",
            version_tag="v-approved",
            artifact_integrity="verified",
            model_loaded=True,
            test_inference_passed=True,
            checked_artifacts=7,
            bundle_digest="a" * 64,
        )
    )

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "model_ready": True,
        "reason": "ready",
        "version_tag": "v-approved",
        "artifact_integrity": "verified",
        "model_loaded": True,
        "test_inference_passed": True,
        "checked_artifacts": 7,
        "bundle_digest": "a" * 64,
    }
