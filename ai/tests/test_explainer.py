"""Unit tests for SHAP explainability integration (WBS 3.3.6).

These run without ``shap`` installed and without a trained model -- they cover
the fallback contract and the token->tag mapping, which is the part that must
stay correct regardless of which attribution method produced the scores.
"""

from service.explainer import (
    _clean_token,
    _matches_keyword,
    _tokens_to_tags,
    explain,
)


# --- token cleaning ---------------------------------------------------------
def test_strips_sentencepiece_marker():
    assert _clean_token("▁claim") == "claim"


def test_strips_punctuation_and_lowercases():
    assert _clean_token("WON!") == "won"


# --- token -> tag mapping ---------------------------------------------------
def test_maps_prize_token_to_prize_lure():
    tags = _tokens_to_tags([("▁winner", 0.4)])
    assert any(t.tag == "Prize Lure" for t in tags)


def test_ignores_negative_contributions():
    """Tokens that pushed *away* from the predicted class are not evidence
    for it, so they must not produce an indicator tag."""
    assert _tokens_to_tags([("▁winner", -0.4)]) == []


def test_ignores_short_fragments():
    """Subword fragments match too many keywords to attribute meaningfully."""
    assert _tokens_to_tags([("▁a", 0.9), ("▁of", 0.8)]) == []


def test_tagalog_prefix_does_not_produce_a_false_tag():
    """Regression, found 2026-07-30 against the real model: the Tagalog prefix
    'mag' substring-matched the keyword 'mag-ingat' and mislabeled a gambling
    blast as 'Urgency Cue'. Tagalog is agglutinative, so short prefixes appear
    inside unrelated keywords constantly."""
    tags = _tokens_to_tags([("▁Mag", 0.4), ("▁libreng", 0.3)])
    assert all(t.tag != "Urgency Cue" for t in tags)


def test_matches_whole_words_not_substrings():
    assert _matches_keyword("winner", "lucky winner") is True
    assert _matches_keyword("libreng", "mag-ingat") is False


def test_matches_sentencepiece_word_prefix():
    """SentencePiece splits mid-word, so a long prefix should still match."""
    assert _matches_keyword("gambl", "gambling") is True


def test_tagalog_gambling_terms_are_recognized():
    """Regression: a real gambling blast produced no tag at all because the
    gambling vocabulary was English-only."""
    tags = _tokens_to_tags([("▁tumaya", 0.3), ("▁magparehistro", 0.25)])
    assert any(t.tag == "Gambling Bait" for t in tags)


def test_weights_normalized_to_peak_of_one():
    tags = _tokens_to_tags([("▁winner", 0.8), ("▁deposit", 0.2)])
    assert tags
    assert max(t.weight for t in tags) == 1.0
    assert all(0.0 <= t.weight <= 1.0 for t in tags)


def test_tags_sorted_strongest_first():
    tags = _tokens_to_tags([("▁winner", 0.9), ("▁homebased", 0.3), ("▁deposit", 0.1)])
    weights = [t.weight for t in tags]
    assert weights == sorted(weights, reverse=True)


def test_accumulates_across_tokens_of_same_tag():
    """Two prize-ish tokens should outweigh one job-ish token."""
    tags = _tokens_to_tags([("▁winner", 0.3), ("▁prize", 0.3), ("▁homebased", 0.4)])
    by_tag = {t.tag: t.weight for t in tags}
    assert by_tag["Prize Lure"] > by_tag["Fake Job Offer"]


def test_no_tokens_yields_no_tags():
    assert _tokens_to_tags([]) == []


# --- explain() fallback contract -------------------------------------------
def test_falls_back_without_a_model():
    result = explain("Congrats! You are a winner. Claim your prize now!")
    assert result.method == "keyword-fallback"
    assert any(t.tag == "Prize Lure" for t in result.tags)


def test_fallback_still_detects_structural_signals():
    result = explain("GCash: verify at http://gcash-verify.xyz/unlock")
    tags = {t.tag for t in result.tags}
    assert "Suspicious URL" in tags


def test_payload_matches_backend_contract():
    """Must match StoreIndicatorsDto -- [{tag: string, weight: number}]."""
    payload = explain("You are a winner! Claim your prize.").to_indicator_payload()
    assert payload
    for item in payload:
        assert set(item) == {"tag", "weight"}
        assert isinstance(item["weight"], float)


def test_plain_message_yields_no_indicators():
    result = explain("Hi, are we still meeting at 5?")
    assert result.tags == []


def test_explain_never_raises_on_bad_input():
    """Explanation failure must never break classification."""
    for bad in ("", "   ", "▁" * 50):
        explain(bad)
