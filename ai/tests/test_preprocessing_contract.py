"""Synthetic regression fixtures for the client-to-model privacy contract."""

import pytest

from preprocessing import preprocess
from service.lexical import normalize_placeholders, shingles


@pytest.mark.parametrize(
    ("raw", "uploaded"),
    [
        ("Verify at https://example.com now", "Verify at [URL] now"),
        ("Pay PHP 500 processing fee", "Pay [AMOUNT] processing fee"),
        ("Reply with OTP 123456", "Reply with OTP [OTP]"),
        ("Call 09171234567 now", "Call [PHONE] now"),
        ("Email help@example.com", "Email [EMAIL]"),
        ("ＧＣａｓｈ OTP １２３４５６", "GCash OTP [OTP]"),
    ],
)
def test_raw_and_uploaded_tokens_reach_model_identically(raw, uploaded):
    assert preprocess(raw) == preprocess(uploaded)


def test_generic_redaction_does_not_invent_an_otp():
    assert preprocess("Reference [NUMBER]") == "Reference <NUMBER>"


def test_canonicalization_is_idempotent_and_preserves_other_tokens():
    text = "[URL] <OTP> [note] [url] <s> <mask> [NUMBER]"
    expected = "<URL> <OTP> [note] [url] <s> <mask> <NUMBER>"
    assert preprocess(text) == expected
    assert preprocess(expected) == expected


def test_campaign_normalization_keeps_same_shared_contract():
    assert normalize_placeholders("[URL] [NUMBER]") == "<URL> <NUMBER>"
    assert shingles("Claim at [URL] for [AMOUNT]") == shingles("Claim at <URL> for <AMOUNT>")
