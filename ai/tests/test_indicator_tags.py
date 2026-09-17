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
    assert "Prize Lure" in tag_names("Congrats! You are a winner of a GCash prize. Claim your prize now!")


def test_urgency_cue():
    assert "Urgency Cue" in tag_names("Act now! This offer expires today, last chance to claim.")


def test_suspicious_url_flags_shortener():
    assert "Suspicious URL" in tag_names("Claim your reward now: https://bit.ly/fakereward123")


def test_suspicious_url_ignores_official_domain():
    tags = tag_names("Check your balance at https://gcash.com/app")
    assert "Suspicious URL" not in tags


def test_brand_impersonation_requires_suspicious_link():
    assert "Brand Impersonation" in tag_names("GCash: Your account is locked. Verify at http://gcash-verify.xyz/unlock")


def test_brand_named_with_official_link_is_not_impersonation():
    tags = tag_names("GCash: Your OTP is 123456. Visit https://gcash.com for help.")
    assert "Brand Impersonation" not in tags


# --- additional grounded tags ------------------------------------------------
def test_gambling_bait():
    assert "Gambling Bait" in tag_names("You have a balance of PHP 3000. Play or cash out now! JILI game.")


def test_fake_job_offer():
    assert "Fake Job Offer" in tag_names("EARN WHILE AT HOME. Be an appointment setter! Homebased business.")


def test_unsolicited_credit_offer():
    assert "Unsolicited Credit Offer" in tag_names(
        "You are qualified for a pre-approved cash loan, no collateral needed!"
    )


def test_personal_info_request():
    assert "Personal Info Request" in tag_names(
        "Kindly email your requirements: 2 government ID, frontface of your card."
    )


def test_otp_phishing():
    assert "OTP / Account Phishing" in tag_names("Your account will be suspended. Click this link to verify now.")


# --- Tagalog/Taglish coverage (added 2026-08-04, WBS 3.1.2 confirmation) ----
# Unsolicited Credit Offer, Personal Info Request, and OTP/Account Phishing
# had zero non-English keywords -- the same recurring language-coverage gap
# already fixed for PROMO_TL, JOB_SCAM, and Gambling Bait (see that tag's
# Tagalog vocabulary above). These lock in the fix.
def test_unsolicited_credit_offer_tagalog():
    assert "Unsolicited Credit Offer" in tag_names("Kwalipikado ka na para sa pautang, walang collateral kailangan!")


def test_personal_info_request_tagalog():
    assert "Personal Info Request" in tag_names("Kailangan ng ID, i-share mo agad at ipadala ang mga detalye mo.")


def test_otp_phishing_tagalog():
    assert "OTP / Account Phishing" in tag_names("Ma-block ang account mo, i-verify ang account mo ngayon din.")


# --- www.-stripping regression (str.lstrip is a char-set strip, not a prefix
# strip -- ".lstrip('www.')" used to also eat a leading "w" off *any* host,
# so a typosquat like "wbpi.com.ph" got corrupted into "bpi.com.ph" and was
# silently treated as the real bank) --------------------------------------
def test_www_prefix_is_stripped_for_official_domain_match():
    tags = tag_names("Check your balance at https://www.gcash.com/app")
    assert "Suspicious URL" not in tags


def test_w_prefixed_typosquat_is_not_mistaken_for_official_domain():
    assert "Suspicious URL" in tag_names("Verify now at https://wbpi.com.ph/unlock")


# --- second gambling-vocabulary cluster + "avoid deactivation" phrasing -----
# (WBS 5.3.7, scripts/analyze_indicator_coverage.py) -- measured 48.6% of
# real Scam rows got no tag at all; these closed the two largest, most
# frequent gaps in the untagged remainder. See indicator_tags.py comments.
def test_gambling_bait_second_tagalog_cluster():
    assert "Gambling Bait" in tag_names("Maglaro ng W+ at manalo ng IPHONE PROMAX! Sumali sa laro ngayon.")


def test_gambling_bait_welcome_bonus_and_brand():
    assert "Gambling Bait" in tag_names(
        "Join us & FREE 50p today! Get extra 100p with any deposit. Welcome Bonus at Epicwin."
    )


def test_otp_phishing_avoid_deactivation_phrasing():
    """Distinct grammar from 'will be deactivated' -- e.g. BDO/GCash notices
    phrased as 'to avoid Deactivation' never matched the existing entry."""
    assert "OTP / Account Phishing" in tag_names(
        "Your BDO-Online Account is under review. Complete verification here to avoid Deactivation."
    )


# --- ordering and output shape ----------------------------------------------
def test_tags_sorted_by_weight_descending():
    tags = tags_for_message("GCash: Your account is locked. Verify at http://gcash-verify.xyz/unlock")
    weights = [t.weight for t in tags]
    assert weights == sorted(weights, reverse=True)


def test_to_indicator_dicts_matches_backend_shape():
    tags = tags_for_message("You are a winner! Claim your prize now.")
    dicts = to_indicator_dicts(tags)
    assert all(set(d.keys()) == {"tag", "weight"} for d in dicts)
    assert all(isinstance(d["weight"], float) for d in dicts)


def test_no_tags_for_plain_message():
    assert tags_for_message("Hi, what time are we meeting tomorrow?") == []


# --- task-scam vocabulary (2026-09-18) --------------------------------------
def test_task_scams_are_recognised_as_fake_job_offers():
    """Piecework scams are a distinct family from work-from-home, and nothing
    in the original list reached them. The middle case previously came back as
    *Gambling Bait*, because "red envelope" is in that tag's vocabulary -- a
    user being recruited into a fake job was told it was a betting advert."""
    from preprocessing import preprocess
    from service.indicator_tags import tags_for_message

    for text in (
        "Make money while watching YouTube, earn 500P per day, contact the tutor to receive 138P.",
        "Part-time car reviewer, easily earn 300P high income, contact the manager for your 138P red envelope.",
        "Mag-recruit ng mga reviewer ng kotse, sumali at makakuha ng 138p.",
        "It is easier to get a daily salary of 300P. Just contact the instructor on your mobile phone.",
    ):
        tags = {t.tag for t in tags_for_message(text, preprocess(text))}
        assert "Fake Job Offer" in tags, text


def test_the_added_phrases_carry_no_common_word_into_the_shap_path():
    """``explainer._tokens_to_tags`` splits a phrase into words and fires on any
    single one of >=4 characters, so a phrase is only as safe as its commonest
    word. "make money while watching" would have made *money* a standalone
    Fake Job Offer trigger; it appears in 3.2% of Ham."""
    import re

    from service.indicator_tags import _FAKE_JOB_OFFER

    banned = {"money", "make", "contact", "receive", "your", "earn"}
    added = {"while watching", "the tutor", "car reviewer", "reviewer ng kotse", "daily salary"}
    for phrase in added:
        assert phrase in _FAKE_JOB_OFFER, f"{phrase} missing from the lexicon"
        words = {w for w in re.split(r"[^a-z0-9]+", phrase.lower()) if len(w) >= 4}
        assert not (words & banned), f"{phrase!r} would make {words & banned} a standalone trigger"
