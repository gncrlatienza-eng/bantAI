"""Unit tests for the model promotion gate (WBS 4.3.7)."""

import pytest

from retraining.promotion import (
    discordant_indices,
    evaluate_promotion,
    mcnemar_counts,
)


def labels(n_ham, n_spam, n_scam):
    return ["Ham"] * n_ham + ["Spam"] * n_spam + ["Scam"] * n_scam


# --- discordant-cell counting -----------------------------------------------
def test_counts_fixes_and_regressions():
    truth = ["Ham", "Spam", "Scam", "Ham"]
    baseline = ["Ham", "Ham", "Scam", "Scam"]  # right, wrong, right, wrong
    candidate = ["Ham", "Spam", "Ham", "Ham"]  # right, right, wrong, right
    fixes, regressions = mcnemar_counts(truth, baseline, candidate)
    assert (fixes, regressions) == (2, 1)


def test_both_correct_and_both_wrong_are_ignored():
    """Concordant rows carry no information about which model is better."""
    truth = ["Ham"] * 4
    baseline = ["Ham", "Ham", "Spam", "Spam"]
    candidate = ["Ham", "Ham", "Spam", "Spam"]
    assert mcnemar_counts(truth, baseline, candidate) == (0, 0)


def test_mismatched_lengths_raise():
    """Silent misalignment would produce a confident, meaningless verdict."""
    with pytest.raises(ValueError):
        mcnemar_counts(["Ham"] * 3, ["Ham"] * 3, ["Ham"] * 2)


# --- Scam-recall floor ------------------------------------------------------
def _better_overall_worse_on_scam(n_scam, scam_misses):
    """Candidate fixes 60 Ham/Spam rows the baseline got wrong, but newly
    misses ``scam_misses`` of ``n_scam`` Scam rows the baseline caught."""
    truth = labels(100, 100, n_scam)
    baseline = truth.copy()
    for i in range(30):
        baseline[i] = "Spam"  # 30 Ham rows wrong
        baseline[100 + i] = "Ham"  # 30 Spam rows wrong
    candidate = truth.copy()
    for i in range(200, 200 + scam_misses):
        candidate[i] = "Spam"
    return truth, baseline, candidate


def test_better_overall_but_catching_fewer_scams_is_rejected():
    """The failure macro-F1 hides: 60 fixes vs 5 regressions is decisive
    overall, but all 5 regressions are scams that now get through."""
    truth, baseline, candidate = _better_overall_worse_on_scam(n_scam=50, scam_misses=5)

    decision = evaluate_promotion(truth, baseline, candidate)

    assert not decision.promote
    assert "Scam recall" in decision.reason
    assert decision.candidate_macro_f1 > decision.baseline_macro_f1
    assert decision.baseline_scam_recall == 1.0
    assert decision.candidate_scam_recall == pytest.approx(0.90)


def test_a_scam_recall_dip_inside_tolerance_still_promotes():
    truth, baseline, candidate = _better_overall_worse_on_scam(n_scam=200, scam_misses=1)  # -0.5pp
    decision = evaluate_promotion(truth, baseline, candidate)
    assert decision.promote
    assert decision.candidate_scam_recall == pytest.approx(0.995)


def test_scam_floor_is_skipped_when_there_are_no_scam_rows():
    truth = labels(40, 60, 0)
    baseline = truth.copy()
    for i in range(40, 65):
        baseline[i] = "Ham"
    decision = evaluate_promotion(truth, baseline, truth.copy())
    assert decision.promote
    assert decision.baseline_scam_recall is None
    assert decision.candidate_scam_recall is None


def test_scam_label_can_be_a_label_id():
    """The pipeline passes integer ids, not names."""
    truth, baseline, candidate = _better_overall_worse_on_scam(n_scam=50, scam_misses=5)
    ids = {"Ham": 0, "Spam": 1, "Scam": 2}
    as_ids = [[ids[x] for x in seq] for seq in (truth, baseline, candidate)]
    decision = evaluate_promotion(*as_ids, scam_label=2)
    assert not decision.promote
    assert "Scam recall" in decision.reason


# --- promotion decisions ----------------------------------------------------
def test_clearly_better_candidate_is_promoted():
    truth = labels(40, 30, 30)
    baseline = truth.copy()
    candidate = truth.copy()
    # Baseline gets 25 Scam rows wrong; candidate fixes all of them.
    for i in range(70, 95):
        baseline[i] = "Ham"

    decision = evaluate_promotion(truth, baseline, candidate)
    assert decision.promote
    assert decision.n_fixes == 25
    assert decision.n_regressions == 0
    assert decision.p_value < 0.05


def test_clearly_worse_candidate_is_rejected():
    truth = labels(40, 30, 30)
    baseline = truth.copy()
    candidate = truth.copy()
    for i in range(70, 95):
        candidate[i] = "Ham"  # candidate breaks 25 Scam rows

    decision = evaluate_promotion(truth, baseline, candidate)
    assert not decision.promote
    assert decision.n_regressions == 25


def test_identical_predictions_are_not_promoted():
    """No measured benefit means swapping checkpoints only adds risk."""
    truth = labels(20, 20, 20)
    decision = evaluate_promotion(truth, truth.copy(), truth.copy())
    assert not decision.promote
    assert "identical" in decision.reason
    assert decision.p_value == 1.0


def test_marginal_difference_is_not_promoted():
    """A 3-vs-2 split on 60 rows is noise. Promoting on it makes the model
    random-walk between checkpoints while appearing to improve."""
    truth = labels(20, 20, 20)
    baseline = truth.copy()
    candidate = truth.copy()
    baseline[0] = baseline[1] = baseline[2] = "Scam"  # 3 fixes for candidate
    candidate[30] = candidate[31] = "Ham"  # 2 regressions

    decision = evaluate_promotion(truth, baseline, candidate)
    assert not decision.promote
    assert "not significant" in decision.reason


def test_f1_floor_rejects_before_significance_is_consulted():
    """The floor is an absolute safety property -- a catastrophically worse
    candidate must be refused regardless of what the test says."""
    truth = labels(40, 30, 30)
    baseline = truth.copy()
    candidate = ["Ham"] * 100  # predicts one class for everything

    decision = evaluate_promotion(truth, baseline, candidate)
    assert not decision.promote
    assert "below baseline" in decision.reason
    assert decision.candidate_macro_f1 < decision.baseline_macro_f1


def test_significant_but_worse_is_rejected():
    """Catches a candidate that regresses more than it fixes while staying
    inside the F1 floor -- significance alone must not imply promotion."""
    truth = labels(40, 30, 30)
    baseline = truth.copy()
    candidate = truth.copy()
    for i in range(0, 3):
        baseline[i] = "Scam"  # 3 fixes
    for i in range(40, 58):
        candidate[i] = "Scam"  # 18 regressions

    decision = evaluate_promotion(truth, baseline, candidate)
    assert not decision.promote
    assert decision.n_regressions > decision.n_fixes


# --- decision payload -------------------------------------------------------
def test_decision_records_numbers_for_the_audit_trail():
    """ModelVersions stores this; someone reads it back months later."""
    truth = labels(40, 30, 30)
    baseline = truth.copy()
    candidate = truth.copy()
    for i in range(70, 90):
        baseline[i] = "Ham"

    decision = evaluate_promotion(truth, baseline, candidate)
    assert 0.0 <= decision.p_value <= 1.0
    assert 0.0 <= decision.baseline_macro_f1 <= 1.0
    assert 0.0 <= decision.candidate_macro_f1 <= 1.0
    assert decision.reason


def test_decision_is_truthy():
    truth = labels(40, 30, 30)
    baseline = truth.copy()
    candidate = truth.copy()
    for i in range(70, 95):
        baseline[i] = "Ham"
    assert bool(evaluate_promotion(truth, baseline, candidate))


# --- which rows disagreed, not just how many (WBS 4.3.5) --------------------
def test_discordant_indices_points_at_the_actual_rows():
    """Counts answer 'how many changed'. Only indices answer 'which' -- the
    first question anyone asks about a promotion."""
    truth = ["Ham", "Scam", "Spam", "Scam", "Ham"]
    baseline = ["Ham", "Ham", "Spam", "Scam", "Ham"]  # wrong at 1
    candidate = ["Ham", "Scam", "Spam", "Ham", "Ham"]  # wrong at 3

    fixes, regressions = discordant_indices(truth, baseline, candidate)

    assert fixes == [1]
    assert regressions == [3]


def test_counts_and_indices_can_never_disagree():
    """mcnemar_counts delegates, so there is one definition of a fix."""
    truth = ["Ham", "Scam", "Spam", "Scam", "Ham", "Spam"]
    baseline = ["Scam", "Ham", "Spam", "Scam", "Ham", "Ham"]
    candidate = ["Ham", "Scam", "Ham", "Ham", "Ham", "Spam"]

    fixes, regressions = discordant_indices(truth, baseline, candidate)
    assert mcnemar_counts(truth, baseline, candidate) == (len(fixes), len(regressions))


def test_rows_both_models_get_wrong_are_not_disagreements():
    """Both wrong carries no information about which model is better -- that
    is the whole reason McNemar looks only at the discordant cells."""
    truth = ["Scam", "Scam"]
    baseline = ["Ham", "Ham"]
    candidate = ["Spam", "Ham"]
    assert discordant_indices(truth, baseline, candidate) == ([], [])


def test_mismatched_lengths_still_raise_through_the_wrapper():
    with pytest.raises(ValueError):
        discordant_indices(["Ham"] * 3, ["Ham"] * 3, ["Ham"] * 2)


def test_transition_fields_default_to_none():
    """The gate decides verdicts; it does not decide what gets persisted."""
    decision = evaluate_promotion(["Ham", "Scam"], ["Ham", "Ham"], ["Ham", "Scam"])
    assert decision.regression_transitions is None
    assert decision.fix_transitions is None
