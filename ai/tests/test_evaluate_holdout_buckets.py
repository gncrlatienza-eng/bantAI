"""Tests for scripts/evaluate_holdout_buckets.py (the counting, not the model)."""

import importlib.util
import os
import sys

_SCRIPTS = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts")
sys.path.insert(0, _SCRIPTS)
_SPEC = importlib.util.spec_from_file_location(
    "evaluate_holdout_buckets", os.path.join(_SCRIPTS, "evaluate_holdout_buckets.py")
)
hb = importlib.util.module_from_spec(_SPEC)
sys.modules["evaluate_holdout_buckets"] = hb
_SPEC.loader.exec_module(hb)


def test_perfect_routing_puts_every_class_in_its_expected_bucket():
    report = hb.bucket_report(["Ham", "Spam", "Scam"], ["safe", "spam", "blocked"])
    for label in ("Ham", "Spam", "Scam"):
        assert report["per_class"][label] == {"total": 1, "correct": 1, "unknown": 0, "wrong_bucket": 0}
    assert report["scam_shown_as_safe"] == 0
    assert report["ham_blocked"] == 0


def test_safety_numbers_count_only_the_worst_outcomes():
    """A scam left as unknown is not 'shown as safe'; a Ham sent to spam is not 'blocked'."""
    true = ["Scam", "Scam", "Scam", "Ham", "Ham"]
    buckets = ["safe", "unknown", "spam", "blocked", "spam"]
    report = hb.bucket_report(true, buckets)

    assert report["scam_shown_as_safe"] == 1
    assert report["ham_blocked"] == 1
    assert report["n_unknown"] == 1
    assert report["per_class"]["Scam"] == {"total": 3, "correct": 0, "unknown": 1, "wrong_bucket": 2}


def test_table_includes_every_class_and_bucket_even_when_empty():
    report = hb.bucket_report(["Ham"], ["safe"])
    assert set(report["table"]) == {"Ham", "Spam", "Scam"}
    assert all(set(row) == {"safe", "spam", "blocked", "unknown"} for row in report["table"].values())
