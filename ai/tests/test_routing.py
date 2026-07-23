"""Unit tests for the class-distribution -> user-bucket routing layer.

These need no trained model — they exercise the routing logic directly with
synthetic softmax distributions, including the boundary cases at each class
threshold and the near-tie case that must fall back to "unknown".

Defaults (ai/service/config.py): safe>=0.50, spam>=0.60, blocked>=0.90,
review_margin=0.15 (min gap between the top two classes).
"""

from service.classifier import route


def dist(ham: float, spam: float, scam: float) -> dict:
    """Build a {label: prob} distribution the way ``classify`` produces one."""
    return {"Ham": ham, "Spam": spam, "Scam": scam}


# --- confident, above-threshold predictions map to their bucket -------------
def test_confident_ham_is_safe():
    assert route(dist(0.97, 0.02, 0.01)) == "safe"


def test_confident_spam_goes_to_spam():
    assert route(dist(0.10, 0.88, 0.02)) == "spam"


def test_confident_scam_is_blocked():
    assert route(dist(0.03, 0.02, 0.95)) == "blocked"


# --- below-threshold predictions fall back to unknown (kept in inbox) --------
def test_low_confidence_ham_is_unknown():
    # Ham wins by a clear margin (gap 0.15) but 0.48 < safe_threshold.
    assert route(dist(0.48, 0.33, 0.19)) == "unknown"


def test_moderate_scam_is_unknown_not_blocked():
    # A "maybe scam" must NOT be hidden — hiding a real message is the costly error.
    assert route(dist(0.20, 0.05, 0.75)) == "unknown"


def test_moderate_spam_is_unknown():
    assert route(dist(0.40, 0.55, 0.05)) == "unknown"


# --- near-tie: winner doesn't clear the runner-up by review_margin ----------
def test_dead_tie_ham_spam_is_unknown():
    # The 0.50/0.50/0.00 case: argmax picks Ham, but the gap is 0 -> unknown.
    assert route(dist(0.50, 0.50, 0.00)) == "unknown"


def test_narrow_lead_is_unknown():
    # Ham leads but only by 0.08 (< review_margin) — too close to call, even
    # though 0.52 would clear the safe threshold on its own.
    assert route(dist(0.52, 0.44, 0.04)) == "unknown"


def test_lead_at_margin_is_confident():
    # Gap exactly equals review_margin (0.15) -> not a tie; Ham clears 0.50.
    assert route(dist(0.55, 0.40, 0.05)) == "safe"


# --- boundaries are inclusive at the threshold ------------------------------
def test_thresholds_are_inclusive():
    assert route(dist(0.50, 0.30, 0.20)) == "safe"
    assert route(dist(0.10, 0.60, 0.30)) == "spam"
    assert route(dist(0.05, 0.05, 0.90)) == "blocked"


def test_just_below_thresholds_are_unknown():
    assert route(dist(0.499, 0.201, 0.300)) == "unknown"
    assert route(dist(0.100, 0.599, 0.301)) == "unknown"
    assert route(dist(0.050, 0.051, 0.899)) == "unknown"
