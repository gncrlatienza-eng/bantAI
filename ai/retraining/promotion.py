"""Model promotion gate — McNemar test + F1 floor + Scam-recall floor (Sprint 4, WBS 4.3.7).

A retrained model must never be promoted just because its headline metric
moved up. Three independent checks have to pass:

1. **F1 floor** -- the candidate's macro-F1 must not fall more than a
   tolerated margin below the incumbent's. An absolute guardrail; cheap,
   and catches an outright broken run immediately.

2. **Scam-recall floor** -- the candidate's recall on Scam must not fall
   more than a tolerated margin below the incumbent's. Macro-F1 averages
   three classes, so gains on Ham/Spam can outweigh fewer scams caught, and
   a missed scam is the most costly error this system makes. Added
   2026-09-14 (Reymark's audit): the 2026-08-27 candidate cleared the first
   two checks with 193 fixes vs 76 regressions while catching 11 fewer of
   the 357 validation scams than the incumbent (-3.1pp). The manuscript
   specifies McNemar + F1 floor only; this third check is an addition.

3. **McNemar's test** -- is the difference *statistically real*, or noise?
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
from typing import Optional, Sequence

from scipy.stats import binomtest
from sklearn.metrics import f1_score

#: Macro-F1 percentage points the candidate may fall below the incumbent
#: before promotion is refused outright, regardless of significance.
F1_FLOOR_TOLERANCE: float = 0.01

#: Significance level for McNemar. 0.05 is conventional; the gate is
#: one-sided in effect because a *significant regression* is rejected by
#: the F1 floor before significance is even consulted.
ALPHA: float = 0.05

#: Scam-recall points the candidate may fall below the incumbent before
#: promotion is refused. Matches the F1 floor's 1pp; at ~357 validation scams
#: that is ~3 messages of noise allowance.
SCAM_RECALL_TOLERANCE: float = 0.01


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
    n_fixes: int  # baseline wrong -> candidate right
    n_regressions: int  # baseline right -> candidate wrong
    p_value: float

    #: ``{"Scam->Spam": 20, ...}`` -- which class confusions the regressions
    #: and fixes actually consist of. Text-free by design, so it can be
    #: committed and quoted; the row-level detail contains real message
    #: bodies and stays in the git-ignored run directory.
    #:
    #: Populated by ``pipeline.evaluate_candidate``, not by the gate itself:
    #: the gate's job is the verdict, and it has no business deciding what
    #: gets persisted. ``None`` when nobody asked for the breakdown.
    regression_transitions: Optional[dict] = None
    fix_transitions: Optional[dict] = None

    #: ``None`` when the validation rows contain no Scam at all, in which case
    #: the Scam-recall floor cannot be evaluated and is skipped.
    baseline_scam_recall: Optional[float] = None
    candidate_scam_recall: Optional[float] = None

    def __bool__(self) -> bool:
        return self.promote


def discordant_indices(
    y_true: Sequence,
    baseline_pred: Sequence,
    candidate_pred: Sequence,
) -> tuple:
    """Locate the two discordant cells: ``(fix_indices, regression_indices)``.

    The counts alone answer *how many* rows changed, which is all the gate
    needs. They cannot answer **which** rows -- so "what did the new model
    break?" was unanswerable from a completed run, and that is the first
    question anyone reviewing a promotion asks. The indices point back into
    the caller's validation sequence so the offending rows can be recovered.

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

    fixes = []
    regressions = []
    for i, (truth, base, cand) in enumerate(zip(y_true, baseline_pred, candidate_pred)):
        base_ok = base == truth
        cand_ok = cand == truth
        if not base_ok and cand_ok:
            fixes.append(i)
        elif base_ok and not cand_ok:
            regressions.append(i)
    return fixes, regressions


def mcnemar_counts(
    y_true: Sequence,
    baseline_pred: Sequence,
    candidate_pred: Sequence,
) -> tuple:
    """Count the two discordant cells: ``(fixes, regressions)``.

    Thin wrapper over :func:`discordant_indices` so the two can never
    disagree about what counts as a fix or a regression.
    """
    fixes, regressions = discordant_indices(y_true, baseline_pred, candidate_pred)
    return len(fixes), len(regressions)


def _recall(y_true: Sequence, pred: Sequence, label) -> Optional[float]:
    """Share of ``label`` rows predicted as ``label``; ``None`` if there are none."""
    hits = [p == label for t, p in zip(y_true, pred) if t == label]
    return sum(hits) / len(hits) if hits else None


def evaluate_promotion(
    y_true: Sequence,
    baseline_pred: Sequence,
    candidate_pred: Sequence,
    f1_floor_tolerance: float = F1_FLOOR_TOLERANCE,
    alpha: float = ALPHA,
    scam_label="Scam",
    scam_recall_tolerance: float = SCAM_RECALL_TOLERANCE,
) -> PromotionDecision:
    """Decide whether a retrained candidate replaces the incumbent.

    All three sequences must be aligned to the same validation rows, in the
    same order -- the pairing is the whole basis of the test.

    ``scam_label`` is however Scam is spelled in these sequences: the string
    ``"Scam"`` by default, ``LABEL2ID["Scam"]`` when the caller passes label
    ids (as ``pipeline.evaluate_candidate`` does).

    The checks run in a deliberate order: the two floors are evaluated first
    because they are absolute safety properties. A candidate that is
    catastrophically worse -- overall, or at catching scams -- must be
    rejected regardless of what the significance test says.
    """
    baseline_f1 = float(f1_score(y_true, baseline_pred, average="macro"))
    candidate_f1 = float(f1_score(y_true, candidate_pred, average="macro"))
    baseline_scam = _recall(y_true, baseline_pred, scam_label)
    candidate_scam = _recall(y_true, candidate_pred, scam_label)
    fixes, regressions = mcnemar_counts(y_true, baseline_pred, candidate_pred)
    n_discordant = fixes + regressions
    p_value = float(binomtest(fixes, n_discordant, 0.5).pvalue) if n_discordant else 1.0

    def decide(promote: bool, reason: str) -> PromotionDecision:
        return PromotionDecision(
            promote=promote,
            reason=reason,
            baseline_macro_f1=baseline_f1,
            candidate_macro_f1=candidate_f1,
            n_fixes=fixes,
            n_regressions=regressions,
            p_value=p_value,
            baseline_scam_recall=baseline_scam,
            candidate_scam_recall=candidate_scam,
        )

    if n_discordant == 0:
        # Identical predictions on every row. Nothing distinguishes the
        # models, so there is no evidence to promote on -- and swapping
        # checkpoints for no measured benefit only adds deployment risk.
        return decide(False, "models made identical predictions; no evidence to promote")

    # --- Check 1: absolute F1 floor ---
    if candidate_f1 < baseline_f1 - f1_floor_tolerance:
        return decide(
            False,
            f"macro-F1 {candidate_f1:.4f} is more than {f1_floor_tolerance:.4f} below baseline {baseline_f1:.4f}",
        )

    # --- Check 2: Scam-recall floor ---
    if baseline_scam is not None and candidate_scam < baseline_scam - scam_recall_tolerance:
        return decide(
            False,
            f"Scam recall {candidate_scam:.4f} is more than {scam_recall_tolerance:.4f} "
            f"below baseline {baseline_scam:.4f}",
        )

    # --- Check 3: is the difference real? ---
    if p_value >= alpha:
        return decide(
            False,
            f"difference not significant (p={p_value:.4f} >= {alpha}); "
            f"{fixes} fixes vs {regressions} regressions could be noise",
        )

    # Significant -- but in which direction? A significant result with more
    # regressions than fixes means the candidate is reliably *worse*, which
    # the F1 floor may not have caught if the drop was inside tolerance.
    if regressions > fixes:
        return decide(False, f"significantly worse: {regressions} regressions vs {fixes} fixes (p={p_value:.4f})")

    return decide(
        True,
        f"significantly better: {fixes} fixes vs {regressions} regressions (p={p_value:.4f}), "
        f"macro-F1 {baseline_f1:.4f} -> {candidate_f1:.4f}",
    )
