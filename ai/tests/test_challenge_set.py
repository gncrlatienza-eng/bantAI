"""Keeps the credential / advance-fee challenge set well-formed and unleaked."""

import csv
import os
from collections import Counter

from preprocessing import preprocess

AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHALLENGE = os.path.join(AI_DIR, "datasets", "challenge", "credential_advance_fee_v1.csv")


def _rows():
    with open(CHALLENGE, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def test_schema_and_labels():
    rows = _rows()
    assert rows
    for row in rows:
        assert row["label"] in {"Ham", "Spam", "Scam"}
        assert row["lang"] in {"en", "tl"}
        assert row["category"]
        assert row["text"].strip()


def test_each_category_has_one_gold_label():
    labels_by_category = {}
    for row in _rows():
        labels_by_category.setdefault(row["category"], set()).add(row["label"])
    assert all(len(labels) == 1 for labels in labels_by_category.values()), labels_by_category


def test_every_scam_category_has_a_tagalog_example():
    langs = {}
    for row in _rows():
        if row["label"] == "Scam":
            langs.setdefault(row["category"], set()).add(row["lang"])
    assert all("tl" in found for found in langs.values()), langs


def test_contrasts_exist_for_the_audited_failures():
    categories = Counter(row["category"] for row in _rows())
    # Surrender vs. legitimate issuance, and advance fee vs. honest notice.
    for name in ("otp_surrender", "otp_issuance", "job_advance_fee", "job_notice", "telco_pin_promo"):
        assert categories[name] >= 3, name


def test_no_duplicate_model_inputs():
    masked = [preprocess(row["text"]) for row in _rows()]
    assert len(masked) == len(set(masked))
