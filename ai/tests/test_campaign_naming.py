"""Tests for service/campaign_naming.py."""

from service.campaign_naming import PROMO, describe, message_category, name_clusters


def test_message_categories():
    assert message_category("Your BDO account has an unauthorized transaction, verify here") == "Bank phishing"
    assert message_category("Your parcel delivery failed, update your address for redelivery") == (
        "Parcel / delivery scam"
    )
    assert message_category("Deposit now and get 100% bonus, jackpot slot games!") == "Online gambling / casino"
    assert message_category("Need cash? Easy loan approval, no collateral") == "Loan / credit offer"
    assert message_category("hello") is None


def test_whole_words_only():
    # "bet" inside "better" and "pin" inside "shopping" must not count.
    assert message_category("better shopping today") is None


def test_brand_goes_in_the_name_only_when_it_is_the_target():
    bank = ["BDO: unauthorized transaction on your account, verify at link"] * 5
    assert describe(bank, {"Scam": 5}) == ("Bank phishing", "Bank phishing (BDO)")
    gambling = ["Deposit via GCash and get bonus, jackpot slot"] * 5
    assert describe(gambling, {"Scam": 5}) == ("Online gambling / casino", "Online gambling / casino")


def test_gcash_account_threats_are_e_wallet_phishing():
    msgs = ["Your GCash account is temporarily disabled, verify to avoid deactivation"] * 5
    assert describe(msgs, {"Scam": 5})[0] == "E-wallet phishing"


def test_spam_clusters_are_promos():
    assert describe(["Globe promo: 50GB for P99"] * 5, {"Spam": 5}) == (PROMO, "Promo (Globe)")


def test_mixed_clusters_fall_back_to_other():
    msgs = ["loan offer", "parcel delivery", "jackpot bonus", "hello there", "good morning"]
    assert describe(msgs, {"Scam": 5})[0] == "Other scam"


def test_names_are_unique_largest_first():
    bank = ["BDO unauthorized transaction verify"]
    out = name_clusters([(1, bank * 5, {"Scam": 5}), (2, bank * 9, {"Scam": 9})])
    assert out[2][1] == "Bank phishing (BDO)" and out[1][1] == "Bank phishing (BDO) #2"


def test_names_never_contain_message_text():
    secret = "Juan Dela Cruz 09171234567"
    out = name_clusters([(1, [f"{secret} BDO unauthorized transaction"] * 5, {"Scam": 5})])
    assert "Juan" not in out[1][1] and "0917" not in out[1][1]
