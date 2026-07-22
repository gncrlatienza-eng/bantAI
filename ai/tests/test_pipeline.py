"""Unit tests for the combined preprocess() pipeline."""

from preprocessing import preprocess


def test_normalizes_then_masks():
    # Full-width digits are folded first, then masked as an OTP code.
    assert preprocess("code ４８３９２０") == "code <OTP>"


def test_end_to_end_no_pii_leak():
    raw = "  Claim   ₱5,000 at WWW.SCAM.PH/win  code 1234  "
    out = preprocess(raw)
    assert out == "Claim <AMOUNT> at <URL> code <OTP>"
    for leaked in ("5,000", "SCAM.PH", "1234"):
        assert leaked not in out
