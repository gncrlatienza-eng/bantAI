"""Unit tests for retraining trigger evaluation (WBS 4.4.2)."""

from retraining.triggers import (
    BASELINE_MACRO_F1,
    PageHinkley,
    evaluate,
)


# --- sample-count trigger ---------------------------------------------------
def test_fires_at_exactly_the_sample_threshold():
    """50 is the documented threshold, so 50 must fire -- an off-by-one here
    silently delays every retrain by one report."""
    assert evaluate(validated_samples=50).should_retrain


def test_does_not_fire_one_below_threshold():
    assert not evaluate(validated_samples=49).should_retrain


def test_no_triggers_at_all_means_no_retrain():
    decision = evaluate(validated_samples=0, current_macro_f1=BASELINE_MACRO_F1)
    assert not decision.should_retrain
    assert decision.reasons == []


# --- F1 floor trigger -------------------------------------------------------
def test_f1_drop_beyond_tolerance_fires():
    # 5pp below the 0.9438 baseline.
    assert evaluate(current_macro_f1=BASELINE_MACRO_F1 - 0.05).should_retrain


def test_f1_drop_inside_tolerance_does_not_fire():
    assert not evaluate(current_macro_f1=BASELINE_MACRO_F1 - 0.02).should_retrain


def test_f1_improvement_does_not_fire():
    """A model doing better than baseline must never trigger a retrain."""
    assert not evaluate(current_macro_f1=BASELINE_MACRO_F1 + 0.03).should_retrain


def test_unknown_f1_abstains_rather_than_treating_it_as_zero():
    """A fresh deploy with no evaluation yet would otherwise look like a
    catastrophic F1 collapse and retrain immediately on every cold start."""
    assert not evaluate(current_macro_f1=None).should_retrain


# --- drift trigger ----------------------------------------------------------
def test_drift_alone_fires():
    assert evaluate(drift_detected=True).should_retrain


# --- combination ------------------------------------------------------------
def test_all_reasons_are_reported_not_just_the_first():
    """An operator needs to see that three triggers fired at once -- that is
    a different situation from a routine sample-count rollover."""
    decision = evaluate(
        validated_samples=100,
        current_macro_f1=BASELINE_MACRO_F1 - 0.10,
        drift_detected=True,
    )
    assert decision.should_retrain
    assert len(decision.reasons) == 3


def test_decision_is_truthy():
    assert bool(evaluate(validated_samples=50))
    assert not bool(evaluate(validated_samples=0))


# --- Page-Hinkley -----------------------------------------------------------
def test_stable_metric_does_not_signal_drift():
    ph = PageHinkley()
    signalled = [ph.update(0.94) for _ in range(50)]
    assert not any(signalled)


def test_small_noise_does_not_signal_drift():
    """Routine wobble around a stable mean must stay inside the slack, or
    the detector fires constantly and gets ignored."""
    ph = PageHinkley()
    values = [0.94, 0.945, 0.938, 0.942, 0.939, 0.941, 0.944, 0.937] * 5
    assert not any(ph.update(v) for v in values)


def test_sustained_decline_signals_drift():
    ph = PageHinkley()
    # Gradual slide: no single step is alarming, the accumulation is.
    values = [0.94 - i * 0.004 for i in range(40)]
    assert any(ph.update(v) for v in values)


def test_detector_does_not_self_reset_after_signalling():
    """Silent self-reset would make a polling caller see False again while
    drift is still ongoing."""
    ph = PageHinkley()
    values = [0.94 - i * 0.004 for i in range(40)]
    results = [ph.update(v) for v in values]
    first = results.index(True)
    assert all(results[first:])


def test_reset_clears_state():
    ph = PageHinkley()
    for i in range(40):
        ph.update(0.94 - i * 0.004)
    ph.reset()
    assert not ph.update(0.94)


def test_recovery_after_reset_behaves_like_a_fresh_detector():
    ph = PageHinkley()
    for i in range(40):
        ph.update(0.94 - i * 0.004)
    ph.reset()
    assert not any(ph.update(0.80) for _ in range(20))
