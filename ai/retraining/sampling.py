"""Reservoir sampling — Vitter's Algorithm R (Sprint 4, WBS 4.3.6).

Retraining snapshots cannot simply take "the newest N rows". Doing so
over-represents whatever campaign happened to be active that week, and the
model drifts toward the recent past while forgetting older scam patterns
that still circulate. A uniform random sample over the *whole* population
is what keeps the training distribution honest.

Algorithm R does that in a single pass with fixed memory, without knowing
the population size in advance -- which matters because the caller streams
rows out of the database (or a CSV) rather than materialising 16,772+ rows
plus every validated report in memory just to shuffle them.

The guarantee: after consuming a stream of ``n`` items, every item is in
the reservoir with probability exactly ``k/n``, regardless of arrival order.

    for i, item in enumerate(stream):
        if i < k:              reservoir[i] = item
        else:                  j = randint(0, i)
                               if j < k: reservoir[j] = item

Vitter (1985), "Random Sampling with a Reservoir", ACM TOMS 11(1).
"""

from __future__ import annotations

import random
from typing import Iterable, List, Optional, TypeVar

T = TypeVar("T")


def reservoir_sample(
    stream: Iterable[T],
    k: int,
    seed: Optional[int] = None,
) -> List[T]:
    """Uniformly sample ``k`` items from a stream of unknown length.

    Returns fewer than ``k`` items only when the stream is shorter than
    ``k`` -- in that case every item is returned, which is the correct
    behaviour (sampling 500 rows from a 300-row population is just those
    300 rows, not an error).

    Args:
        stream: Any iterable. Consumed exactly once, so generators are fine.
        k: Reservoir size. Must be non-negative.
        seed: Fixes the RNG for reproducible snapshots. Training runs are
            compared against each other, so a snapshot that cannot be
            regenerated makes a regression impossible to investigate --
            pass the training config's seed here.

    Raises:
        ValueError: if ``k`` is negative.
    """
    if k < 0:
        raise ValueError(f"reservoir size must be non-negative, got {k}")
    if k == 0:
        return []

    rng = random.Random(seed)
    reservoir: List[T] = []

    for i, item in enumerate(stream):
        if i < k:
            reservoir.append(item)
        else:
            # randint is inclusive on both ends, so this picks from [0, i]
            # -- an i+1-wide range, giving the incoming item its correct
            # k/(i+1) retention probability.
            j = rng.randint(0, i)
            if j < k:
                reservoir[j] = item

    return reservoir
