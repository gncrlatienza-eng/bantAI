"""Build the Colab *fine-tune* package (Sprint 2, WBS 2.3.4).

    cd ai && python colab/build_colab_package.py
    cd ai && python colab/build_colab_package.py --variant A
    cd ai && python colab/build_colab_package.py --variant B --no-synthetic

Writes ``colab/bantai_colab_package.zip`` (or ``..._<variant>.zip``), the upload
for ``BantAI_Finetune_Colab.ipynb``.

Previously this lived as a copy-paste snippet in ``colab/README.md``, which is
how it went stale: the zip shipped to Colab on 2026-09-20 still carried the
2026-08-26 dataset, three weeks after 106 institutional messages were
relabelled. A stale package is the single most likely way to get a training run
whose results do not correspond to the data in the repository, so the build is a
script that anyone can re-run rather than a snippet someone has to remember.

**Variants** (2026-09-21) exist so two training runs can be compared fairly in
one sitting -- e.g. with and without the synthetic scam rows. The variant name
is written into the zip as ``VARIANT.txt``; the notebook reads it and saves the
trained model under a name that includes it, so two runs on the same day can
never overwrite each other on Drive. ``--no-synthetic`` drops every row whose
``origin`` is synthetic. Validation is unaffected either way: synthetic rows
only ever go to the training half (``training/dataset.py``), so both variants
are scored on exactly the same validation messages.

Companion to ``build_retrain_package.py``, which packages the *retraining*
pipeline (snapshot assembly + promotion gate) rather than a fine-tune from
scratch.
"""

from __future__ import annotations

import argparse
import collections
import csv
import io
import json
import os
import sys
import zipfile

AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, AI)

from training.config import ORIGIN_COLUMN, OVERRIDES_FILE, SYNTHETIC_ORIGINS  # noqa: E402

#: Source trees the notebook imports. ``retraining`` is deliberately absent --
#: this package fine-tunes from scratch and never touches the promotion gate.
TREES = ("preprocessing", "training")

#: The labeled corpus, and the pins so Colab installs what the repo expects.
FILES = ("requirements.txt",)
DATASET = "datasets/labeled/bantai_labeled.csv"


def skip(rel: str) -> bool:
    """Exclusions, each for a reason.

    ``__pycache__``/``.pyc`` -- bytecode from another Python; noise at best.
    ``sample.csv``           -- a hand-written format reference, not real data;
                                ``training/dataset.py`` already ignores it, but
                                shipping it invites confusion about row counts.
    """
    parts = rel.split("/")
    return "__pycache__" in parts or rel.endswith(".pyc") or parts[-1].startswith("sample")


def dataset_bytes(no_synthetic: bool) -> bytes:
    """The corpus as it goes into the zip -- the file itself, or a filtered copy."""
    path = os.path.join(AI, *DATASET.split("/"))
    if not no_synthetic:
        with open(path, "rb") as handle:
            return handle.read()
    with open(path, encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        fields = reader.fieldnames
        rows = [r for r in reader if (r.get(ORIGIN_COLUMN) or "") not in SYNTHETIC_ORIGINS]
    out = io.StringIO(newline="")
    writer = csv.DictWriter(out, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
    return out.getvalue().encode("utf-8")


def output_path(variant: str | None) -> str:
    name = f"bantai_colab_package_{variant}.zip" if variant else "bantai_colab_package.zip"
    return os.path.join(AI, "colab", name)


def build(variant: str | None = None, no_synthetic: bool = False, class_weight_power: float | None = None) -> str:
    out = output_path(variant)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for tree in TREES:
            for dirpath, _, filenames in os.walk(os.path.join(AI, tree)):
                for name in filenames:
                    full = os.path.join(dirpath, name)
                    rel = os.path.relpath(full, AI).replace(os.sep, "/")
                    if not skip(rel):
                        z.write(full, rel)
        z.writestr(DATASET, dataset_bytes(no_synthetic))
        for rel in FILES:
            z.write(os.path.join(AI, rel), rel)
        if class_weight_power is not None:
            # training/train.py reads this from the working directory, so the
            # zip alone decides how the run trains.
            z.writestr(OVERRIDES_FILE, json.dumps({"class_weight_power": class_weight_power}) + "\n")
        if variant:
            note = "without synthetic rows" if no_synthetic else "with synthetic rows"
            if class_weight_power is not None:
                note += f", class_weight_power={class_weight_power}"
            z.writestr("VARIANT.txt", f"{variant}\n{note}\n")
    return out


def describe(path: str) -> None:
    """Print what went in, so a stale or wrong-sized package is obvious."""
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        with z.open(DATASET) as handle:
            rows = list(csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8")))
        variant = z.read("VARIANT.txt").decode().strip().replace("\n", " -- ") if "VARIANT.txt" in names else "(none)"
        settings = z.read(OVERRIDES_FILE).decode().strip() if OVERRIDES_FILE in names else "(defaults)"

    synthetic = sum(1 for r in rows if (r.get(ORIGIN_COLUMN) or "") in SYNTHETIC_ORIGINS)
    print(f"wrote {path} ({os.path.getsize(path) / 1024 / 1024:.2f} MB, {len(names)} files)")
    print(f"  variant: {variant}")
    print(f"  training settings: {settings}")
    print(f"  dataset: {len(rows)} rows {dict(collections.Counter(r['label'] for r in rows))}, synthetic {synthetic}")
    # The holdout is the final test set; a training package must never carry it.
    assert not any("holdout" in n for n in names), "holdout set must not be in the training package"
    print("  holdout excluded: yes")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--variant", help="short name, e.g. A or B; goes into the zip and the saved model's name")
    parser.add_argument("--no-synthetic", action="store_true", help="leave out every synthetic (generated) row")
    parser.add_argument(
        "--class-weight-power",
        type=float,
        help="class-weight strength for this run (1.0 default, 0.5 softer); see TrainingConfig",
    )
    args = parser.parse_args()
    describe(build(args.variant, args.no_synthetic, args.class_weight_power))
