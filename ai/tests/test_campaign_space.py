"""Tests for service/campaign_space.py and its use by the matcher (item 19)."""

import importlib.util
import json
import os
import sys
from dataclasses import replace

import numpy as np
import pytest

from retraining.version_file import IntegrityResult
from service import main as service_main
from service import routers
from service.campaign import CampaignCentroid, CampaignMatcher, build_matcher_from_clusters
from service.campaign_space import (
    CampaignSpace,
    resolve_space,
    space_of_label,
    tag_label,
)

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _population(seed=0, n=200, dim=16):
    """Every row shares one strong direction, plus a little individual noise --
    the shape of a classifier embedding that makes all scams look alike."""
    rng = np.random.default_rng(seed)
    shared = np.zeros(dim)
    shared[0] = 20.0
    x = shared + rng.normal(size=(n, dim))
    return (x / np.linalg.norm(x, axis=1, keepdims=True)).astype("float32")


def _calibrated(space, t=0.5, hybrid=None, domain=None):
    return space.with_thresholds(t, hybrid, domain)


# --- the transform ------------------------------------------------------
def test_fit_is_deterministic():
    x = _population()
    a, b = CampaignSpace.fit(x, k=2), CampaignSpace.fit(x.copy(), k=2)
    assert a.space_id == b.space_id
    np.testing.assert_array_equal(a.components, b.components)


def test_apply_removes_the_shared_direction_and_normalizes():
    x = _population()
    space = CampaignSpace.fit(x, k=1)
    out = space.apply(x)
    np.testing.assert_allclose(np.linalg.norm(out, axis=1), 1.0, atol=1e-5)
    # Raw rows are nearly parallel; after removal they are not.
    raw_mean_cos = float((x @ x.T).mean())
    new_mean_cos = float((out @ out.T).mean())
    assert raw_mean_cos > 0.9
    assert new_mean_cos < 0.2
    # Nothing is left along the removed direction.
    np.testing.assert_allclose(out @ space.components.T, 0.0, atol=1e-5)


def test_apply_accepts_a_single_vector():
    x = _population()
    space = CampaignSpace.fit(x, k=2)
    np.testing.assert_allclose(space.apply(x[3]), space.apply(x)[3], atol=1e-6)


def test_fit_rejects_nonsense():
    with pytest.raises(ValueError):
        CampaignSpace.fit(_population(), k=0)
    with pytest.raises(ValueError):
        CampaignSpace.fit(_population(n=2), k=2)


# --- persistence --------------------------------------------------------
def test_save_load_round_trip(tmp_path):
    space = _calibrated(CampaignSpace.fit(_population(), k=2, model_version="v-test"), 0.9, None, 0.8)
    path = str(tmp_path / "space.json")
    space.save(path)
    loaded = CampaignSpace.load(path)
    assert loaded.space_id == space.space_id
    assert (loaded.embedding_threshold, loaded.hybrid_gate, loaded.domain_floor) == (0.9, None, 0.8)
    assert loaded.model_version == "v-test"
    np.testing.assert_allclose(loaded.apply(_population(1)), space.apply(_population(1)), atol=1e-6)


def test_saved_file_holds_no_message_text(tmp_path):
    path = str(tmp_path / "space.json")
    CampaignSpace.fit(_population(), k=2).save(path)
    data = json.load(open(path, encoding="utf-8"))
    assert set(data) == {
        "format",
        "method",
        "space_id",
        "k",
        "model_version",
        "thresholds",
        "label_thresholds",
        "mean",
        "components",
    }


def test_an_edited_file_is_refused(tmp_path):
    path = str(tmp_path / "space.json")
    CampaignSpace.fit(_population(), k=2).save(path)
    data = json.load(open(path, encoding="utf-8"))
    data["mean"][0] += 0.5
    json.dump(data, open(path, "w", encoding="utf-8"))
    with pytest.raises(ValueError, match="inconsistent"):
        CampaignSpace.load(path)


def test_uncalibrated_until_the_embedding_threshold_is_set():
    space = CampaignSpace.fit(_population(), k=2)
    assert not space.calibrated
    assert space.with_thresholds(0.9, None, None).calibrated


# --- labels -------------------------------------------------------------
def test_label_tagging():
    assert tag_label("cluster-3", "abc123") == "cluster-3@space:abc123"
    assert tag_label("cluster-3@space:old", "new") == "cluster-3@space:new"
    assert tag_label("cluster-3@space:old", None) == "cluster-3"
    assert space_of_label("cluster-3@space:abc123") == "abc123"
    assert space_of_label("cluster-3") is None
    assert space_of_label(None) is None


# --- the startup guard --------------------------------------------------
def _space(version="v-C"):
    return _calibrated(CampaignSpace.fit(_population(), k=2, model_version=version))


def test_raw_centroids_run_as_before_even_with_a_space_file():
    enabled, space, _ = resolve_space(["cluster-1", "cluster-2"], _space(), "v-C")
    assert enabled and space is None


def test_matching_space_is_used():
    s = _space()
    enabled, space, _ = resolve_space([tag_label("cluster-1", s.space_id)], s, "v-C")
    assert enabled and space is s


@pytest.mark.parametrize(
    "case",
    ["missing", "other-id", "uncalibrated", "missing-space-model", "missing-served-model", "other-model", "mixed"],
)
def test_any_mismatch_disables_matching(case):
    s = _space()
    labels = [tag_label("cluster-1", s.space_id)]
    loaded, served = s, "v-C"
    if case == "missing":
        loaded = None
    elif case == "other-id":
        labels = [tag_label("cluster-1", "000000000000")]
    elif case == "uncalibrated":
        loaded = CampaignSpace.fit(_population(), k=2, model_version="v-C")
    elif case == "missing-space-model":
        loaded = replace(s, model_version=None)
    elif case == "missing-served-model":
        served = None
    elif case == "other-model":
        served = "v-B"
    elif case == "mixed":
        labels.append("cluster-2")
    enabled, space, reason = resolve_space(labels, loaded, served)
    assert not enabled and space is None and reason


# --- the matcher in a space ---------------------------------------------
def test_matcher_transforms_the_query_and_uses_the_space_threshold():
    x = _population()
    s = _calibrated(CampaignSpace.fit(x, k=1), t=0.95)
    centroid = CampaignCentroid("c1", s.apply(x[0]), label=tag_label("cluster-1", s.space_id))
    matcher = CampaignMatcher([centroid], space=s)
    assert matcher.threshold == 0.95
    assert matcher.match(x[0]).matched  # same message: cos 1.0 in the space
    # A different message is ~0.99 raw (would pass any raw bar) but not in the space.
    assert float(x[0] @ x[1]) > 0.9
    assert not matcher.match(x[1]).matched


def test_a_tier_switched_off_never_fires():
    s = _calibrated(CampaignSpace.fit(_population(), k=1), t=0.99, hybrid=None, domain=None)
    matcher = CampaignMatcher([], space=s)
    assert matcher.hybrid_gate == float("inf") and matcher.domain_floor == float("inf")


def test_matcher_refuses_an_uncalibrated_space():
    with pytest.raises(ValueError):
        CampaignMatcher([], space=CampaignSpace.fit(_population(), k=2))


def test_build_matcher_from_clusters_puts_centroids_in_the_space():
    x = _population()
    s = _calibrated(CampaignSpace.fit(x, k=1), t=0.5)
    labels = [0] * 10 + [-1] * (len(x) - 10)
    matcher = build_matcher_from_clusters(x, labels, space=s)
    (centroid,) = matcher.centroids
    expected = s.apply(x[:10]).mean(axis=0)
    np.testing.assert_allclose(centroid.centroid, expected / np.linalg.norm(expected), atol=1e-5)
    assert matcher.space is s


def test_matcher_without_a_space_is_unchanged():
    from service.campaign import DEFAULT_SIMILARITY_THRESHOLD, DOMAIN_EMBEDDING_FLOOR, HYBRID_EMBEDDING_GATE

    m = CampaignMatcher([])
    assert (m.threshold, m.hybrid_gate, m.domain_floor, m.space) == (
        DEFAULT_SIMILARITY_THRESHOLD,
        HYBRID_EMBEDDING_GATE,
        DOMAIN_EMBEDDING_FLOOR,
        None,
    )


# --- service startup ----------------------------------------------------
def _startup(monkeypatch, tmp_path, centroids, space, served="v-C", integrity="ok"):
    path = str(tmp_path / "space.json")
    if space is not None:
        space.save(path)
    monkeypatch.setattr(service_main, "load_centroids", lambda **_: centroids)
    monkeypatch.setattr(service_main.settings, "campaign_space_file", path)
    service_main.load_campaign_centroids(served, IntegrityResult(integrity, detail="test integrity status"))
    return routers.classify.matcher


def test_startup_loads_the_space_for_tagged_centroids(monkeypatch, tmp_path):
    s = _space()
    c = CampaignCentroid("1", s.apply(_population()[0]), label=tag_label("cluster-1", s.space_id))
    matcher = _startup(monkeypatch, tmp_path, [c], s)
    assert matcher.space is not None and matcher.space.space_id == s.space_id
    assert len(matcher.centroids) == 1


def test_startup_disables_matching_on_a_model_mismatch(monkeypatch, tmp_path):
    s = _space(version="v-B")
    c = CampaignCentroid("1", s.apply(_population()[0]), label=tag_label("cluster-1", s.space_id))
    matcher = _startup(monkeypatch, tmp_path, [c], s, served="v-C")
    assert matcher.centroids == []


def test_startup_disables_matching_without_a_model_identity(monkeypatch, tmp_path):
    s = _space()
    c = CampaignCentroid("1", s.apply(_population()[0]), label=tag_label("cluster-1", s.space_id))
    matcher = _startup(monkeypatch, tmp_path, [c], s, served=None)
    assert matcher.centroids == []


@pytest.mark.parametrize("integrity", ["mismatch", "unverifiable"])
def test_startup_disables_matching_without_verified_checkpoint_integrity(monkeypatch, tmp_path, integrity):
    s = _space()
    c = CampaignCentroid("1", s.apply(_population()[0]), label=tag_label("cluster-1", s.space_id))
    matcher = _startup(monkeypatch, tmp_path, [c], s, integrity=integrity)
    assert matcher.centroids == []


def test_startup_with_raw_centroids_ignores_a_missing_space_file(monkeypatch, tmp_path):
    c = CampaignCentroid("1", [1.0, 0.0], label="cluster-1")
    matcher = _startup(monkeypatch, tmp_path, [c], None)
    assert matcher.space is None and len(matcher.centroids) == 1


# --- sync script --------------------------------------------------------
def test_sync_sends_the_readable_name_and_optionally_the_category():
    spec = importlib.util.spec_from_file_location(
        "sync_campaigns_to_backend_space", os.path.join(_AI_DIR, "scripts", "sync_campaigns_to_backend.py")
    )
    mod = importlib.util.module_from_spec(spec)
    sys.modules["sync_campaigns_to_backend_space"] = mod
    spec.loader.exec_module(mod)
    base = {"labels": {"Scam": 5}, "top_domains": [], "centroid": [0.1], "lexical": {"domains": []}}
    data = {
        "clusters": [
            {
                **base,
                "cluster_id": 1,
                "label": "cluster-1@space:abc",
                "name": "Bank phishing (BDO)",
                "category": "Bank phishing",
            },
            {**base, "cluster_id": 2},  # older file: no name
        ]
    }
    payloads = mod.build_payloads(data)
    assert [p["label"] for p in payloads] == ["Bank phishing (BDO)", "cluster-2"]
    assert all("category" not in p for p in payloads)  # backend DTO would reject it
    with_cat = mod.build_payloads(data, send_category=True)
    assert with_cat[0]["category"] == "Bank phishing" and "category" not in with_cat[1]


# --- checking the vectors, not only the labels --------------------------
def test_holds_tells_transformed_from_raw_vectors():
    x = _population()
    s = CampaignSpace.fit(x, k=2)
    assert s.holds(s.apply(x)).all()
    assert not s.holds(x).any()
    assert not s.holds([1.0, 0.0]).any()  # wrong length


def test_unlabelled_centroids_are_identified_by_their_vectors():
    """The backend path: labels are readable names, so the vectors decide."""
    x = _population()
    s = _space()
    enabled, space, reason = resolve_space(
        ["Bank phishing (BDO)", "Promo (Globe)"], s, "v-C", centroid_vectors=s.apply(x[:2])
    )
    assert enabled and space is s and "vectors" in reason


def test_unlabelled_transformed_centroids_still_check_the_model_version():
    x = _population()
    s = _space(version="v-B")
    enabled, _, _ = resolve_space([None, None], s, "v-C", centroid_vectors=s.apply(x[:2]))
    assert not enabled


def test_a_half_finished_sync_disables_matching():
    x = _population()
    s = _space()
    vectors = [s.apply(x[0]), x[1]]  # one transformed, one raw
    enabled, _, reason = resolve_space([None, None], s, "v-C", centroid_vectors=vectors)
    assert not enabled and "half-finished" in reason


def test_transformed_centroids_without_a_space_file_disable_matching():
    x = _population()
    s = _space()
    enabled, _, reason = resolve_space([None] * 20, None, "v-C", centroid_vectors=s.apply(x[:20]))
    assert not enabled and "campaign_space.json" in reason


def test_raw_centroids_without_a_space_file_still_run():
    x = _population()
    enabled, space, _ = resolve_space([None] * 20, None, "v-C", centroid_vectors=x[:20])
    assert enabled and space is None


def test_raw_vectors_under_a_space_label_disable_matching():
    x = _population()
    s = _space()
    labels = [tag_label("cluster-1", s.space_id)]
    enabled, _, _ = resolve_space(labels, s, "v-C", centroid_vectors=x[:1])
    assert not enabled


def test_raw_centroids_stay_enabled_when_the_vectors_agree():
    x = _population()
    enabled, space, _ = resolve_space(["cluster-1"], _space(), "v-C", centroid_vectors=x[:1])
    assert enabled and space is None


# --- separate thresholds per label (item 19 follow-up) ------------------
def test_label_thresholds_round_trip(tmp_path):
    s = _space().with_label_thresholds("Scam", 0.8, None, 0.7)
    path = str(tmp_path / "space.json")
    s.save(path)
    loaded = CampaignSpace.load(path)
    assert loaded.tiers_for("Scam") == (0.8, None, 0.7)
    assert loaded.tiers_for("Spam") == loaded.tiers_for(None) == (0.5, None, None)


def test_older_space_files_without_label_thresholds_still_load(tmp_path):
    path = str(tmp_path / "space.json")
    _space().save(path)
    data = json.load(open(path, encoding="utf-8"))
    del data["label_thresholds"]
    json.dump(data, open(path, "w", encoding="utf-8"))
    assert CampaignSpace.load(path).label_thresholds == {}


def test_matcher_uses_the_messages_label_to_pick_its_threshold():
    x = _population()
    s = CampaignSpace.fit(x, k=1).with_thresholds(0.999, None, None).with_label_thresholds("Scam", -1.0, None, None)
    matcher = CampaignMatcher([CampaignCentroid("c1", s.apply(x[0]))], space=s)
    assert not matcher.match(x[1]).matched  # shared bar: strict
    assert not matcher.match(x[1], label="Spam").matched
    assert matcher.match(x[1], label="Scam").matched  # Scam's own bar: lenient


def test_classify_passes_the_label_to_the_matcher(monkeypatch):
    from fastapi.testclient import TestClient

    from service.classifier import ClassificationResult
    from service.main import app

    seen = {}

    class Spy(CampaignMatcher):
        def match(self, embedding, text=None, domains=None, label=None):
            seen.update(label=label, domains=domains)
            return super().match(embedding, text, domains=domains, label=label)

    result = ClassificationResult(
        label="Scam",
        score=0.99,
        scores={"Ham": 0.0, "Spam": 0.01, "Scam": 0.99},
        masked_text="x",
        embedding=[1.0, 0.0],
    )
    monkeypatch.setattr(routers.classify.classifier, "classify_full", lambda _t: result)
    monkeypatch.setattr(routers.classify, "matcher", Spy([CampaignCentroid("c1", [1.0, 0.0])]))
    monkeypatch.setattr(routers.classify, "require_model_ready", lambda: None)
    response = TestClient(app).post("/classify", json={"message": "hello"})
    assert response.status_code == 200
    assert seen["label"] == "Scam"


def test_shared_development_refuses_campaign_space_outside_approved_bundle(tmp_path, monkeypatch):
    from service import main as service_main

    model_dir = tmp_path / "model"
    model_dir.mkdir()
    external = tmp_path / "external-space.json"
    replace(_space(), model_version="v-test").with_thresholds(0.9, None, None).save(str(external))
    monkeypatch.setattr(service_main.settings, "environment", "development")
    monkeypatch.setattr(service_main.settings, "model_dir", str(model_dir))
    monkeypatch.setattr(service_main.settings, "campaign_space_file", str(external))

    assert service_main._load_campaign_space() is None


def test_shared_development_loads_campaign_space_inside_approved_bundle(tmp_path, monkeypatch):
    from service import main as service_main

    model_dir = tmp_path / "model"
    model_dir.mkdir()
    bundled = model_dir / "campaign_space.json"
    expected = replace(_space(), model_version="v-test").with_thresholds(0.9, None, None)
    expected.save(str(bundled))
    monkeypatch.setattr(service_main.settings, "environment", "development")
    monkeypatch.setattr(service_main.settings, "model_dir", str(model_dir))
    monkeypatch.setattr(service_main.settings, "campaign_space_file", str(bundled))

    loaded = service_main._load_campaign_space()
    assert loaded is not None
    assert loaded.space_id == expected.space_id


# --- live centroid refresh ---------------------------------------------
def test_refresh_applies_new_backend_centroids(monkeypatch, tmp_path):
    s = _space()
    first = CampaignCentroid("1", s.apply(_population()[0]), label=tag_label("cluster-1", s.space_id))
    _startup(monkeypatch, tmp_path, [first], s)
    second = CampaignCentroid("2", s.apply(_population()[1]), label=tag_label("cluster-2", s.space_id))
    monkeypatch.setattr(service_main, "load_from_backend", lambda *_a, **_k: [first, second])
    assert service_main.refresh_campaign_centroids("v-C", IntegrityResult("ok", detail="t")) is True
    assert {c.cluster_id for c in routers.classify.matcher.centroids} == {"1", "2"}


def test_refresh_failure_keeps_the_current_matcher(monkeypatch, tmp_path):
    s = _space()
    c = CampaignCentroid("1", s.apply(_population()[0]), label=tag_label("cluster-1", s.space_id))
    before = _startup(monkeypatch, tmp_path, [c], s)

    def boom(*_a, **_k):
        raise OSError("backend down")

    monkeypatch.setattr(service_main, "load_from_backend", boom)
    assert service_main.refresh_campaign_centroids("v-C", IntegrityResult("ok", detail="t")) is False
    assert routers.classify.matcher is before


def test_refresh_keeps_the_matcher_when_applying_fails(monkeypatch, tmp_path):
    s = _space()
    c = CampaignCentroid("1", s.apply(_population()[0]), label=tag_label("cluster-1", s.space_id))
    before = _startup(monkeypatch, tmp_path, [c], s)
    monkeypatch.setattr(service_main, "load_from_backend", lambda *_a, **_k: [c])

    def broken(*_a, **_k):
        raise ValueError("uncalibrated space")

    monkeypatch.setattr(service_main, "apply_campaign_centroids", broken)
    assert service_main.refresh_campaign_centroids("v-C", IntegrityResult("ok", detail="t")) is False
    assert routers.classify.matcher is before
