"""Tests for the lexical second signal (Sprint 5, WBS 5.3.6).

These cover the properties the hybrid match tiers actually depend on: that a
profile captures what a campaign holds in common rather than any one member's
noise, that similarity is high for template-following messages and low for
unrelated ones, and that every "no profile" path degrades to a neutral 0.0
rather than raising or, worse, returning a confident wrong answer.
"""

from __future__ import annotations

from service.lexical import (
    MIN_PROFILE_SHINGLES,
    LexicalProfile,
    build_profile,
    extract_domains,
    lexical_similarity,
    shares_domain,
    shingles,
)

# A templated blast: identical wording, different link and amount each send --
# which is exactly what masking is there to normalize away.
CAMPAIGN = [
    "Congrats! Your GCash account won P5000. Claim now at http://gcash-promo.xyz/a",
    "Congrats! Your GCash account won P2500. Claim now at http://gcash-promo.xyz/b",
    "Congrats! Your GCash account won P9000. Claim now at http://gcash-promo.xyz/c",
    "Congrats! Your GCash account won P1500. Claim now at http://gcash-promo.xyz/d",
]

UNRELATED = "Hi po, nasa palengke na ako. Anong ulam gusto mo mamaya?"


def test_shingles_include_unigrams_and_bigrams():
    out = shingles("claim your prize")
    assert "claim" in out
    assert "claim your" in out
    assert "your prize" in out


def test_shingles_mask_volatile_parts():
    """Two sends differing only in link/amount must shingle identically."""
    a = shingles("Won P5000 claim at http://a.xyz/1")
    b = shingles("Won P2500 claim at http://b.xyz/2")
    assert a == b


def test_extract_domains_strips_www_and_lowercases():
    assert extract_domains("go to WWW.BDO-Verify.XYZ now") == ["bdo-verify.xyz"]


def test_extract_domains_handles_defanged_urls():
    """``hxxp`` de-fanging appears in threat reports and shared scam texts."""
    assert extract_domains("hxxp://evil-bank.top/login") == ["evil-bank.top"]


def test_profile_keeps_common_wording_not_member_noise():
    texts = CAMPAIGN + ["Congrats! Your GCash account won P100. zzz unique filler"]
    profile = build_profile(texts)
    assert "congrats" in profile.shingles
    # Present in exactly one member, so below the 50% document frequency bar.
    assert "zzz" not in profile.shingles


def test_profile_member_count_is_recorded():
    assert build_profile(CAMPAIGN).member_count == 4


def test_member_scores_far_above_stranger():
    profile = build_profile(CAMPAIGN)
    member = lexical_similarity(
        "Congrats! Your GCash account won P777. Claim now at http://gcash-promo.xyz/z",
        profile,
    )
    stranger = lexical_similarity(UNRELATED, profile)
    assert member > 0.8
    assert stranger < 0.1
    assert member - stranger > 0.5


def test_short_on_template_message_does_not_score_perfect():
    """The precision half of Dice is what stops this from being a 1.0.

    A two-word message that happens to be on-template covers almost none of
    the campaign, and coverage is what drags the harmonic mean down.
    """
    profile = build_profile(CAMPAIGN)
    assert lexical_similarity("Congrats!", profile) < 0.5


def test_non_distinctive_profile_scores_zero():
    """A tiny profile must abstain, not "confirm" everything it sees."""
    thin = LexicalProfile(shingles={"your", "account"}, member_count=2)
    assert len(thin.shingles) < MIN_PROFILE_SHINGLES
    assert lexical_similarity("your account", thin) == 0.0


def test_missing_profile_scores_zero():
    assert lexical_similarity("anything at all", None) == 0.0


def test_empty_message_scores_zero():
    assert lexical_similarity("", build_profile(CAMPAIGN)) == 0.0


def test_shares_domain_matches_and_rejects():
    profile = build_profile(CAMPAIGN, domains={"gcash-promo.xyz"})
    assert shares_domain("click http://gcash-promo.xyz/new", profile)
    assert not shares_domain("click http://other-site.com/new", profile)
    assert not shares_domain("no links here at all", profile)


def test_shares_domain_without_domains_is_false():
    assert not shares_domain("http://gcash-promo.xyz", build_profile(CAMPAIGN))
    assert not shares_domain("http://gcash-promo.xyz", None)


def test_profile_round_trips_through_dict():
    profile = build_profile(CAMPAIGN, domains={"gcash-promo.xyz"})
    restored = LexicalProfile.from_dict(profile.to_dict())
    assert restored is not None
    assert restored.shingles == profile.shingles
    assert restored.domains == profile.domains
    assert restored.member_count == profile.member_count


def test_from_dict_returns_none_for_unusable_input():
    """Campaigns clustered before this module existed must degrade, not crash."""
    assert LexicalProfile.from_dict(None) is None
    assert LexicalProfile.from_dict({}) is None
    assert LexicalProfile.from_dict({"shingles": "not-a-list"}) is None
