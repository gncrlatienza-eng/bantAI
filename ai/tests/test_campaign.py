"""Unit tests for cosine-similarity campaign matching (WBS 3.4.1).

Exercises the fast-path matcher directly with synthetic embeddings -- no model
and no database needed. The boundary cases around the match threshold are the
point of this file. That threshold is ``DEFAULT_SIMILARITY_THRESHOLD``, which
Sprint 5 (WBS 5.3.6) re-calibrated from the manuscript's 0.85 to 0.999 after
measuring that 0.85 attached 54.5% of unrelated messages.

The hybrid corroboration tiers added in the same WBS item are covered
separately in ``test_campaign_hybrid.py``.
"""

import numpy as np
import pytest

from service.campaign import (
    DEFAULT_SIMILARITY_THRESHOLD,
    CampaignCentroid,
    CampaignMatcher,
    build_matcher_from_clusters,
    compute_centroid,
    cosine_similarity,
)


def unit(*values) -> np.ndarray:
    """A unit-length vector, matching what service.embeddings produces."""
    v = np.array(values, dtype="float32")
    return v / np.linalg.norm(v)


# --- cosine_similarity ------------------------------------------------------
def test_identical_vectors_are_similarity_one():
    v = unit(1, 2, 3)
    assert cosine_similarity(v, v) == pytest.approx(1.0, abs=1e-6)


def test_orthogonal_vectors_are_zero():
    assert cosine_similarity(unit(1, 0), unit(0, 1)) == pytest.approx(0.0, abs=1e-6)


def test_opposite_vectors_are_negative_one():
    assert cosine_similarity(unit(1, 0), unit(-1, 0)) == pytest.approx(-1.0, abs=1e-6)


def test_magnitude_does_not_matter():
    """Cosine is angle-only -- an un-normalized centroid must still compare
    correctly, which is why the function divides by norms explicitly."""
    a = np.array([1.0, 0.0], dtype="float32")
    b = np.array([50.0, 0.0], dtype="float32")
    assert cosine_similarity(a, b) == pytest.approx(1.0, abs=1e-6)


def test_zero_vector_does_not_divide_by_zero():
    assert cosine_similarity(np.zeros(3), unit(1, 1, 1)) == 0.0


# --- threshold behaviour ----------------------------------------------------
def test_threshold_is_the_calibrated_value_not_the_manuscript_default():
    """0.999, re-calibrated in Sprint 5 (WBS 5.3.6) -- not the manuscript's 0.85.

    The manuscript's value was measured to attach 54.5% of *unrelated*
    messages to campaigns, because Stage 5b reuses a classifier embedding and
    that embedding encodes class rather than campaign: unrelated Scam pairs
    already average 0.90 cosine. Pinned here so the number cannot drift back
    without someone reading why it moved.
    """
    assert DEFAULT_SIMILARITY_THRESHOLD == 0.999


def test_manuscript_threshold_would_admit_unrelated_messages():
    """Documents the defect the re-calibration fixes.

    0.90 is the measured average similarity between two *unrelated* Scam
    messages. Under the manuscript's 0.85 this attached; it must not now.
    """
    matcher = CampaignMatcher([CampaignCentroid("c1", unit(1, 0, 0))])
    angle = np.arccos(0.90)
    unrelated = unit(np.cos(angle), np.sin(angle), 0.0)
    assert matcher.match(unrelated).matched is False


def test_close_message_attaches_to_cluster():
    matcher = CampaignMatcher([CampaignCentroid("c1", unit(1, 0, 0))])
    # 0.9998 -- the measured mean similarity of a real campaign member to its
    # own centroid (scripts/calibrate_match_threshold.py).
    angle = np.arccos(0.9998)
    result = matcher.match(unit(np.cos(angle), np.sin(angle), 0.0))
    assert result.matched is True
    assert result.cluster_id == "c1"
    assert result.should_buffer is False


def test_distant_message_buffers_instead():
    matcher = CampaignMatcher([CampaignCentroid("c1", unit(1, 0, 0))])
    result = matcher.match(unit(0, 1, 0))
    assert result.matched is False
    assert result.cluster_id is None
    assert result.should_buffer is True


def test_just_below_threshold_does_not_match():
    """0.9989 must buffer -- the boundary is the whole point of the rule."""
    matcher = CampaignMatcher([CampaignCentroid("c1", unit(1, 0, 0))])
    angle = np.arccos(0.9989)
    just_below = unit(np.cos(angle), np.sin(angle), 0.0)
    assert matcher.match(just_below).matched is False


def test_at_threshold_matches():
    """'At least' is inclusive -- the manuscript's rule shape is unchanged."""
    matcher = CampaignMatcher([CampaignCentroid("c1", unit(1, 0, 0))])
    angle = np.arccos(0.9991)
    at_threshold = unit(np.cos(angle), np.sin(angle), 0.0)
    assert matcher.match(at_threshold).matched is True


def test_picks_the_closest_of_several_clusters():
    matcher = CampaignMatcher(
        [
            CampaignCentroid("far", unit(0, 1, 0)),
            CampaignCentroid("near", unit(1, 0, 0)),
        ]
    )
    # Must clear the calibrated 0.999 bar, or "closest" is moot -- nothing
    # matches and the ranking under test never runs.
    angle = np.arccos(0.9999)
    result = matcher.match(unit(np.cos(angle), np.sin(angle), 0.0))
    assert result.cluster_id == "near"


def test_cold_start_buffers_everything():
    """No active clusters yet -- nothing can match, so it must buffer."""
    result = CampaignMatcher([]).match(unit(1, 0, 0))
    assert result.matched is False
    assert result.should_buffer is True
    assert result.similarity == 0.0


def test_negative_similarity_is_reported_honestly():
    """A genuinely negative best-match must not be rounded up to 0.0 -- the
    reported similarity feeds threshold tuning, so it has to be the real one."""
    matcher = CampaignMatcher([CampaignCentroid("c1", unit(1, 0, 0))])
    result = matcher.match(unit(-1, 0, 0))
    assert result.similarity == pytest.approx(-1.0, abs=1e-6)
    assert result.matched is False


def test_threshold_is_configurable():
    loose = CampaignMatcher([CampaignCentroid("c1", unit(1, 0, 0))], threshold=0.5)
    assert loose.match(unit(0.7, 0.71, 0.0)).matched is True


# --- centroids --------------------------------------------------------------
def test_centroid_is_unit_length():
    """Averaging unit vectors does not yield a unit vector, so compute_centroid
    must re-normalize or similarity scores drift."""
    centroid = compute_centroid([unit(1, 0, 0), unit(0.9, 0.44, 0)])
    assert np.linalg.norm(centroid) == pytest.approx(1.0, abs=1e-5)


def test_centroid_of_one_vector_is_itself():
    v = unit(1, 2, 3)
    assert np.allclose(compute_centroid([v]), v, atol=1e-6)


def test_centroid_sits_between_its_members():
    centroid = compute_centroid([unit(1, 0), unit(0, 1)])
    assert cosine_similarity(centroid, unit(1, 0)) == pytest.approx(
        cosine_similarity(centroid, unit(0, 1)), abs=1e-6
    )


# --- building a matcher from clustering output ------------------------------
def test_build_matcher_skips_noise_points():
    """HDBSCAN labels one-offs as -1; those are not campaigns."""
    embeddings = np.array([unit(1, 0), unit(1, 0.05), unit(0, 1)])
    matcher = build_matcher_from_clusters(embeddings, [0, 0, -1])
    assert len(matcher.centroids) == 1
    assert matcher.centroids[0].cluster_id == "0"


def test_build_matcher_creates_one_centroid_per_cluster():
    embeddings = np.array([unit(1, 0), unit(1, 0.05), unit(0, 1), unit(0.05, 1)])
    matcher = build_matcher_from_clusters(embeddings, [0, 0, 1, 1])
    assert {c.cluster_id for c in matcher.centroids} == {"0", "1"}


def test_round_trip_member_matches_its_own_cluster():
    """A message used to build a cluster must match that cluster back.

    Members are spaced to match real campaigns rather than the loose 0.99 this
    used before the 5.3.6 re-calibration. Measured campaign members sit at
    ~0.9998 from their own centroid, so two members 0.99 apart -- which put the
    centroid ~0.9987 from each -- were never representative; under the
    calibrated 0.999 they would (correctly) fail to round-trip.
    """
    close = np.arccos(0.99999)
    embeddings = np.array(
        [unit(1, 0, 0), unit(np.cos(close), np.sin(close), 0), unit(0, 1, 0)]
    )
    matcher = build_matcher_from_clusters(embeddings, [0, 0, -1])
    assert matcher.match(embeddings[0]).cluster_id == "0"


def test_match_result_serializes_for_api():
    matcher = CampaignMatcher([CampaignCentroid("c1", unit(1, 0, 0))])
    payload = matcher.match(unit(1, 0, 0)).to_dict()
    # ``lexical_similarity`` and ``match_reason`` were added by the WBS 5.3.6
    # hybrid tiers; they are always present so a campaign attribution can be
    # explained after the fact, even on the embedding-only route.
    assert set(payload) == {
        "cluster_id",
        "similarity",
        "matched",
        "should_buffer",
        "lexical_similarity",
        "match_reason",
    }
    assert payload["match_reason"] == "embedding"
