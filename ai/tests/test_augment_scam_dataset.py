"""Unit tests for the targeted Scam augmentation generator.

The generator writes rows that go into training data, so the properties worth
locking in are the ones whose failure would be *invisible* in the output CSV:

1. No generated row may mask to a holdout message, and no holdout message may
   be used as a seed. A variant of a holdout row is training on the test set,
   and nothing downstream would catch it -- the row reads as ordinary.
2. A seed a human rejected in an earlier review may not come back. Found
   2026-09-16: two rejected seeds survived the label corrections and produced
   ten fresh variants on the next run.
3. A "variant" that masks to the same string as its seed is not a variant.
   ``preprocess`` removes links, amounts, phone numbers and codes, so a row
   varying only those is a duplicate the snapshot de-duplicates away.
4. At most ``MAX_VARIANTS_PER_SEED`` rows come from any one seed, and every
   row carries the provenance (``origin``, ``seed_id``) the ablation needs.

The template text itself is not tested -- whether a generated message reads
like a real Philippine scam is a human-review question, which is exactly why
the script writes to ``datasets/augmented/`` for review instead of merging.
"""

import csv
import importlib.util
import json
import os
import random
import sys

import pytest

# scripts/ is not a package -- same load-by-path pattern as test_retrain_cli.py.
_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SPEC = importlib.util.spec_from_file_location(
    "augment_scam_dataset",
    os.path.join(_AI_DIR, "scripts", "augment_scam_dataset.py"),
)
aug = importlib.util.module_from_spec(_SPEC)
sys.modules["augment_scam_dataset"] = aug
_SPEC.loader.exec_module(aug)

from preprocessing import preprocess  # noqa: E402

# A message that categorises as Brand Impersonation (structural: known brand +
# non-official link), so it is a usable seed for a TARGETS category.
SEED_TEXT = "BDO Alert: Unusual login detected on your account. Please verify now: http://bdo-secure.info"
OTHER_SEED = "GCash: your wallet will be deactivated. Click here to confirm: http://gcash-verify.help"


def write_csv(path, rows, fieldnames):
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return str(path)


# --- rejected-seed feedback loop --------------------------------------------


def test_a_reviewed_rejection_excludes_that_seed_from_future_batches(tmp_path):
    write_csv(
        tmp_path / "batch.csv",
        [
            {
                "text": "x",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": "abc123",
                "correct_label": "Ham",
            }
        ],
        ["text", "label", "category", "origin", "seed_id", "correct_label"],
    )
    assert aug.rejected_seed_ids(str(tmp_path)) == {"abc123"}


def test_a_row_left_unmarked_in_review_is_not_a_rejection(tmp_path):
    """An empty ``correct_label`` means "reviewed and fine", or "not yet read"
    -- either way it is not a judgement against the seed."""
    write_csv(
        tmp_path / "batch.csv",
        [
            {
                "text": "x",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": "keep",
                "correct_label": "",
            },
            {
                "text": "y",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": "drop",
                "correct_label": "Ham",
            },
        ],
        ["text", "label", "category", "origin", "seed_id", "correct_label"],
    )
    assert aug.rejected_seed_ids(str(tmp_path)) == {"drop"}


def test_batch_output_without_a_review_column_is_ignored(tmp_path):
    """The generator's own output lands in the same directory it reads back."""
    write_csv(
        tmp_path / "scam_augmentation_2026-01-01T00-00-00Z.csv",
        [{"text": "x", "label": "Scam", "category": "c", "origin": "variant", "seed_id": "abc123"}],
        ["text", "label", "category", "origin", "seed_id"],
    )
    assert aug.rejected_seed_ids(str(tmp_path)) == set()


def test_an_unreadable_file_does_not_take_down_the_run(tmp_path):
    """A stray directory or a file open in Excel must not abort a batch --
    losing one review file is better than losing the generator."""
    os.mkdir(tmp_path / "locked.csv")
    write_csv(
        tmp_path / "good.csv",
        [
            {
                "text": "x",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": "abc123",
                "correct_label": "Ham",
            }
        ],
        ["text", "label", "category", "origin", "seed_id", "correct_label"],
    )
    assert aug.rejected_seed_ids(str(tmp_path)) == {"abc123"}


def test_no_review_directory_yet_is_not_an_error(tmp_path):
    assert aug.rejected_seed_ids(str(tmp_path / "does-not-exist")) == set()


# --- variants have to differ after masking ----------------------------------


def test_a_variant_that_survives_masking_is_never_returned_unchanged():
    """Property, run over many draws rather than one lucky seed: whenever
    ``make_variant`` returns text, that text masks to something new."""
    rng = random.Random(0)
    returned = 0
    for _ in range(300):
        text = aug.make_variant(SEED_TEXT, rng)
        if text is not None:
            returned += 1
            assert preprocess(text) != preprocess(SEED_TEXT)
    assert returned > 0, "the seed has swappable wording; some draw should have varied it"


def test_a_seed_with_no_swappable_wording_yields_nothing():
    rng = random.Random(1)
    assert aug.make_variant("Nothing to swap here at all.", rng) is None


def test_varying_only_the_link_would_not_count_as_a_variant():
    """The constraint the module docstring leads with, stated as a test: two
    messages differing only in their URL are the same row to the model."""
    a = "BDO Alert: verify now: http://one.example"
    b = "BDO Alert: verify now: http://two.example"
    assert preprocess(a) == preprocess(b)


# --- generation invariants ---------------------------------------------------


def test_no_generated_row_masks_to_an_already_known_message():
    """``seen_masked`` carries the whole labeled pool *and* the holdout."""
    holdout_masked = preprocess(SEED_TEXT)
    seen = {holdout_masked}
    rows = aug.generate(
        {"Brand Impersonation": [{"text": SEED_TEXT}]},
        {"Brand Impersonation": 0},
        seen,
        {"Brand Impersonation": 40},
        {"Brand Impersonation": 0.6},
        random.Random(7),
    )
    assert rows
    assert all(preprocess(r["text"]) != holdout_masked for r in rows)


def test_one_seed_cannot_produce_more_than_the_cap():
    rows = aug.generate(
        {"Brand Impersonation": [{"text": SEED_TEXT}, {"text": OTHER_SEED}]},
        {"Brand Impersonation": 0},
        set(),
        {"Brand Impersonation": 60},
        {"Brand Impersonation": 1.0},
        random.Random(7),
    )
    counts = {}
    for row in rows:
        if row["origin"] == "variant":
            counts[row["seed_id"]] = counts.get(row["seed_id"], 0) + 1
    assert counts, "variant_share 1.0 should have produced variants"
    assert max(counts.values()) <= aug.MAX_VARIANTS_PER_SEED


def test_every_row_carries_the_provenance_the_ablation_needs():
    rows = aug.generate(
        {"Brand Impersonation": [{"text": SEED_TEXT}]},
        {"Brand Impersonation": 0},
        set(),
        {"Brand Impersonation": 30},
        {"Brand Impersonation": 0.5},
        random.Random(3),
    )
    assert rows
    for row in rows:
        assert row["label"] == "Scam"
        assert row["category"] == "Brand Impersonation"
        assert row["origin"] in {"variant", "authored"}
        # A variant has to be traceable back to the real message it came from;
        # an authored row has no seed to point at.
        assert bool(row["seed_id"]) == (row["origin"] == "variant")
    variants = [r for r in rows if r["origin"] == "variant"]
    assert all(r["seed_id"] == aug._digest(preprocess(SEED_TEXT)) for r in variants)


def test_a_category_already_at_target_generates_nothing():
    rows = aug.generate(
        {"Brand Impersonation": [{"text": SEED_TEXT}]},
        {"Brand Impersonation": 400},
        set(),
        {"Brand Impersonation": 400},
        {"Brand Impersonation": 0.5},
        random.Random(3),
    )
    assert rows == []


def test_the_taglish_quota_is_a_share_of_accepted_rows_not_of_attempts():
    """Rejection sampling reshapes a per-attempt probability -- the reason the
    first pass landed 14x above target. The quota is counted on rows kept."""
    rows = aug.generate(
        {},
        {"Fake Job Offer": 0},
        set(),
        {"Fake Job Offer": 100},
        {"Fake Job Offer": 0.0},
        random.Random(11),
        taglish_rate=0.1,
    )
    po = sum(1 for r in rows if " po " in f" {r['text'].lower()} ")
    assert rows
    # 10% quota over 100 rows, with the English bank exhausting first; allow
    # slack for short batches but catch the order-of-magnitude failure.
    assert po <= 0.25 * len(rows)


@pytest.mark.parametrize("category", sorted(aug.TEMPLATES))
def test_zero_taglish_rate_writes_no_tagalog_templates(category):
    """Regression, 2026-09-17: one English template used the ``{cta_tl}`` slot,
    so it shipped "po" while being drawn as English -- invisible to the quota,
    which only counts rows it drew from the Tagalog bank."""
    rng = random.Random(5)
    for _ in range(120):
        text = aug.make_authored(category, rng, taglish_rate=0.0)
        assert " po " not in f" {text.lower()} ", text


def test_the_english_template_bank_holds_no_tagalog_slots():
    """Stated against the templates rather than their output: a rate check over
    generated rows cannot catch this reliably. The leak above was 3 rows in
    462 -- real, but far under any sane over-representation threshold."""
    for category, templates in aug.TEMPLATES.items():
        for template in templates:
            assert "{cta_tl}" not in template, f"{category}: {template}"


# --- end to end --------------------------------------------------------------


@pytest.fixture
def fake_corpus(tmp_path, monkeypatch):
    """A miniature labeled pool + holdout, wired into the module's constants."""
    labeled = tmp_path / "labeled.csv"
    holdout = tmp_path / "holdout.csv"
    out_dir = tmp_path / "augmented"
    fields = ["text", "label"]
    write_csv(
        labeled,
        [
            {"text": SEED_TEXT, "label": "Scam"},
            {"text": OTHER_SEED, "label": "Scam"},
            {"text": "Your load balance is 120 pesos.", "label": "Ham"},
        ],
        fields,
    )
    write_csv(holdout, [{"text": OTHER_SEED, "label": "Scam"}], fields)
    monkeypatch.setattr(aug, "LABELED_CSV", str(labeled))
    monkeypatch.setattr(aug, "HOLDOUT_CSV", str(holdout))
    monkeypatch.setattr(aug, "TARGETS", {"Brand Impersonation": 12})
    return out_dir


def run_main(out_dir, extra=()):
    assert aug.main(["--out-dir", str(out_dir), *extra]) == 0
    csvs = [p for p in os.listdir(out_dir) if p.endswith(".csv")]
    jsons = [p for p in os.listdir(out_dir) if p.endswith(".json")]
    assert len(csvs) == 1 and len(jsons) == 1
    with open(os.path.join(out_dir, csvs[0]), encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    with open(os.path.join(out_dir, jsons[0]), encoding="utf-8") as handle:
        summary = json.load(handle)
    return rows, summary


def test_a_holdout_message_is_never_used_as_a_seed(fake_corpus):
    rows, summary = run_main(fake_corpus)
    assert summary["seeds_excluded_for_being_in_holdout"] == 1
    excluded = aug._digest(preprocess(OTHER_SEED))
    assert all(r["seed_id"] != excluded for r in rows)


def test_nothing_generated_masks_to_a_holdout_message(fake_corpus):
    rows, _ = run_main(fake_corpus)
    assert rows
    assert all(preprocess(r["text"]) != preprocess(OTHER_SEED) for r in rows)


def test_a_rejected_seed_is_excluded_on_the_next_run(fake_corpus):
    os.makedirs(fake_corpus, exist_ok=True)
    write_csv(
        fake_corpus / "review_me.csv",
        [
            {
                "text": "irrelevant",
                "label": "Scam",
                "category": "Brand Impersonation",
                "origin": "variant",
                "seed_id": aug._digest(preprocess(SEED_TEXT)),
                "correct_label": "Ham",
            }
        ],
        ["text", "label", "category", "origin", "seed_id", "correct_label"],
    )
    assert aug.main(["--out-dir", str(fake_corpus)]) == 0
    batches = [p for p in os.listdir(fake_corpus) if p.startswith("scam_augmentation_") and p.endswith(".csv")]
    with open(os.path.join(fake_corpus, batches[0]), encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert rows, "authored rows should still fill the target"
    assert all(r["origin"] == "authored" for r in rows), "both seeds are excluded, so no variant is possible"


def test_a_sample_run_writes_nothing(fake_corpus):
    assert aug.main(["--sample", "--out-dir", str(fake_corpus)]) == 0
    assert not os.path.isdir(fake_corpus) or os.listdir(fake_corpus) == []


def test_the_batch_ships_an_empty_reviewer_column(fake_corpus):
    """The review loop reads ``correct_label`` back, so the batch has to ship
    it. Until 2026-09-17 it did not, and a reviewer had to add the column by
    hand before a rejection could ever be recorded."""
    rows, _ = run_main(fake_corpus)
    assert rows
    assert "correct_label" in rows[0]
    assert all(r["correct_label"] == "" for r in rows), "must ship blank, not pre-filled"


def test_an_unreviewed_batch_rejects_no_seeds(fake_corpus):
    """The new column must not make every row look like a rejection."""
    run_main(fake_corpus)
    assert aug.rejected_seed_ids(str(fake_corpus)) == set()


def test_confirming_a_row_is_not_a_rejection(tmp_path):
    """Regression, 2026-09-17: a reviewer marked 485 of 514 rows "SCAM" to mean
    "yes, correct". Treating any non-empty verdict as a rejection would have
    emptied the seed pool on the next run, reported only as a smaller batch."""
    write_csv(
        tmp_path / "reviewed.csv",
        [
            {"text": "a", "label": "Scam", "category": "c", "origin": "variant",
             "seed_id": "keep", "correct_label": "SCAM"},
            {"text": "b", "label": "Scam", "category": "c", "origin": "variant",
             "seed_id": "keep2", "correct_label": "scam"},
            {"text": "c", "label": "Scam", "category": "c", "origin": "variant",
             "seed_id": "drop", "correct_label": "Ham"},
        ],
        ["text", "label", "category", "origin", "seed_id", "correct_label"],
    )
    assert aug.rejected_seed_ids(str(tmp_path)) == {"drop"}
