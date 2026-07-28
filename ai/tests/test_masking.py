"""Unit tests for the privacy masking layer (ai/preprocessing/masking.py)."""

from preprocessing.masking import mask_counts, mask_pii


def test_masks_url_with_scheme():
    assert mask_pii("Visit http://bit.ly/abc now") == "Visit <URL> now"


def test_masks_www_and_bare_domain():
    assert mask_pii("Login at www.gcash-verify.com/claim") == "Login at <URL>"
    assert mask_pii("Go to gcash.com.ph for details") == "Go to <URL> for details"


def test_masks_ph_mobile_numbers():
    assert mask_pii("Text me at 09171234567 today") == "Text me at <PHONE> today"
    assert mask_pii("Call +63 917 123 4567 now") == "Call <PHONE> now"


def test_masks_landline():
    assert mask_pii("Landline (02) 8123 4567 open") == "Landline <PHONE> open"


def test_masks_otp_code():
    assert mask_pii("Your OTP is 483920 valid") == "Your OTP is <OTP> valid"
    assert mask_pii("Enter code 1234 to verify") == "Enter code <OTP> to verify"


def test_masks_amounts():
    assert mask_pii("Pay ₱5,000 now") == "Pay <AMOUNT> now"
    assert mask_pii("Php 1,200.00 fee") == "<AMOUNT> fee"
    assert mask_pii("Send 1500 pesos") == "Send <AMOUNT>"
    assert mask_pii("You won P50 load") == "You won <AMOUNT> load"


def test_masks_amount_shorthand():
    # "k"/"m" shorthand is a common scam money format.
    assert mask_pii("Claim ₱5k reward") == "Claim <AMOUNT> reward"
    assert mask_pii("Win 2m pesos today") == "Win <AMOUNT> today"


def test_masks_email():
    assert mask_pii("Email us at support@gcash-verify.com now") == "Email us at <EMAIL> now"
    # An email must not leave a dangling domain that the URL pass turns into <URL>.
    assert "<URL>" not in mask_pii("Contact juan.delacruz@bpi.com.ph")


def test_masks_obfuscated_url():
    # "hxxp" de-fanging (common in threat write-ups) is still a link.
    assert mask_pii("Go to hxxp://scam.ph/win fast") == "Go to <URL> fast"


def test_masks_phone_no_separators():
    assert mask_pii("Reach +639171234567 now") == "Reach <PHONE> now"
    assert mask_pii("Txt 0917-123-4567 pls") == "Txt <PHONE> pls"


def test_decimal_is_not_a_url():
    # "3.50" must not be read as a bare domain (TLD must be alphabetic).
    assert "<URL>" not in mask_pii("The price is 3.50 dollars")


def test_combined_message():
    raw = (
        "CONGRATULATIONS! Claim ₱10000 at http://scam.ph/x "
        "using code 774812 or call 09991234567"
    )
    masked = mask_pii(raw)
    assert masked == (
        "CONGRATULATIONS! Claim <AMOUNT> at <URL> "
        "using code <OTP> or call <PHONE>"
    )
    # No raw PII survives.
    for leaked in ("10000", "scam.ph", "774812", "09991234567"):
        assert leaked not in masked


def test_mask_counts():
    counts = mask_counts(
        "Mail me@x.com pay ₱100 at http://x.com code 5555 call 09171234567"
    )
    assert counts == {"email": 1, "url": 1, "phone": 1, "amount": 1, "otp": 1}


def test_empty_input():
    assert mask_pii("") == ""
    assert mask_counts("") == {"email": 0, "url": 0, "phone": 0, "amount": 0, "otp": 0}
