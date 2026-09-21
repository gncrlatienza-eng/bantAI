"""Tests for scripts/merge_augmented_rows.py — which rows may enter the corpus."""

import importlib.util
import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SPEC = importlib.util.spec_from_file_location(
    "merge_augmented_rows", os.path.join(_AI_DIR, "scripts", "merge_augmented_rows.py")
)
merge = importlib.util.module_from_spec(_SPEC)
sys.modules["merge_augmented_rows"] = merge
_SPEC.loader.exec_module(merge)


def row(text, label="Scam", correct="SCAM", origin="authored"):
    return {"text": text, "label": label, "correct_label": correct, "origin": origin}


# --- what counts as a reviewer's approval --------------------------------
def test_confirmation_is_approval_and_disagreement_is_rejection():
    """The convention augment_scam_dataset.rejected_seed_ids already relies on."""
    assert merge.classify_row(row("x", correct="SCAM"), False) == "approved"
    assert merge.classify_row(row("x", correct="Ham"), False) == "rejected"


def test_blank_is_unreviewed_not_a_silent_yes():
    assert merge.classify_row(row("x", correct=""), False) == "unreviewed"


def test_blank_counts_as_approval_only_when_asked():
    """Older sheets where the reviewer marked corrections only."""
    assert merge.classify_row(row("x", correct=""), True) == "approved"
    assert merge.classify_row(row("x", label="Ham", correct=""), True) == "unreviewed"


def test_a_confirmed_non_scam_row_is_not_merged():
    """The generator only makes Scam; a confirmed Ham row is not corpus material."""
    assert merge.classify_row(row("x", label="Ham", correct="HAM"), False) == "not-scam"


# --- what the plan refuses ------------------------------------------------
def test_approved_rows_are_added_with_their_origin():
    to_add, counts = merge.plan([], [], set(), False)
    assert to_add == [] and counts == {}

    added, counts = merge._plan_rows([(row("brand new scam", origin="variant"), "augmented:batch")], [], set())
    assert len(added) == 1
    assert added[0]["origin"] == "variant"
    assert added[0]["label"] == "Scam"
    assert added[0]["source"] == "augmented:batch"


def test_a_row_already_in_the_corpus_is_refused():
    """Merging it would add nothing, and a label clash would block training."""
    corpus = [{"text": "claim your prize at http://a.example", "label": "Scam"}]
    added, counts = merge._plan_rows([(row("claim your prize at http://b.example"), "augmented:batch")], corpus, set())
    assert added == []
    assert counts["skipped: already in the corpus"] == 1


def test_a_row_matching_the_holdout_is_refused():
    """Training on the test set is the one mistake that invalidates the thesis number."""
    from preprocessing import preprocess

    holdout = {preprocess("verify your account at http://x.example")}
    added, counts = merge._plan_rows([(row("verify your account at http://y.example"), "augmented:batch")], [], holdout)
    assert added == []
    assert counts["skipped: in the frozen holdout"] == 1


def test_duplicates_within_one_batch_are_added_once():
    pair = [(row("same scam text here"), "augmented:batch"), (row("same scam text here"), "augmented:batch")]
    added, counts = merge._plan_rows(pair, [], set())
    assert len(added) == 1
    assert counts["skipped: duplicate within the batch"] == 1
