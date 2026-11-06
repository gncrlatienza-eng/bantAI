"""Unit tests for the rejected-seed review sheet.

The sheet exists to turn "the generator stopped using this seed" into "the
mislabelled row got fixed". The properties worth locking in are the two that
would fail silently: counting a *confirmation* as a rejection (which would drag
the entire pool into the sheet), and applying a variant's verdict to its seed
without a human looking again.
"""

import csv
import importlib.util
import os
import sys

_AI_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SPEC = importlib.util.spec_from_file_location(
    "make_rejected_seed_review_sheet",
    os.path.join(_AI_DIR, "scripts", "make_rejected_seed_review_sheet.py"),
)
sheet = importlib.util.module_from_spec(_SPEC)
sys.modules["make_rejected_seed_review_sheet"] = sheet
_SPEC.loader.exec_module(sheet)

from preprocessing import preprocess  # noqa: E402

SEED_TEXT = "Claim your 1GB PER DAY freebie access to various apps with your GoSURF50!"


def write_csv(path, rows, fieldnames):
    with open(path, "w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    return str(path)


BATCH_FIELDS = ["text", "label", "category", "origin", "seed_id", "correct_label"]
LABELED_FIELDS = ["text", "label", "language", "timestamp", "source"]


def test_a_disagreeing_verdict_is_a_rejection(tmp_path):
    write_csv(
        tmp_path / "batch.csv",
        [
            {
                "text": "v",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": "s1",
                "correct_label": "Spam",
            }
        ],
        BATCH_FIELDS,
    )
    assert sheet.rejections(str(tmp_path)) == {"s1": [("Spam", "v")]}


def test_a_confirming_verdict_is_not_a_rejection(tmp_path):
    """A 2026-09-18 review marked 485 of 514 rows "SCAM" to confirm them. Read
    as rejections, that would have pulled nearly the whole pool into this
    sheet."""
    write_csv(
        tmp_path / "batch.csv",
        [
            {
                "text": "a",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": "s1",
                "correct_label": "SCAM",
            },
            {
                "text": "b",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": "s2",
                "correct_label": "scam",
            },
            {
                "text": "c",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": "s3",
                "correct_label": "Ham",
            },
        ],
        BATCH_FIELDS,
    )
    assert set(sheet.rejections(str(tmp_path))) == {"s3"}


def test_unreviewed_rows_reject_nothing(tmp_path):
    write_csv(
        tmp_path / "batch.csv",
        [{"text": "v", "label": "Scam", "category": "c", "origin": "variant", "seed_id": "s1", "correct_label": ""}],
        BATCH_FIELDS,
    )
    assert sheet.rejections(str(tmp_path)) == {}


def test_the_sheet_leaves_the_verdict_blank_for_a_human(tmp_path):
    """The variant's verdict is context, never an answer. Applying it directly
    would have mislabelled the Atome message, whose variants were marked Spam
    and which was later judged Scam on a direct read."""
    aug = tmp_path / "augmented"
    aug.mkdir()
    write_csv(
        aug / "batch.csv",
        [
            {
                "text": "variant text",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": sheet._digest(preprocess(SEED_TEXT)),
                "correct_label": "Spam",
            }
        ],
        BATCH_FIELDS,
    )
    labeled = write_csv(
        tmp_path / "labeled.csv",
        [
            {"text": SEED_TEXT, "label": "Scam", "language": "english", "timestamp": "", "source": "raw-inbox"},
            {"text": "unrelated real scam", "label": "Scam", "language": "english", "timestamp": "", "source": "ntc"},
        ],
        LABELED_FIELDS,
    )
    out = tmp_path / "out.csv"
    assert sheet.main(["--labeled", labeled, "--augmented-dir", str(aug), "--out", str(out)]) == 0

    with open(out, encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))
    assert len(rows) == 1, "only the seed behind a rejected variant belongs in the sheet"
    assert rows[0]["text"] == SEED_TEXT
    assert rows[0]["verdict"] == "", "the reviewer decides; the sheet must not pre-answer"
    assert rows[0]["correct_label"] == ""
    assert "Spam" in rows[0]["reason"], "the earlier verdict belongs in the sheet as context"


def test_a_seed_already_relabelled_is_not_listed_again(tmp_path):
    """Once the correction lands the row is no longer Scam, so it drops out."""
    aug = tmp_path / "augmented"
    aug.mkdir()
    write_csv(
        aug / "batch.csv",
        [
            {
                "text": "v",
                "label": "Scam",
                "category": "c",
                "origin": "variant",
                "seed_id": sheet._digest(preprocess(SEED_TEXT)),
                "correct_label": "Spam",
            }
        ],
        BATCH_FIELDS,
    )
    labeled = write_csv(
        tmp_path / "labeled.csv",
        [{"text": SEED_TEXT, "label": "Spam", "language": "english", "timestamp": "", "source": "raw-inbox"}],
        LABELED_FIELDS,
    )
    out = tmp_path / "out.csv"
    assert sheet.main(["--labeled", labeled, "--augmented-dir", str(aug), "--out", str(out)]) == 0
    with open(out, encoding="utf-8", newline="") as handle:
        assert list(csv.DictReader(handle)) == []
