"""Unit tests for the held-out test set carve-out (Sprint 6, WBS 6.4.6 prep).

Two properties matter and are worth locking in with a test each:

1. Near-duplicate rows that mask to the same text must move together --
   splitting a masked-text group across both sides is exactly the leakage
   bug ``training/dataset.py`` already fixed once on the train/val split
   (13.7% of validation, 31.8% of validation Scams). A holdout set with the
   same leak would be silently invalid the same way.
2. The split lands close to the requested fraction and preserves label
   balance -- if it drifted badly, the "20% held-out set" WBS 6.4.6 asks
   for would quietly not be one.

The CLI plumbing (argument parsing, the file I/O, the --force guard) is not
covered here -- it is a thin, mostly-untestable-in-isolation wrapper around
these two functions, in the same spirit as ``test_retrain_cli.py`` only
covering source resolution and leaving orchestration to a live run.
"""

import importlib.util
import os
import sys

import pandas as pd

# scripts/ is not a package -- same load-by-path pattern as test_retrain_cli.py.
_SPEC = importlib.util.spec_from_file_location(
    "create_holdout_set",
    os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts", "create_holdout_set.py"),
)
holdout_mod = importlib.util.module_from_spec(_SPEC)
sys.modules["create_holdout_set"] = holdout_mod
_SPEC.loader.exec_module(holdout_mod)


def make_df(rows):
    """rows: list of (text, label) -> a DataFrame shaped like the real dataset."""
    return pd.DataFrame({"text": [r[0] for r in rows], "label": [r[1] for r in rows]})


# --- grouping -----------------------------------------------------------
def test_near_duplicate_urls_are_grouped_together():
    """The exact case training/dataset.py's own leakage bug was about."""
    df = make_df(
        [
            ("claim now at http://free-money-1.ph", "Scam"),
            ("claim now at http://free-money-2.ph", "Scam"),
            ("meeting at 3pm tomorrow", "Ham"),
        ]
    )
    groups = holdout_mod._group_by_masked_text(df)
    assert len(groups) == 2  # the two URL variants collapse to one masked group


def test_label_disagreement_within_a_group_does_not_raise(capsys):
    df = make_df(
        [
            ("you won a prize", "Scam"),
            ("you won a prize", "Spam"),  # same text, mislabeled differently somewhere upstream
        ]
    )
    groups = holdout_mod._group_by_masked_text(df)
    assert len(groups) == 1
    assert "different labels" in capsys.readouterr().out


# --- split ----------------------------------------------------------------
def _balanced_df(n_per_class=50):
    rows = []
    for label in ("Ham", "Spam", "Scam"):
        rows.extend((f"{label.lower()} message number {i} with unique padding text", label) for i in range(n_per_class))
    return make_df(rows)


def test_no_masked_group_is_split_across_both_sides():
    """The property that actually makes this a valid holdout set."""
    df = _balanced_df()
    holdout_idx, remaining_idx, _ = holdout_mod.compute_split(df)
    assert set(holdout_idx).isdisjoint(remaining_idx)
    assert len(holdout_idx) + len(remaining_idx) == len(df)


def test_split_lands_near_the_requested_fraction():
    df = _balanced_df(n_per_class=200)  # 600 rows, all unique -> 600 groups
    holdout_idx, remaining_idx, stats = holdout_mod.compute_split(df)

    fraction = len(holdout_idx) / len(df)
    assert abs(fraction - holdout_mod.HOLDOUT_FRACTION) < 0.02
    assert stats["n_groups_total"] == 600


def test_split_is_stratified_by_label():
    df = _balanced_df(n_per_class=200)
    holdout_idx, remaining_idx, _ = holdout_mod.compute_split(df)

    holdout_counts = df.loc[holdout_idx, "label"].value_counts()
    # Each class started with exactly 200 rows; stratification should keep
    # each class close to the overall 20% holdout fraction individually,
    # not just in aggregate (a non-stratified split could take all its
    # holdout rows from one class and none from another).
    for label in ("Ham", "Spam", "Scam"):
        assert 20 <= holdout_counts.get(label, 0) <= 60


def test_split_is_reproducible():
    """Same input, same seed -> same split. Required for the manifest's
    seed to mean anything if this ever needs to be regenerated."""
    df = _balanced_df()
    first = holdout_mod.compute_split(df)
    second = holdout_mod.compute_split(df)
    assert first[0] == second[0]
    assert first[1] == second[1]
