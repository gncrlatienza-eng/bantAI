"""Unit tests for HDBSCAN campaign grouping stability (WBS 3.4.2).

"Stability" here means three concrete properties, tested with synthetic
embeddings rather than a trained model:

  1. **Determinism** -- same input, same clusters. Campaign IDs surface to
     users and get persisted, so a re-run that silently renumbered everything
     would be a real bug.
  2. **Correct grouping** -- messages that are semantically close land in one
     cluster, distant ones do not get merged.
  3. **Noise handling** -- genuine one-offs are labeled -1 rather than forced
     into a campaign, and a group below ``min_cluster_size`` is not promoted
     to a campaign.
"""

import numpy as np
import pytest

from scripts.cluster_campaigns import (
    DEFAULT_MIN_CLUSTER_SIZE,
    _extract_domains,
    cluster_embeddings,
)


def blob(center, n, spread=0.01, dim=8, seed=0):
    """n unit vectors tightly packed around ``center`` -- stands in for one
    campaign's worth of near-identical blast messages."""
    rng = np.random.default_rng(seed)
    base = np.zeros(dim, dtype="float32")
    base[center] = 1.0
    pts = base + rng.normal(0, spread, size=(n, dim)).astype("float32")
    return pts / np.linalg.norm(pts, axis=1, keepdims=True)


def test_manuscript_min_cluster_size_is_5():
    assert DEFAULT_MIN_CLUSTER_SIZE == 5


# --- grouping ---------------------------------------------------------------
def test_two_tight_groups_are_separated():
    data = np.vstack([blob(0, 20, seed=1), blob(4, 20, seed=2)])
    labels = cluster_embeddings(data, min_cluster_size=5)

    assert len({c for c in labels if c != -1}) == 2
    # Every member of each half agrees with its own group.
    assert len(set(labels[:20])) == 1
    assert len(set(labels[20:])) == 1
    assert labels[0] != labels[20]


def test_members_of_one_campaign_share_a_cluster():
    """Members of a campaign group together when there is other traffic to
    contrast against -- the realistic case, since a live buffer holds a mix."""
    data = np.vstack([blob(0, 30, seed=3), blob(5, 30, spread=0.15, seed=20)])
    labels = cluster_embeddings(data, min_cluster_size=5)
    campaign = labels[:30]
    assigned = [c for c in campaign if c != -1]
    assert len(assigned) > 0
    assert len(set(assigned)) == 1


def test_single_homogeneous_blob_is_found_with_the_calibrated_default():
    """The Sprint 5 (WBS 5.3.6) ``min_samples=2`` default lifts a real limit.

    Under sklearn's default -- ``min_samples`` silently equal to
    ``min_cluster_size`` -- a buffer holding one campaign and no background
    found *nothing*: HDBSCAN is density-based and needs contrast, and requiring
    5 core neighbours made a uniform group indistinguishable from noise. That
    was an operational hazard, because a buffer containing a single active
    campaign is an ordinary situation, not a pathological one.

    Decoupling ``min_samples`` fixes it. Pinned by
    :func:`test_conservative_min_samples_still_finds_no_contrast` below, which
    keeps the old behaviour documented and reachable.
    """
    labels = cluster_embeddings(blob(0, 30, seed=3), min_cluster_size=5)
    assert any(c != -1 for c in labels)


def test_conservative_min_samples_still_finds_no_contrast():
    """The pre-5.3.6 behaviour, preserved as the explanation for the change.

    With ``min_samples`` back at ``min_cluster_size``, one uniform group and no
    background is still all-noise -- the property is real, it was simply the
    wrong default for this pipeline.
    """
    labels = cluster_embeddings(
        blob(0, 30, seed=3), min_cluster_size=5, min_samples=5
    )
    assert all(c == -1 for c in labels)


def test_three_campaigns_stay_distinct():
    data = np.vstack([blob(0, 15, seed=4), blob(3, 15, seed=5), blob(6, 15, seed=6)])
    labels = cluster_embeddings(data, min_cluster_size=5)
    assert len({c for c in labels if c != -1}) == 3


# --- noise ------------------------------------------------------------------
def test_lone_outlier_is_noise_not_a_campaign():
    """A single unrelated message must not become its own campaign."""
    outlier = np.zeros((1, 8), dtype="float32")
    outlier[0, 7] = 1.0
    data = np.vstack([blob(0, 20, seed=7), outlier])
    labels = cluster_embeddings(data, min_cluster_size=5)
    assert labels[-1] == -1


def test_group_below_min_cluster_size_is_not_promoted():
    """3 similar messages with min_cluster_size=5 is not yet a campaign --
    this is exactly the buffering behaviour the manuscript describes."""
    data = np.vstack([blob(0, 25, seed=8), blob(5, 3, seed=9)])
    labels = cluster_embeddings(data, min_cluster_size=5)
    assert all(c == -1 for c in labels[-3:])


def test_min_cluster_size_is_respected():
    """No cluster may be smaller than min_cluster_size."""
    data = np.vstack([blob(0, 12, seed=10), blob(4, 12, seed=11)])
    labels = cluster_embeddings(data, min_cluster_size=5)
    for cid in {c for c in labels if c != -1}:
        assert int((labels == cid).sum()) >= 5


# --- determinism ------------------------------------------------------------
def test_same_input_gives_same_clusters():
    data = np.vstack([blob(0, 20, seed=12), blob(4, 20, seed=13)])
    assert np.array_equal(
        cluster_embeddings(data, min_cluster_size=5),
        cluster_embeddings(data, min_cluster_size=5),
    )


def test_repeated_runs_are_stable_across_many_iterations():
    data = np.vstack([blob(0, 15, seed=14), blob(3, 15, seed=15), blob(6, 15, seed=16)])
    first = cluster_embeddings(data, min_cluster_size=5)
    for _ in range(3):
        assert np.array_equal(cluster_embeddings(data, min_cluster_size=5), first)


def test_row_order_does_not_change_groupings():
    """Shuffling input must not change *which messages group together*
    (cluster numbering may differ, membership must not)."""
    data = np.vstack([blob(0, 20, seed=17), blob(4, 20, seed=18)])
    labels = cluster_embeddings(data, min_cluster_size=5)

    rng = np.random.default_rng(99)
    order = rng.permutation(len(data))
    shuffled = cluster_embeddings(data[order], min_cluster_size=5)

    # Restore original positions, then compare partitions as sets of members.
    restored = np.empty_like(shuffled)
    restored[order] = shuffled

    def partition(lbls):
        return {
            frozenset(np.where(lbls == c)[0].tolist())
            for c in set(lbls)
            if c != -1
        }

    assert partition(labels) == partition(restored)


# --- domain extraction (feeds CampaignCluster.urlDomains) -------------------
def test_extracts_domain_from_url():
    assert _extract_domains("Claim now https://bit.ly/abc123") == ["bit.ly"]


def test_strips_www_prefix():
    assert _extract_domains("visit www.example.com/page") == ["example.com"]


def test_extracts_multiple_domains():
    found = _extract_domains("go to https://a.com/x or https://b.ph/y")
    assert found == ["a.com", "b.ph"]


def test_no_urls_returns_empty():
    assert _extract_domains("Hi, see you at 5pm") == []
