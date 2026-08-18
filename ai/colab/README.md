# Colab GPU packages — Track B (AI/ML)

Two notebooks, for two different jobs, for when no local CUDA GPU is available.

| Notebook | What it does | WBS |
|---|---|---|
| `BantAI_Finetune_Colab.ipynb` | **Train from scratch** on the labeled dataset → a checkpoint | 2.3.4 |
| `BantAI_Retrain_Colab.ipynb` | **Retrain**: snapshot (dataset + validated reports) → fine-tune → promotion gate → `decision.json` | 4.3.5 |

Pick by what you want out of it. If you want a model, use the first. If you
want a *verdict on whether a new model is better than the deployed one*, use
the second — that comparison is the entire point of the retraining pipeline,
and the first notebook does not do it.

The retraining notebook needs the first one to have run at least once: the gate
compares against the currently deployed checkpoint, which it restores from
`MyDrive/bantai/bantai_model.zip`.

---

# 1. Fine-tuning from scratch — Sprint 2 · WBS 2.3.4

Everything needed to fine-tune XLM-RoBERTa on the labeled smishing dataset.

| File | What it is |
|---|---|
| `BantAI_Finetune_Colab.ipynb` | The notebook to run — open this in Colab |
| `bantai_colab_package.zip` | Code + dataset to upload when the notebook asks (0.8 MB) |

## Steps

1. Go to [colab.research.google.com](https://colab.research.google.com) →
   **File → Upload notebook** → pick `BantAI_Finetune_Colab.ipynb`.
2. **Runtime → Change runtime type → T4 GPU.**
3. Run the cells top to bottom. Cell 3 will prompt you to upload
   `bantai_colab_package.zip`.
4. When training finishes, the notebook saves the model to your Google Drive at
   `MyDrive/bantai/bantai_model.zip`.
5. Download that, and unzip it into the repo as
   `ai/models/xlm-roberta-smishing/`.

Expected runtime on a free T4: **~20-30 minutes** end to end.

## What the zip contains

`preprocessing/` and `training/` (source, no `__pycache__`), the labeled dataset
`datasets/labeled/bantai_labeled.csv` (16,772 rows: Ham 9,315 / Spam 4,788 /
Scam 2,669), and `requirements.txt`.

`sample.csv` is deliberately excluded — it is a hand-written format reference,
not real data, and the training loader now skips it (see
`training/dataset.py:_read_files`).

## Rebuilding the zip

If the dataset or training code changes, regenerate it rather than editing by
hand — the zip must not pick up `__pycache__` or `sample.csv`:

```bash
cd ai
python - <<'PY'
import os, zipfile
AI = os.getcwd()
out = os.path.join(AI, "colab", "bantai_colab_package.zip")
skip = lambda p: "__pycache__" in p.split("/") or p.endswith(".pyc")
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for tree in ("preprocessing", "training"):
        for dirpath, _, filenames in os.walk(os.path.join(AI, tree)):
            for fn in filenames:
                full = os.path.join(dirpath, fn)
                rel = os.path.relpath(full, AI).replace("\\", "/")
                if not skip(rel):
                    z.write(full, rel)
    z.write(os.path.join(AI, "datasets/labeled/bantai_labeled.csv"),
            "datasets/labeled/bantai_labeled.csv")
    z.write(os.path.join(AI, "requirements.txt"), "requirements.txt")
print("wrote", out)
PY
```

---

# 2. Retraining run — Sprint 4 · WBS 4.3.5

Runs the automated retraining pipeline end to end and records whether the
promotion gate accepts the result.

| File | What it is |
|---|---|
| `BantAI_Retrain_Colab.ipynb` | The notebook to run |
| `build_retrain_package.py` | Builds the upload zip |
| `bantai_retrain_package.zip` | The upload itself (0.9 MB) — **git-ignored, build it yourself** |

Both zips in this directory are git-ignored: they embed a full copy of the
labeled dataset, and the retraining one can also carry real reported SMS
bodies. Cloning the repo gets you the notebook and the builder, never the
package.

## Steps

1. **Export the validated reports** (skip only if you accept a run that
   consumes no corrections):

   ```bash
   cd ai
   python scripts/retrain.py --export-reports datasets/reports/validated.csv \
       --reports-url http://localhost:3000/api
   ```

   Needs the backend running and `BANTAI_AI_BACKEND_API_KEY` set to match its
   `INTERNAL_API_KEY`. Colab has no route to your laptop's `localhost:3000`,
   which is the only reason this hop exists.

2. **Build the package** — it picks up whatever is in `datasets/reports/`:

   ```bash
   cd ai && python colab/build_retrain_package.py
   ```

   It prints a loud note if no export was found, because the alternative is
   discovering it from a manifest reading "0 reports" after a 30-minute run.

3. Upload `BantAI_Retrain_Colab.ipynb` to Colab, **Runtime → Change runtime
   type → T4 GPU**, and run the cells top to bottom.

4. The notebook restores the baseline checkpoint from
   `MyDrive/bantai/bantai_model.zip` (written by the Sprint 2 notebook's step
   7), fine-tunes a candidate, scores both, and saves the whole run directory
   back to `MyDrive/bantai/retraining_runs/`.

5. Download it, unpack under `ai/models/retraining_runs/`, and commit
   `manifest.json` + `decision.json` — the weights stay git-ignored.

Expected runtime on a free T4: **~30-40 minutes** — longer than the Sprint 2
notebook because the gate scores *two* checkpoints over the validation split
after training.

## What the zip contains

`preprocessing/`, `training/`, `retraining/`, `scripts/retrain.py`, the labeled
dataset, `requirements.txt`, and `datasets/reports/*` when an export is present.

Deliberately **not** the other twenty files in `scripts/` — review sheets,
clustering and calibration tools that pull in sklearn/hdbscan/shap and have
nothing to do with a retraining run.

## Reading the result

`decision.json` holds every number the gate used, not just the outcome.

| Field | Means |
|---|---|
| `promote: true` | Candidate beat the incumbent on macro-F1 and cleared McNemar. **Not deployed** — promotion is a separate, deliberate step. |
| `promote: false` | Read `reason`. A rejection is a working gate, not a failed run. |
| `skipped_reason` set | No baseline was present, so nothing was compared. Re-run step 4 — this is the outcome most easily mistaken for success. |

If the gate says promote, re-run `scripts/embed_dataset.py` **and**
`scripts/cluster_campaigns.py` after the swap. Campaign centroids live in the
embedding space of the checkpoint that produced them and are meaningless
against a different one. See `ai/RETRAINING.md` § Rollback.
