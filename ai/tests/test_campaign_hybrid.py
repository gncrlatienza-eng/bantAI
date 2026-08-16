"""Hybrid campaign-match tiers (Sprint 5, WBS 5.3.6).

The embedding-only rule works but has ~0.0008 of usable margin. These tests
cover the two corroborated routes added on top of it, and -- more importantly
-- the guarantees that make adding them safe:

* the rule is **monotone**: anything the embedding-only bar matched still
  matches, so nothing that was calibrated can regress;
* wording is never sufficient on its own, so the manuscript's specified
  embedding comparison stays primary;
* campaigns with no lexical profile behave exactly as they did before.
"""

from __future__ import annotations

import numpy as np

from service.campaign import (
    DEFAULT_SIMILARITY_THRESHOLD,
    DOMAIN_EMBEDDING_FLOOR,
    HYBRID_EMBEDDING_GATE,
    LEXICAL_GATE,
    CampaignCentroid,
    CampaignMatcher,
    build_matcher_from_clusters,
)
from service.lexical import build_profile

CAMPAIGN = [
    "Congrats! Your GCash account won P5000. Claim now at http://gcash-promo.xyz/a",
    "Congrats! Your GCash account won P2500. Claim now at http://gcash-promo.xyz/b",
    "Congrats! Your GCash account won P9000. Claim now at http://gcash-promo.xyz/c",
    "Congrats! Your GCash account won P1500. Claim now at http://gcash-promo.xyz/d",
]
ON_TEMPLATE = "Congrats! Your GCash account won P777. Claim now at http://gcash-promo.xyz/z"
#: Same template, *different* link -- campaigns rotate domains as they get
#: blocked, which is the case the wording tier exists to catch. Kept distinct
#: from ON_TEMPLATE so the hybrid tier can be tested without the stronger
#: domain tier claiming the match first.
ON_TEMPLATE_NEW_DOMAIN = "Congrats! Your GCash account won P777. Claim now at http://gcash-promo2.top/z"
UNRELATED = "Hi po, nasa palengke na ako. Anong ulam gusto mo mamaya?"

PROFILE = build_profile(CAMPAIGN, domains={"gcash-promo.xyz"})


def at_similarity(sim: float) -> np.ndarray:
    """A unit vector exactly ``sim`` cosine away from ``[1, 0, 0]``."""
    return np.array([sim, float(np.sqrt(max(0.0, 1.0 - sim**2))), 0.0], dtype="float32")


def matcher_with_profile(profile=PROFILE) -> CampaignMatcher:
    return CampaignMatcher([CampaignCentroid("c1", at_similarity(1.0), lexical=profile)])


# --- tier 3: the calibrated embedding bar, unchanged ------------------------
def test_embedding_tier_still_matches_without_text():
    """Existing callers pass no text; behaviour must be exactly as before."""
    result = matcher_with_profile().match(at_similarity(0.9999))
    assert result.matched
    assert result.match_reason == "embedding"
    assert result.lexical_similarity == 0.0


def test_below_threshold_and_off_template_still_buffers():
    result = matcher_with_profile().match(at_similarity(0.995), UNRELATED)
    assert not result.matched
    assert result.should_buffer
    assert result.cluster_id is None
    assert result.match_reason is None


# --- tier 2: relaxed embedding + wording ------------------------------------
def test_hybrid_tier_recovers_a_member_the_embedding_bar_would_miss():
    """The point of the whole exercise: a real member just under 0.999."""
    sim = (HYBRID_EMBEDDING_GATE + DEFAULT_SIMILARITY_THRESHOLD) / 2
    assert sim < DEFAULT_SIMILARITY_THRESHOLD  # would have been rejected before

    result = matcher_with_profile().match(at_similarity(sim), ON_TEMPLATE_NEW_DOMAIN)
    assert result.matched
    assert result.match_reason == "hybrid"
    assert result.lexical_similarity >= LEXICAL_GATE


def test_domain_tier_outranks_the_hybrid_tier():
    """Same message, one variant sharing the campaign's link. Ordering holds."""
    sim = (HYBRID_EMBEDDING_GATE + DEFAULT_SIMILARITY_THRESHOLD) / 2
    matcher = matcher_with_profile()
    assert matcher.match(at_similarity(sim), ON_TEMPLATE).match_reason == "domain"
    assert matcher.match(at_similarity(sim), ON_TEMPLATE_NEW_DOMAIN).match_reason == "hybrid"


def test_wording_alone_is_never_enough():
    """Below the relaxed embedding gate, perfect wording must not match.

    This is what keeps the manuscript's embedding comparison primary rather
    than decorative.
    """
    result = matcher_with_profile().match(at_similarity(0.5), CAMPAIGN[0])
    assert not result.matched
    assert result.match_reason is None


def test_relaxed_embedding_alone_is_never_enough():
    """At 0.99 the embedding admits ~30% of strangers, hence the corroboration."""
    result = matcher_with_profile().match(at_similarity(HYBRID_EMBEDDING_GATE), UNRELATED)
    assert not result.matched


# --- tier 1: shared domain --------------------------------------------------
def test_domain_tier_matches_a_reworded_blast():
    """Same destination, rewritten copy -- the case wording alone would miss."""
    body = "URGENT: verify ngayon dito http://gcash-promo.xyz/verify or account closed"
    result = matcher_with_profile().match(at_similarity(0.95), body)
    assert result.matched
    assert result.match_reason == "domain"


def test_domain_tier_respects_its_embedding_floor():
    """A Ham message quoting a scam link must not be filed as a member."""
    body = "is http://gcash-promo.xyz legit? someone sent me this, parang scam"
    below = DOMAIN_EMBEDDING_FLOOR - 0.05
    assert not matcher_with_profile().match(at_similarity(below), body).matched


def test_domain_tier_outranks_a_bare_embedding_match():
    """Evidence strength decides, not which centroid scores highest cosine.

    ``weak`` shares the campaign's domain at 0.95; ``strong`` is a different
    campaign that happens to clear 0.999. The domain-corroborated one wins.
    """
    matcher = CampaignMatcher(
        [
            CampaignCentroid("domain-hit", at_similarity(0.95), lexical=PROFILE),
            CampaignCentroid("bare-hit", at_similarity(1.0)),
        ]
    )
    result = matcher.match(at_similarity(0.95), CAMPAIGN[0])
    assert result.cluster_id == "domain-hit"
    assert result.match_reason == "domain"


# --- safety properties ------------------------------------------------------
def test_campaigns_without_a_profile_are_embedding_only():
    """Clusters written before WBS 5.3.6 must keep working untouched."""
    matcher = CampaignMatcher([CampaignCentroid("old", at_similarity(1.0))])
    assert matcher.match(at_similarity(0.9999), ON_TEMPLATE).match_reason == "embedding"
    assert not matcher.match(at_similarity(0.995), ON_TEMPLATE).matched


def test_hybrid_path_is_monotone_over_the_embedding_bar():
    """Passing text can only add matches, never remove one.

    This is the property that makes the hybrid tiers safe to ship on top of a
    calibrated threshold: the measured 0.999 behaviour is a floor.
    """
    matcher = matcher_with_profile()
    for sim in (0.5, 0.9, 0.99, 0.9991, 0.9999, 1.0):
        for text in (ON_TEMPLATE, UNRELATED, CAMPAIGN[0]):
            without = matcher.match(at_similarity(sim))
            with_text = matcher.match(at_similarity(sim), text)
            if without.matched:
                assert with_text.matched, (sim, text)


def test_cold_start_buffers_everything():
    result = CampaignMatcher().match(at_similarity(1.0), CAMPAIGN[0])
    assert not result.matched
    assert result.should_buffer


def test_build_matcher_from_clusters_attaches_profiles():
    """The offline pass must hand the fast path usable profiles."""
    embeddings = np.array([at_similarity(1.0)] * 4 + [at_similarity(0.0)])
    matcher = build_matcher_from_clusters(embeddings, [0, 0, 0, 0, -1], texts=CAMPAIGN + [UNRELATED])
    (centroid,) = matcher.centroids
    assert centroid.lexical is not None
    assert centroid.lexical.is_distinctive
    assert "gcash-promo.xyz" in centroid.lexical.domains
    assert centroid.url_domains == ["gcash-promo.xyz"]


def test_build_matcher_without_texts_leaves_profiles_empty():
    embeddings = np.array([at_similarity(1.0)] * 4)
    matcher = build_matcher_from_clusters(embeddings, [0, 0, 0, 0])
    assert matcher.centroids[0].lexical is None
