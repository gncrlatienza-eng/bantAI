import hashlib
import json
import stat
import zipfile
from pathlib import Path

import numpy as np
import pytest

from scripts.install_development_model import InstallError, install, install_components
from service.classifier import ClassificationResult
from service.config import settings
from service.readiness import prepare_model_readiness


class _GoodClassifier:
    def classify_full(self, message):
        return ClassificationResult(
            label="Ham",
            score=0.98,
            scores={"Ham": 0.98, "Spam": 0.01, "Scam": 0.01},
            masked_text=message,
            embedding=np.array([1.0, 0.0, 0.0], dtype="float32"),
        )


def _bundle_files(version="development-model-c"):
    return {
        "release/config.json": json.dumps({"id2label": {"0": "Ham", "1": "Spam", "2": "Scam"}}).encode(),
        "release/model.safetensors": b"safe test weights",
        "release/tokenizer.json": b"{}",
        "release/version.json": json.dumps({"version_tag": version}).encode(),
    }


def _archive(path: Path, files=None):
    with zipfile.ZipFile(path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for name, body in (files or _bundle_files()).items():
            archive.writestr(name, body)
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _install(tmp_path, archive, digest):
    destination = tmp_path / "installed"
    approval = tmp_path / "approval.json"
    manifest = install(
        archive,
        destination,
        approval,
        digest,
        "development-model-c",
        "user-designated-final-development-model-2026-10-01",
    )
    return destination, approval, manifest


def test_installs_hash_pinned_development_bundle_and_tampering_fails(tmp_path, monkeypatch):
    archive = tmp_path / "model.zip"
    destination, approval, manifest = _install(tmp_path, archive, _archive(archive))

    assert manifest["scope"] == "development"
    assert manifest["approved"] is True
    assert manifest["source"]["archive_sha256"] == hashlib.sha256(archive.read_bytes()).hexdigest()
    assert set(manifest["artifacts"]) == {
        "config.json",
        "model.safetensors",
        "tokenizer.json",
        "version.json",
    }

    monkeypatch.setattr(settings, "environment", "development")
    assert prepare_model_readiness(_GoodClassifier(), str(destination), str(approval)).ready
    (destination / "model.safetensors").write_bytes(b"tampered")
    report = prepare_model_readiness(_GoodClassifier(), str(destination), str(approval))
    assert not report.ready
    assert report.reason == "approval_artifact_digest_mismatch"


def test_wrong_archive_digest_is_rejected_before_outputs_exist(tmp_path):
    archive = tmp_path / "model.zip"
    _archive(archive)
    with pytest.raises(InstallError, match="archive_sha256_mismatch"):
        _install(tmp_path, archive, "0" * 64)
    assert not (tmp_path / "installed").exists()
    assert not (tmp_path / "approval.json").exists()


def test_path_traversal_is_rejected(tmp_path):
    archive = tmp_path / "model.zip"
    files = _bundle_files()
    files["../escape.txt"] = b"no"
    digest = _archive(archive, files)
    with pytest.raises(InstallError, match="archive_member_path_invalid"):
        _install(tmp_path, archive, digest)
    assert not (tmp_path / "escape.txt").exists()


def test_zip_links_are_rejected(tmp_path):
    archive = tmp_path / "model.zip"
    with zipfile.ZipFile(archive, "w") as output:
        for name, body in _bundle_files().items():
            output.writestr(name, body)
        link = zipfile.ZipInfo("release/weights-link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        output.writestr(link, "model.safetensors")
    digest = hashlib.sha256(archive.read_bytes()).hexdigest()
    with pytest.raises(InstallError, match="archive_links_not_allowed"):
        _install(tmp_path, archive, digest)


def _components(tmp_path):
    source = tmp_path / "components"
    source.mkdir()
    for name, body in _bundle_files().items():
        if not name.endswith("version.json"):
            (source / Path(name).name).write_bytes(body)
    (source / "tokenizer_config.json").write_text("{}")
    record = tmp_path / "external-version.json"
    record.write_text(
        json.dumps(
            {
                "version_tag": "development-model-c",
                "artifacts": {f.name: hashlib.sha256(f.read_bytes()).hexdigest() for f in source.iterdir()},
            }
        )
    )
    return source, record


def test_components_record_archive_gap_and_cannot_authorize_production(tmp_path, monkeypatch):
    source, record = _components(tmp_path)
    destination, approval = tmp_path / "installed", tmp_path / "approval.json"
    manifest = install_components(
        source, record, destination, approval, "development-model-c", "user-designated-development"
    )
    assert manifest["source"]["archive_status"] == "not_verified"
    assert "archive_sha256" not in manifest["source"]
    monkeypatch.setattr(settings, "environment", "production")
    report = prepare_model_readiness(_GoodClassifier(), str(destination), str(approval))
    assert not report.ready
    assert report.reason == "production_approval_scope_required"


def test_component_mismatch_is_rejected_before_installation(tmp_path):
    source, record = _components(tmp_path)
    (source / "model.safetensors").write_bytes(b"wrong")
    with pytest.raises(InstallError, match="component_digest_mismatch"):
        install_components(
            source,
            record,
            tmp_path / "installed",
            tmp_path / "approval.json",
            "development-model-c",
            "user-designated-development",
        )
    assert not (tmp_path / "installed").exists()
