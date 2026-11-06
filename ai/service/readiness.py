"""Fail-closed model readiness for the inference service.

Liveness and model readiness are deliberately separate.  The process can be
alive while a model is absent, unapproved, corrupt, or unable to execute; in
all of those cases ``/health`` remains useful while ``/ready`` and
``/classify`` must return HTTP 503.

Approval is an external manifest, not a flag inside the candidate bundle.  It
pins the exact version and SHA-256 of every regular file in the mounted model
directory.  Keeping that manifest outside the model directory lets deployment
mount both inputs read-only and prevents a candidate from approving itself.
"""

from __future__ import annotations

import json
import logging
import math
import re
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from threading import Lock
from typing import Any

from retraining.checksum import bundle_digest, sha256_file
from retraining.version_file import VERSION_FILENAME, read_version

from .classifier import LABELS
from .config import settings
from .model_bundle import inspect_model_bundle

logger = logging.getLogger(__name__)

APPROVAL_SCHEMA_VERSION = 1
MAX_APPROVAL_BYTES = 256 * 1024
SHA256_RE = re.compile(r"^[0-9a-fA-F]{64}$")
READINESS_PROBE_TEXT = "BantAI readiness probe message with no personal data."


@dataclass(frozen=True)
class ReadinessReport:
    ready: bool
    reason: str
    version_tag: str | None = None
    artifact_integrity: str = "unverified"
    model_loaded: bool = False
    test_inference_passed: bool = False
    checked_artifacts: int = 0
    #: ``retraining.checksum.bundle_digest`` of the approved, verified files.
    #: The backend compares it with the registry before confirming a deploy.
    bundle_digest: str | None = None


class ReadinessGate:
    """Thread-safe holder for the startup readiness decision."""

    def __init__(self) -> None:
        self._lock = Lock()
        self._report = ReadinessReport(False, "startup_not_completed")

    def snapshot(self) -> ReadinessReport:
        with self._lock:
            return self._report

    def publish(self, report: ReadinessReport) -> None:
        with self._lock:
            self._report = report


readiness = ReadinessGate()


class ApprovalManifestError(ValueError):
    """Raised when the external approval record is absent or invalid."""


def _reject_duplicate_keys(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
    result: dict[str, Any] = {}
    for key, value in pairs:
        if key in result:
            raise ApprovalManifestError(f"duplicate JSON key: {key}")
        result[key] = value
    return result


def _load_approval_manifest(path: str) -> tuple[str, dict[str, str]]:
    if not path.strip():
        raise ApprovalManifestError("approval_manifest_not_configured")

    approval_path = Path(path)
    if not approval_path.is_file() or approval_path.is_symlink():
        raise ApprovalManifestError("approval_manifest_missing")
    if approval_path.stat().st_size > MAX_APPROVAL_BYTES:
        raise ApprovalManifestError("approval_manifest_too_large")

    try:
        payload = json.loads(
            approval_path.read_text(encoding="utf-8"),
            object_pairs_hook=_reject_duplicate_keys,
        )
    except (OSError, UnicodeError, json.JSONDecodeError, ApprovalManifestError) as exc:
        raise ApprovalManifestError(f"approval_manifest_invalid: {exc}") from exc

    if not isinstance(payload, dict) or payload.get("schema_version") != APPROVAL_SCHEMA_VERSION:
        raise ApprovalManifestError("approval_manifest_schema_invalid")
    if payload.get("approved") is not True:
        raise ApprovalManifestError("model_not_approved")
    environment = settings.environment.strip().lower()
    required_scopes = {
        "production": "production",
        "development": "development",
        "local": "local_validation_only",
        "test": "local_validation_only",
    }
    required_scope = required_scopes.get(environment)
    if required_scope is None:
        raise ApprovalManifestError("unsupported_deployment_environment")
    if payload.get("scope") != required_scope:
        raise ApprovalManifestError(f"{environment}_approval_scope_required")
    if environment in {"production", "development"} and (
        not isinstance(payload.get("approval_reference"), str) or not payload["approval_reference"].strip()
    ):
        raise ApprovalManifestError(f"{environment}_approval_reference_required")

    version_tag = payload.get("version_tag")
    artifacts = payload.get("artifacts")
    if not isinstance(version_tag, str) or not version_tag.strip():
        raise ApprovalManifestError("approval_version_missing")
    if not isinstance(artifacts, dict) or not artifacts:
        raise ApprovalManifestError("approval_artifacts_missing")

    normalized: dict[str, str] = {}
    for raw_name, raw_digest in artifacts.items():
        if not isinstance(raw_name, str) or not isinstance(raw_digest, str):
            raise ApprovalManifestError("approval_artifact_entry_invalid")
        name = PurePosixPath(raw_name)
        if (
            not raw_name
            or "\\" in raw_name
            or name.is_absolute()
            or any(part in {"", ".", ".."} for part in name.parts)
        ):
            raise ApprovalManifestError("approval_artifact_path_invalid")
        if not SHA256_RE.fullmatch(raw_digest):
            raise ApprovalManifestError("approval_artifact_digest_invalid")
        canonical_name = name.as_posix()
        if canonical_name != raw_name or canonical_name in normalized:
            raise ApprovalManifestError("approval_artifact_path_invalid")
        normalized[canonical_name] = raw_digest.lower()

    return version_tag.strip(), normalized


def _model_files(model_dir: Path) -> dict[str, Path]:
    if model_dir.is_symlink():
        raise ApprovalManifestError("model_bundle_contains_symlink")
    files: dict[str, Path] = {}
    for candidate in model_dir.rglob("*"):
        if candidate.is_symlink():
            raise ApprovalManifestError("model_bundle_contains_symlink")
        if candidate.is_file():
            relative = candidate.relative_to(model_dir).as_posix()
            files[relative] = candidate
    return files


def _verify_approved_artifacts(model_dir: str, approval_path: str) -> tuple[str, int, str]:
    root = Path(model_dir)
    try:
        if Path(approval_path).resolve().is_relative_to(root.resolve()):
            raise ApprovalManifestError("approval_manifest_must_be_external")
    except OSError as exc:
        raise ApprovalManifestError(f"approval_manifest_invalid: {exc}") from exc

    version_tag, approved = _load_approval_manifest(approval_path)
    files = _model_files(root)

    if set(files) != set(approved):
        missing = sorted(set(approved) - set(files))
        unexpected = sorted(set(files) - set(approved))
        logger.error(
            "Model approval artifact set mismatch (missing=%s, unexpected=%s).",
            missing,
            unexpected,
        )
        raise ApprovalManifestError("approval_artifact_set_mismatch")

    for name, candidate in sorted(files.items()):
        if sha256_file(str(candidate)).lower() != approved[name]:
            logger.error("Model artifact digest mismatch: %s.", name)
            raise ApprovalManifestError("approval_artifact_digest_mismatch")

    served_version = read_version(model_dir)
    if served_version is None:
        raise ApprovalManifestError("model_version_unverifiable")
    if VERSION_FILENAME not in approved:
        raise ApprovalManifestError("version_file_not_approved")
    if served_version != version_tag:
        raise ApprovalManifestError("approval_version_mismatch")

    # Every digest in ``approved`` was just matched against the file on disk,
    # so this describes the bytes being served, not only the manifest.
    return served_version, len(files), bundle_digest(approved)


def _validate_probe_result(result: Any) -> None:
    scores = getattr(result, "scores", None)
    if not isinstance(scores, dict) or set(scores) != set(LABELS):
        raise ValueError("probe_label_contract_invalid")

    values = [float(scores[label]) for label in LABELS]
    if any(not math.isfinite(value) or value < 0.0 or value > 1.0 for value in values):
        raise ValueError("probe_scores_invalid")
    if not math.isclose(sum(values), 1.0, rel_tol=1e-4, abs_tol=1e-4):
        raise ValueError("probe_scores_not_normalized")

    label = getattr(result, "label", None)
    score = float(getattr(result, "score", float("nan")))
    if label not in LABELS or not math.isfinite(score) or not math.isclose(score, scores[label], abs_tol=1e-6):
        raise ValueError("probe_winner_invalid")

    # NumPy is a runtime dependency of the classifier; importing it here keeps
    # the module itself light enough for liveness-only startup diagnostics.
    import numpy as np

    embedding = np.asarray(getattr(result, "embedding", []))
    if embedding.size == 0 or not np.isfinite(embedding).all():
        raise ValueError("probe_embedding_invalid")


def prepare_model_readiness(classifier: Any, model_dir: str, approval_path: str) -> ReadinessReport:
    """Verify approval/integrity, load the model, and run one real inference."""

    bundle = inspect_model_bundle(model_dir)
    if not bundle.is_complete:
        logger.error("Model bundle is incomplete: %s.", "; ".join(bundle.errors))
        report = ReadinessReport(False, "model_bundle_incomplete")
        readiness.publish(report)
        return report

    # Production only accepts the non-pickle safetensors checkpoint. A hash
    # proves identity, not that a serialized Python object is safe to load.
    if settings.environment.strip().lower() == "production" and bundle.weight_file != "model.safetensors":
        report = ReadinessReport(False, "production_requires_safetensors")
        readiness.publish(report)
        return report

    try:
        version_tag, checked_artifacts, served_digest = _verify_approved_artifacts(model_dir, approval_path)
    except ApprovalManifestError as exc:
        report = ReadinessReport(False, str(exc))
        readiness.publish(report)
        return report

    model_loaded = False
    try:
        result = classifier.classify_full(READINESS_PROBE_TEXT)
        model_loaded = True
        _validate_probe_result(result)
    except Exception as exc:  # noqa: BLE001 -- every load/probe failure means not ready
        logger.exception("Model load or readiness inference failed: %s", exc)
        report = ReadinessReport(
            False,
            "model_load_or_probe_failed",
            version_tag=version_tag,
            artifact_integrity="verified",
            model_loaded=model_loaded,
            checked_artifacts=checked_artifacts,
            bundle_digest=served_digest,
        )
        readiness.publish(report)
        return report

    report = ReadinessReport(
        True,
        "ready",
        version_tag=version_tag,
        artifact_integrity="verified",
        model_loaded=True,
        test_inference_passed=True,
        checked_artifacts=checked_artifacts,
        bundle_digest=served_digest,
    )
    readiness.publish(report)
    logger.info("Model %s is ready; %d approved artifacts verified.", version_tag, checked_artifacts)
    return report


def require_model_ready() -> None:
    """FastAPI dependency that prevents use of an unready model."""

    from fastapi import HTTPException, status

    report = readiness.snapshot()
    if not report.ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"AI model is not ready: {report.reason}",
        )
