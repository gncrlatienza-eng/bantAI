"""Model promotion gate — McNemar test + F1 floor (Sprint 4, WBS 4.3.7).

A retrained model must never be promoted just because its headline metric
moved up. Two independent checks have to pass:

1. **F1 floor** -- the candidate's macro-F1 must not fall more than a
   tolerated margin below the incumbent's. An absolute guardrail; cheap,
   and catches an outright broken run immediately.

2. **McNemar's test** -- is the difference *statistically real*, or noise?
   On a ~3,350-row validation split, a 0.4pp macro-F1 gain can easily be
   sampling luck. Promoting on noise means the model random-walks between
   checkpoints while appearing to improve.

McNemar rather than a two-proportion z-test because both models are scored
on **the same** validation rows. That pairing means the comparison should
only consider rows where the two models *disagree* -- the ones both get
right or both get wrong carry no information about which is better. The
test reduces to: of the disagreements, is the split meaningfully lopsided?

    ================  ==================  ==================
                      candidate correct   candidate wrong
    ================  ==================  ==================
    baseline correct  both_correct        b  (regressions)
    baseline wrong    c  (fixes)          both_wrong
    ================  ==================  ==================

Only ``b`` and ``c`` matter. Under the null hypothesis (models equally
good) each disagreement is a coin flip, so ``c ~ Binomial(b + c, 0.5)`` and
an exact binomial test gives the p-value. The exact test is used rather
than the chi-square approximation because ``b + c`` here is often small
(tens of rows), where the approximation is known to be unreliable.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Sequence

from scipy.stats import binomtest
from sklearn.metrics import f1_score

#: Macro-F1 percentage points the candidate may fall below the incumbent
#: before promotion is refused outright, regardless of significance.
F1_FLOOR_TOLERANCE: float = 0.01

#: Significance level for McNemar. 0.05 is conventional; the gate is
#: one-sided in effect because a *significant regression* is rejected by
#: the F1 floor before significance is even consulted.
ALPHA: float = 0.05


@dataclass(frozen=True)
class PromotionDecision:
    """Outcome of the gate, with the numbers that produced it.

    Every field is retained (not just the verdict) because this is what
    gets written to ModelVersions (WBS 4.3.4) and read back months later
    when someone asks why a particular checkpoint was or was not promoted.
    """

    promote: bool
    reason: str
    baseline_macro_f1: float
    candidate_macro_f1: float
    n_fixes: int          # baseline wrong -> candidate right
    n_regressions: int    # baseline right -> candidate wrong
    p_value: float

    def __bool__(self) -> bool:
        return self.promote


def mcnemar_counts(
    y_true: Sequence,
    baseline_pred: Sequence,
    candidate_pred: Sequence,
) -> tuple:
    """Count the two discordant cells: (fixes, regressions).

    Raises:
        ValueError: if the three sequences differ in length -- which would
            silently misalign predictions against labels and produce a
            confident, meaningless verdict.
    """
    if not (len(y_true) == len(baseline_pred) == len(candidate_pred)):
        raise ValueError(
            "y_true, baseline_pred and candidate_pred must be the same "
            f"length; got {len(y_true)}, {len(baseline_pred)}, "
            f"{len(candidate_pred)}"
        )

    fixes = regressions = 0
    for truth, base, cand in zip(y_true, baseline_pred, candidate_pred):
        base_ok = base == truth
        cand_ok = cand == truth
        if not base_ok and cand_ok:
            fixes += 1
        elif base_ok and not cand_ok:
            regressions += 1
    return fixes, regressions


def evaluate_promotion(
    y_true: Sequence,
    baseline_pred: Sequence,
    candidate_pred: Sequence,
    f1_floor_tolerance: float = F1_FLOOR_TOLERANCE,
    alpha: float = ALPHA,
) -> PromotionDecision:
    """Decide whether a retrained candidate replaces the incumbent.

    All three sequences must be aligned to the same validation rows, in the
    same order -- the pairing is the whole basis of the test.

    The checks run in a deliberate order: the F1 floor is evaluated first
    because it is an absolute safety property. A candidate that is
    catastrophically worse must be rejected even in the (impossible in
    practice, but not worth relying on) case that the significance test
    somehow favours it.
    """
    baseline_f1 = float(f1_score(y_true, baseline_pred, average="macro"))
    candidate_f1 = float(f1_score(y_true, candidate_pred, average="macro"))
    fixes, regressions = mcnemar_counts(y_true, baseline_pred, candidate_pred)

    n_discordant = fixes + regressions
    if n_discordant == 0:
        # Identical predictions on every row. Nothing distinguishes the
        # models, so there is no evidence to promote on -- and swapping
        # checkpoints for no measured benefit only adds deployment risk.
        return PromotionDecision(
            promote=False,
            reason="models made identical predictions; no evidence to promote",
            baseline_macro_f1=baseline_f1,
            candidate_macro_f1=candidate_f1,
            n_fixes=0,
            n_regressions=0,
            p_value=1.0,
        )

    p_value = float(
        binomtest(fixes, n_discordant, 0.5).pvalue
    )

    # --- Check 1: absolute floor ---
    if candidate_f1 < baseline_f1 - f1_floor_tolerance:
        return PromotionDecision(
            promote=False,
            reason=(
                f"macro-F1 {candidate_f1:.4f} is more than "
                f"{f1_floor_tolerance:.4f} below baseline {baseline_f1:.4f}"
            ),
            baseline_macro_f1=baseline_f1,
            candidate_macro_f1=candidate_f1,
            n_fixes=fixes,
            n_regressions=regressions,
            p_value=p_value,
        )

    # --- Check 2: is the difference real? ---
    if p_value >= alpha:
        return PromotionDecision(
            promote=False,
            reason=(
                f"difference not significant (p={p_value:.4f} >= {alpha}); "
                f"{fixes} fixes vs {regressions} regressions could be noise"
            ),
            baseline_macro_f1=baseline_f1,
            candidate_macro_f1=candidate_f1,
            n_fixes=fixes,
            n_regressions=regressions,
            p_value=p_value,
        )

    # Significant -- but in which direction? A significant result with more
    # regressions than fixes means the candidate is reliably *worse*, which
    # the F1 floor may not have caught if the drop was inside tolerance.
    if regressions > fixes:
        return PromotionDecision(
            promote=False,
            reason=(
                f"significantly worse: {regressions} regressions vs "
                f"{fixes} fixes (p={p_value:.4f})"
            ),
            baseline_macro_f1=baseline_f1,
            candidate_macro_f1=candidate_f1,
            n_fixes=fixes,
            n_regressions=regressions,
            p_value=p_value,
        )

    return PromotionDecision(
        promote=True,
        reason=(
            f"significantly better: {fixes} fixes vs {regressions} "
            f"regressions (p={p_value:.4f}), macro-F1 "
            f"{baseline_f1:.4f} -> {candidate_f1:.4f}"
        ),
        baseline_macro_f1=baseline_f1,
        candidate_macro_f1=candidate_f1,
        n_fixes=fixes,
        n_regressions=regressions,
        p_value=p_value,
    )
