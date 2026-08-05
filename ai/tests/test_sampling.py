"""Unit tests for reservoir sampling — Vitter's Algorithm R (WBS 4.3.6)."""

import pytest

from retraining.sampling import reservoir_sample


# --- basic contract ---------------------------------------------------------
def test_returns_exactly_k_when_population_is_larger():
    assert len(reservoir_sample(range(1000), k=50, seed=42)) == 50


def test_returns_whole_population_when_smaller_than_k():
    """Sampling 500 from a 300-row population is those 300 rows, not an error."""
    result = reservoir_sample(range(300), k=500, seed=42)
    assert sorted(result) == list(range(300))


def test_k_zero_returns_empty():
    assert reservoir_sample(range(100), k=0, seed=42) == []


def test_negative_k_raises():
    with pytest.raises(ValueError):
        reservoir_sample(range(100), k=-1)


def test_empty_stream_returns_empty():
    assert reservoir_sample([], k=10, seed=42) == []


def test_sample_contains_only_real_items_without_duplicates():
    result = reservoir_sample(range(500), k=40, seed=7)
    assert len(set(result)) == 40
    assert all(0 <= item < 500 for item in result)


# --- streaming ---------------------------------------------------------------
def test_consumes_a_generator_exactly_once():
    """The whole point is not materialising the population in memory."""
    stream = (i for i in range(1000))
    result = reservoir_sample(stream, k=25, seed=1)
    assert len(result) == 25
    assert next(stream, "exhausted") == "exhausted"


# --- reproducibility --------------------------------------------------------
def test_same_seed_gives_the_same_sample():
    """A snapshot that cannot be regenerated makes a training regression
    impossible to investigate."""
    a = reservoir_sample(range(1000), k=30, seed=42)
    b = reservoir_sample(range(1000), k=30, seed=42)
    assert a == b


def test_different_seeds_give_different_samples():
    a = reservoir_sample(range(1000), k=30, seed=1)
    b = reservoir_sample(range(1000), k=30, seed=2)
    assert a != b


# --- the actual statistical guarantee ---------------------------------------
def test_sampling_is_approximately_uniform():
    """Algorithm R's guarantee is that every item survives with probability
    k/n. This is the property the whole module exists for -- a plausible
    implementation that quietly favours early or late items would pass every
    other test here while biasing the retraining snapshot toward whatever
    campaign was active that week.
    """
    population, k, trials = 100, 10, 4000
    counts = [0] * population
    for seed in range(trials):
        for item in reservoir_sample(range(population), k=k, seed=seed):
            counts[item] += 1

    expected = trials * k / population  # 400
    # Generous band: this is a smoke test for systematic bias, not a
    # precise goodness-of-fit test.
    assert all(expected * 0.80 < c < expected * 1.20 for c in counts), (
        f"min={min(counts)} max={max(counts)} expected~{expected}"
    )


def test_late_arrivals_are_not_starved():
    """The naive 'keep the first k' bug passes most tests but never admits
    anything after item k."""
    population, k, trials = 50, 5, 2000
    late_hits = 0
    for seed in range(trials):
        sample = reservoir_sample(range(population), k=k, seed=seed)
        late_hits += sum(1 for item in sample if item >= population - 5)

    # Last 5 of 50 items should take ~10% of the k*trials slots.
    expected = trials * k * (5 / population)
    assert expected * 0.75 < late_hits < expected * 1.25
