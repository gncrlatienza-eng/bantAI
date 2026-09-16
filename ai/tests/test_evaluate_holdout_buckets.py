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


# --- release gate on user-visible harms (Reymark's audit, item 12) -----------
def _report(scam_safe, n_scam, ham_blocked, n_ham):
    return {
        "per_class": {
            "Scam": {"total": n_scam},
            "Ham": {"total": n_ham},
        },
        "scam_shown_as_safe": scam_safe,
        "ham_blocked": ham_blocked,
    }


def test_gate_passes_within_both_ceilings():
    gate = hb.release_gate(_report(17, 498, 3, 1785), 0.05, 0.01)
    assert gate["passed"]
    assert gate["failures"] == []
    assert gate["scam_shown_as_safe_rate"] == 0.0341
    assert gate["ham_blocked_rate"] == 0.0017


def test_gate_fails_when_too_many_scams_reach_the_user_as_safe():
    """The harm the system exists to prevent -- a raw macro-F1 can rise while
    this gets worse, which is why it is checked by name."""
    gate = hb.release_gate(_report(40, 498, 3, 1785), 0.05, 0.01)
    assert not gate["passed"]
    assert "real scams shown as safe" in gate["failures"][0]


def test_gate_fails_when_too_many_legitimate_messages_are_blocked():
    gate = hb.release_gate(_report(17, 498, 40, 1785), 0.05, 0.01)
    assert not gate["passed"]
    assert "legitimate messages blocked" in gate["failures"][0]


def test_gate_reports_both_failures_at_once():
    gate = hb.release_gate(_report(100, 498, 100, 1785), 0.05, 0.01)
    assert len(gate["failures"]) == 2


def test_gate_handles_a_holdout_with_no_scams():
    """Division by zero would crash the report instead of grading it."""
    gate = hb.release_gate(_report(0, 0, 0, 10), 0.05, 0.01)
    assert gate["passed"]
    assert gate["scam_shown_as_safe_rate"] == 0.0
