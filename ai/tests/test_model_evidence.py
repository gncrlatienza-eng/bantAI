"""Candidate evidence binding (audit 2026-09-30, finding 2)."""

import json

import pytest

from retraining.checksum import bundle_digest, hash_bundle
from retraining.registry import (
    EvidenceError,
    ModelRegistry,
    candidate_evidence,
    candidate_provenance,
)
from retraining.version_file import write_version


def test_bundle_digest_matches_the_backend_byte_for_byte():
    # Same fixture as backend/src/models/model-evidence.spec.ts.
    assert (
        bundle_digest(
            {
                "tokenizer.json": "c" * 64,
                "config.json": "a" * 64,
                "model.safetensors": "B" * 64,
                "version.json": "d" * 64,
            }
        )
        == "64d70b77c8998c3f53fce19dbcdef9e6853108d005777185f2dbf90e60c28980"
    )


@pytest.fixture
def candidate(tmp_path):
    model_dir = tmp_path / "candidate"
    (model_dir / "sub").mkdir(parents=True)
    (model_dir / "config.json").write_text("{}", encoding="utf-8")
    (model_dir / "model.safetensors").write_bytes(b"weights")
    (model_dir / "sub" / "extra.txt").write_text("x", encoding="utf-8")
    write_version(str(model_dir), "v-test")
    return model_dir


def _report(model_dir, **overrides):
    report = {
        "version_tag": "v-test",
        "bundle_digest": bundle_digest(hash_bundle(str(model_dir))),
        "holdout_integrity": "ok",
        "checkpoint_integrity": "ok",
        "holdout_sha256": "f" * 64,
        "n_total": 30,
        "macro_f1": 0.9,
        "evaluated_at": "2026-09-30T00:00:00+00:00",
        "per_class_metrics": {
            label: {"support": 10, "precision": 0.9, "recall": 0.9, "f1": 0.9, "true_positives": 9}
            for label in ("Ham", "Spam", "Scam")
        },
    }
    report.update(overrides)
    return report


def test_hash_bundle_covers_every_file_by_posix_path(candidate):
    artifacts = hash_bundle(str(candidate))
    assert set(artifacts) == {"config.json", "model.safetensors", "sub/extra.txt", "version.json"}


def test_candidate_evidence_builds_the_backend_contract(candidate, tmp_path):
    path = tmp_path / "holdout.json"
    path.write_text(json.dumps(_report(candidate)), encoding="utf-8")

    f1, evaluation, provenance = candidate_evidence(str(candidate), str(path), "dataset-a", "E" * 64)

    assert f1 == 0.9
    assert evaluation["holdout"] == {"sha256": "f" * 64, "rows": 30}
    assert evaluation["perClass"]["Scam"] == {"support": 10, "precision": 0.9, "recall": 0.9, "f1": 0.9}
    assert evaluation["versionTag"] == "v-test"
    assert provenance["datasetVersion"] == "dataset-a"
    assert provenance["datasetDigest"] == "e" * 64
    assert "model.safetensors" in provenance["artifacts"]


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"version_tag": "v-other"}, "graded 'v-other'"),
        ({"bundle_digest": "0" * 64}, "different model files"),
        ({"holdout_integrity": "mismatch"}, "drifted"),
        ({"per_class_metrics": {}}, "incomplete"),
    ],
)
def test_unattributable_holdout_reports_are_refused(candidate, tmp_path, overrides, message):
    path = tmp_path / "holdout.json"
    path.write_text(json.dumps(_report(candidate, **overrides)), encoding="utf-8")
    with pytest.raises(EvidenceError, match=message):
        candidate_evidence(str(candidate), str(path), "dataset-a", "e" * 64)


def test_a_dataset_identity_is_required(candidate):
    with pytest.raises(EvidenceError):
        candidate_provenance(str(candidate), "  ", "e" * 64)
    with pytest.raises(EvidenceError):
        candidate_provenance(str(candidate), "dataset-a", "not-a-digest")


def test_register_forwards_evidence(monkeypatch):
    sent = {}

    def fake_call(self, path, method, payload=None):
        sent.update(path=path, method=method, payload=payload)
        return {"id": "m1"}

    monkeypatch.setattr(ModelRegistry, "_call", fake_call)
    ModelRegistry("http://backend/api", "k").register(
        "v1", 0.9, evaluation={"macroF1": 0.9}, provenance={"datasetVersion": "d"}
    )
    assert sent["payload"]["evaluation"] == {"macroF1": 0.9}
    assert sent["payload"]["provenance"] == {"datasetVersion": "d"}
