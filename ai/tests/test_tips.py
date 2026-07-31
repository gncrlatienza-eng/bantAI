"""Unit tests for scam awareness tip lookup (WBS 3.3.7)."""

from service.indicator_tags import TAG_KEYWORDS
from service.tips import (
    CLUSTER_TIP_OVERRIDES,
    FALLBACK_TIP,
    all_tips,
    tip_for_cluster,
    tip_for_tag,
)


def test_every_indicator_tag_has_a_tip():
    """The tag vocabulary (3.1.2) and the tip catalogue must not drift apart --
    a user shown 'Prize Lure' must be able to get the Prize Lure card."""
    keyword_tags = set(TAG_KEYWORDS)
    structural = {"Suspicious URL", "Brand Impersonation"}
    for tag in keyword_tags | structural:
        assert tip_for_tag(tag) is not FALLBACK_TIP, f"no tip for {tag}"


def test_unknown_tag_falls_back():
    assert tip_for_tag("Not A Real Tag") is FALLBACK_TIP


def test_tip_has_usable_content():
    tip = tip_for_tag("Prize Lure")
    assert tip.title
    assert len(tip.description) > 50
    assert len(tip.actions) >= 3


def test_all_tips_are_well_formed():
    for tip in all_tips():
        assert tip.tag and tip.title and tip.description
        assert tip.actions, f"{tip.tag} has no recommended actions"


def test_tip_serializes_for_api():
    payload = tip_for_tag("Gambling Bait").to_dict()
    assert set(payload) == {"tag", "title", "description", "actions"}
    assert isinstance(payload["actions"], list)


# --- cluster lookup ---------------------------------------------------------
def test_cluster_resolves_via_dominant_indicator_tag():
    tip = tip_for_cluster("cluster-42", ["Gambling Bait", "Suspicious URL"])
    assert tip.tag == "Gambling Bait"


def test_cluster_with_no_tags_falls_back():
    assert tip_for_cluster("cluster-42", []) is FALLBACK_TIP


def test_unknown_cluster_still_returns_a_card():
    """A newly discovered campaign has no bespoke copy yet; the user must
    still get something rather than a blank card."""
    assert tip_for_cluster(None, None) is FALLBACK_TIP


def test_admin_override_wins_over_indicator_tag(monkeypatch):
    monkeypatch.setitem(CLUSTER_TIP_OVERRIDES, "cluster-9", "Fake Job Offer")
    tip = tip_for_cluster("cluster-9", ["Gambling Bait"])
    assert tip.tag == "Fake Job Offer"


def test_overrides_start_empty():
    """Bespoke copy is admin-authored at runtime, not hard-coded."""
    assert CLUSTER_TIP_OVERRIDES == {}
