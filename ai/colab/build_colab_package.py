"""Build the Colab *fine-tune* package (Sprint 2, WBS 2.3.4).

    cd ai && python colab/build_colab_package.py

Writes ``colab/bantai_colab_package.zip``, the upload for
``BantAI_Finetune_Colab.ipynb``.

Previously this lived as a copy-paste snippet in ``colab/README.md``, which is
how it went stale: the zip shipped to Colab on 2026-09-20 still carried the
2026-08-26 dataset, three weeks after 106 institutional messages were
relabelled. A stale package is the single most likely way to get a training run
whose results do not correspond to the data in the repository, so the build is a
script that anyone can re-run rather than a snippet someone has to remember.

Companion to ``build_retrain_package.py``, which packages the *retraining*
pipeline (snapshot assembly + promotion gate) rather than a fine-tune from
scratch.
"""

from __future__ import annotations

import collections
import csv
import io
import os
import zipfile

AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(AI, "colab", "bantai_colab_package.zip")

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


def build() -> str:
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for tree in TREES:
            for dirpath, _, filenames in os.walk(os.path.join(AI, tree)):
                for name in filenames:
                    full = os.path.join(dirpath, name)
                    rel = os.path.relpath(full, AI).replace(os.sep, "/")
                    if not skip(rel):
                        z.write(full, rel)
        z.write(os.path.join(AI, *DATASET.split("/")), DATASET)
        for rel in FILES:
            z.write(os.path.join(AI, rel), rel)
    return OUT


def describe(path: str) -> None:
    """Print what went in, so a stale or wrong-sized package is obvious."""
    with zipfile.ZipFile(path) as z:
        names = z.namelist()
        with z.open(DATASET) as handle:
            rows = list(csv.DictReader(io.TextIOWrapper(handle, encoding="utf-8")))

    print(f"wrote {path} ({os.path.getsize(path) / 1024 / 1024:.2f} MB, {len(names)} files)")
    print(f"  dataset: {len(rows)} rows {dict(collections.Counter(r['label'] for r in rows))}")
    # The holdout is the final test set; a training package must never carry it.
    assert not any("holdout" in n for n in names), "holdout set must not be in the training package"
    print("  holdout excluded: yes")


if __name__ == "__main__":
    describe(build())
