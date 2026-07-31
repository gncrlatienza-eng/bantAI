# Colab fine-tuning package — Sprint 2 · Track B · WBS 2.3.4

Everything needed to fine-tune XLM-RoBERTa on the labeled smishing dataset using
a free Google Colab GPU, for when no local CUDA GPU is available.

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
