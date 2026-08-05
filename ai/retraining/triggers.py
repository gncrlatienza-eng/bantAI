"""Retraining trigger evaluation (Sprint 4, WBS 4.1.2 · tested by 4.4.2).

The WBS names three trigger conditions -- "50 samples · F1 drop 5% ·
Page-Hinkley". They fire on **OR**: any one of them is enough. They watch
different things and would each miss what the others catch:

===========================  =========================================
Trigger                      Catches
===========================  =========================================
Validated-sample count       Steady accumulation of corrections. Fires
                             even when accuracy looks fine, because 50
                             human-confirmed mistakes is new signal
                             worth learning from regardless.
F1 floor breach              A sudden, large drop -- a bad deploy, a
                             corrupted checkpoint, a broken tokenizer.
Page-Hinkley drift           A slow slide no single measurement would
                             flag: scammers changing tactics gradually.
                             This is the concept-drift case the
                             manuscript cares about.
===========================  =========================================

Threshold interpretation (WBS 4.1.2 asks these be *confirmed*, since the
manuscript states them loosely):

- **50 samples** -- validated user reports, not raw submissions. A report
  only counts once an admin has marked it Validated (WBS 4.3.2), otherwise
  a single malicious or confused user could force retraining at will.
- **F1 drop 5%** -- read as **5 percentage points absolute** against the
  promoted baseline's macro-F1, not 5% relative. At the current 94.38%
  baseline the two readings differ materially (89.38 vs 89.66), and
  absolute is both the stricter and the more common convention. Macro-F1
  rather than accuracy because the dataset is imbalanced (~62/21/17) --
  accuracy can hold steady while Scam recall collapses.
- **Page-Hinkley** -- see ``PageHinkley`` below.

Nothing here touches the database or the model. Callers supply the numbers;
this module only decides. That keeps it testable and lets the NestJS cron
(WBS 4.3.3) own scheduling without duplicating the policy.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import List, Optional

# --- Defaults (WBS 4.1.2) --------------------------------------------------- #

#: Validated user reports that alone justify a retrain.
MIN_VALIDATED_SAMPLES: int = 50

#: Absolute macro-F1 percentage points below baseline that count as a breach.
F1_DROP_TOLERANCE: float = 0.05

#: Baseline macro-F1 of the currently promoted model (run-3, 2026-07-29).
#: Overridden per call once ModelVersions (WBS 4.3.4) tracks this per model.
BASELINE_MACRO_F1: float = 0.9438


@dataclass
class PageHinkley:
    """Page-Hinkley change detector, tuned to detect a *decrease*.

    Classic formulation tracks a cumulative deviation and signals when it
    strays too far from its own running extreme. The textbook version
    detects increases; performance monitoring needs the mirror image, so
    this tracks the running **maximum** and fires when the cumulative sum
    falls ``threshold`` below it.

    Why this rather than "F1 dropped below X" alone: a gradual slide never
    trips a fixed floor until it is already severe. Each individual batch
    looks like noise; only the accumulated one-directional drift is
    visible. That slow slide is exactly what a changing scam landscape
    produces, and it is the case the manuscript's concept-drift discussion
    is about.

    ``delta`` is the per-observation slack -- how much routine wobble to
    absorb before counting a dip as evidence. Too small and normal variance
    triggers constantly; too large and real drift is absorbed as noise.

    Stateful by design: feed it one metric per evaluation window via
    :meth:`update`, in order.
    """

    delta: float = 0.005
    threshold: float = 0.05

    _n: int = field(default=0, init=False)
    _mean: float = field(default=0.0, init=False)
    _cumulative: float = field(default=0.0, init=False)
    _max_cumulative: float = field(default=0.0, init=False)

    def update(self, value: float) -> bool:
        """Feed one observation. Returns True when drift is detected.

        The detector deliberately does **not** reset itself on detection --
        the caller decides what a detection means (retrain, alert, ignore)
        and calls :meth:`reset` when a new baseline is established. Silent
        self-reset would make repeated calls return False and hide ongoing
        drift from anything that polls.
        """
        self._n += 1
        # Running mean, Welford-style, so no observation history is retained.
        self._mean += (value - self._mean) / self._n

        # Slack is ADDED, not subtracted. The textbook increase-detecting
        # form subtracts it; mirroring the test for decreases flips that
        # sign too. Subtracting here makes a perfectly stable metric
        # accumulate -delta every step, so the gap from the running max
        # grows without bound and the detector false-alarms on constant
        # input -- caught by test_stable_metric_does_not_signal_drift.
        self._cumulative += value - self._mean + self.delta
        self._max_cumulative = max(self._max_cumulative, self._cumulative)

        return (self._max_cumulative - self._cumulative) > self.threshold

    def reset(self) -> None:
        """Clear all state. Call after retraining establishes a new baseline."""
        self._n = 0
        self._mean = 0.0
        self._cumulative = 0.0
        self._max_cumulative = 0.0


@dataclass(frozen=True)
class TriggerDecision:
    """Why retraining should (or should not) run.

    ``reasons`` lists every condition that fired, not just the first. An
    operator reading a retraining log wants to know whether one trigger
    tripped or all three -- three at once is a very different situation
    from a routine sample-count rollover.
    """

    should_retrain: bool
    reasons: List[str]

    def __bool__(self) -> bool:
        return self.should_retrain


def evaluate(
    validated_samples: int = 0,
    current_macro_f1: Optional[float] = None,
    baseline_macro_f1: float = BASELINE_MACRO_F1,
    drift_detected: bool = False,
    min_samples: int = MIN_VALIDATED_SAMPLES,
    f1_drop_tolerance: float = F1_DROP_TOLERANCE,
) -> TriggerDecision:
    """Decide whether to retrain. Pure function -- no I/O, no model access.

    Args:
        validated_samples: Reports an admin has marked Validated since the
            last retrain. Pending/Rejected reports must not be counted.
        current_macro_f1: Latest measured macro-F1, or None when no
            evaluation has run yet (a fresh deploy) -- in which case the F1
            trigger simply abstains rather than treating "unknown" as zero,
            which would fire a spurious retrain on every cold start.
        baseline_macro_f1: Macro-F1 of the promoted model to compare against.
        drift_detected: Result of the caller's :class:`PageHinkley` stream.
            Passed in rather than computed here because drift state spans
            many evaluation windows and belongs to the long-lived caller.
    """
    reasons: List[str] = []

    if validated_samples >= min_samples:
        reasons.append(
            f"validated_samples={validated_samples} reached threshold {min_samples}"
        )

    if current_macro_f1 is not None:
        drop = baseline_macro_f1 - current_macro_f1
        if drop >= f1_drop_tolerance:
            reasons.append(
                f"macro_f1 fell {drop:.4f} below baseline "
                f"{baseline_macro_f1:.4f} (tolerance {f1_drop_tolerance:.4f})"
            )

    if drift_detected:
        reasons.append("Page-Hinkley detected sustained downward drift")

    return TriggerDecision(should_retrain=bool(reasons), reasons=reasons)
