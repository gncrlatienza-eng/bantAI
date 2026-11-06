"""Build the Colab *retraining* package (Sprint 4, WBS 4.3.5).

    cd ai && python colab/build_retrain_package.py

Writes ``colab/bantai_retrain_package.zip``, the upload for
``BantAI_Retrain_Colab.ipynb``.

Not the same package as the Sprint 2 one described in ``colab/README.md``.
That zip trains a model from scratch on the labeled dataset; this one carries
the whole retraining pipeline -- snapshot assembly, the fine-tune, the
promotion gate -- so the notebook runs ``scripts/retrain.py`` rather than
``training/train.py``, and produces a ``decision.json`` instead of just a
checkpoint.

A script rather than a README snippet (which is how the Sprint 2 zip is
rebuilt) because this one has more moving parts: five source trees, an
optional report export, and two exclusions that are easy to get wrong by hand.

Regenerate it whenever the dataset, the training code, or anything under
``retraining/`` changes. A stale zip is the single most likely way to get a
retraining run whose results do not correspond to the code in the repo.
"""

from __future__ import annotations

import os
import sys
import zipfile

AI = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(AI, "colab", "bantai_retrain_package.zip")

#: Source trees the pipeline imports. ``retraining`` is the addition over the
#: Sprint 2 package -- without it there is no snapshot assembly and no
#: promotion gate, only a bare fine-tune.
TREES = ("preprocessing", "training", "retraining")

#: Single files that are not part of a tree. Only ``retrain.py`` from
#: ``scripts/`` -- the other twenty are review sheets, clustering and
#: calibration tools that pull in sklearn/hdbscan/shap and have nothing to do
#: with a retraining run.
FILES = ("requirements.txt", "scripts/retrain.py")

#: Datasets. ``datasets/reports/`` is included when it holds an export, so a
#: run can consume real corrections; Colab has no route to a laptop's
#: ``localhost:3000``, which is what ``retrain.py --export-reports`` exists to
#: bridge.
DATASETS = ("datasets/labeled/bantai_labeled.csv",)
REPORTS_DIR = "datasets/reports"


def _skip(rel: str) -> bool:
    """Exclusions, each for a specific reason.

    ``__pycache__``/``.pyc``  -- bytecode from a different Python; noise at best.
    ``sample.csv``            -- a hand-written format reference, not real data.
                                 ``training/dataset.py:_read_files`` already
                                 skips it, but shipping it invites confusion
                                 about the row count.
    ``README.md``             -- the reports directory's docs, not its data.
    """
    parts = rel.split("/")
    if "__pycache__" in parts or rel.endswith(".pyc"):
        return True
    return os.path.basename(rel) in {"sample.csv", "README.md"}


def build(out: str = OUT) -> str:
    written = []
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as archive:
        for tree in TREES:
            for dirpath, _, filenames in os.walk(os.path.join(AI, tree)):
                for name in sorted(filenames):
                    full = os.path.join(dirpath, name)
                    rel = os.path.relpath(full, AI).replace("\\", "/")
                    if not _skip(rel):
                        archive.write(full, rel)
                        written.append(rel)

        for rel in FILES + DATASETS:
            full = os.path.join(AI, rel)
            if not os.path.isfile(full):
                raise SystemExit(f"error: {rel} is missing -- cannot build a usable package without it.")
            archive.write(full, rel)
            written.append(rel)

        reports_root = os.path.join(AI, REPORTS_DIR)
        exported = []
        if os.path.isdir(reports_root):
            for name in sorted(os.listdir(reports_root)):
                full = os.path.join(reports_root, name)
                rel = f"{REPORTS_DIR}/{name}"
                if os.path.isfile(full) and not _skip(rel):
                    archive.write(full, rel)
                    exported.append(name)
                    written.append(rel)

    size_mb = os.path.getsize(out) / 1e6
    print(f"wrote {out} ({size_mb:.1f} MB, {len(written)} files)")
    if exported:
        print(f"  reports included: {', '.join(exported)}")
    else:
        # Loud, because the alternative is discovering it from a manifest that
        # says "0 reports" after a 30-minute GPU run.
        print(
            f"  NOTE: no report export found in {REPORTS_DIR}/ -- the run will consume\n"
            "        zero corrections. To include them:\n"
            "          python scripts/retrain.py --export-reports datasets/reports/validated.csv\n"
            "        then re-run this script."
        )
    return out


if __name__ == "__main__":
    sys.exit(0 if build() else 1)
