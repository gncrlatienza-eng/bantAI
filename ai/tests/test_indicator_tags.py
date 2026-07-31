"""Unit tests for the SHAP indicator tag dictionary (WBS 3.1.2).

These exercise the keyword/structural tagger directly with real-shaped
messages -- no SHAP or model dependency, matching the "dictionary contents"
scope of 3.1.2 rather than the SHAP integration itself (3.3.6).
"""

from service.indicator_tags import tags_for_message, to_indicator_dicts


def tag_names(raw_text: str) -> set[str]:
    return {t.tag for t in tags_for_message(raw_text)}


# --- the four manuscript-named tags ----------------------------------------
def test_prize_lure():
    assert "Prize Lure" in tag_names(
        "Congrats! You are a winner of a GCash prize. Claim your prize now!"
    )


def test_urgency_cue():
    assert "Urgency Cue" in tag_names(
        "Act now! This offer expires today, last chance to claim."
    )


def test_suspicious_url_flags_shortener():
    assert "Suspicious URL" in tag_names(
        "Claim your reward now: https://bit.ly/fakereward123"
    )


def test_suspicious_url_ignores_official_domain():
    tags = tag_names("Check your balance at https://gcash.com/app")
    assert "Suspicious URL" not in tags


def test_brand_impersonation_requires_suspicious_link():
    assert "Brand Impersonation" in tag_names(
        "GCash: Your account is locked. Verify at http://gcash-verify.xyz/unlock"
    )


def test_brand_named_with_official_link_is_not_impersonation():
    tags = tag_names("GCash: Your OTP is 123456. Visit https://gcash.com for help.")
    assert "Brand Impersonation" not in tags


# --- additional grounded tags ------------------------------------------------
def test_gambling_bait():
    assert "Gambling Bait" in tag_names(
        "You have a balance of PHP 3000. Play or cash out now! JILI game."
    )


def test_fake_job_offer():
    assert "Fake Job Offer" in tag_names(
        "EARN WHILE AT HOME. Be an appointment setter! Homebased business."
    )


def test_unsolicited_credit_offer():
    assert "Unsolicited Credit Offer" in tag_names(
        "You are qualified for a pre-approved cash loan, no collateral needed!"
    )


def test_personal_info_request():
    assert "Personal Info Request" in tag_names(
        "Kindly email your requirements: 2 government ID, frontface of your card."
    )


def test_otp_phishing():
    assert "OTP / Account Phishing" in tag_names(
        "Your account will be suspended. Click this link to verify now."
    )


# --- ordering and output shape ----------------------------------------------
def test_tags_sorted_by_weight_descending():
    tags = tags_for_message(
        "GCash: Your account is locked. Verify at http://gcash-verify.xyz/unlock"
    )
    weights = [t.weight for t in tags]
    assert weights == sorted(weights, reverse=True)


def test_to_indicator_dicts_matches_backend_shape():
    tags = tags_for_message("You are a winner! Claim your prize now.")
    dicts = to_indicator_dicts(tags)
    assert all(set(d.keys()) == {"tag", "weight"} for d in dicts)
    assert all(isinstance(d["weight"], float) for d in dicts)


def test_no_tags_for_plain_message():
    assert tags_for_message("Hi, what time are we meeting tomorrow?") == []
