# BantAI — AI/ML Pipeline (Track B)

Python ML pipeline for SMS smishing detection: **privacy masking → XLM-RoBERTa
classification → confidence-threshold routing**. Consumed by the NestJS backend
(`backend/src/ai`) over HTTP.

**For the full step-by-step pipeline** — every stage from raw data collection
through labeling, human review, training, evaluation, and deployment, plus the
complete bug-fix history and known limitations — see
[`PIPELINE.md`](PIPELINE.md). This README is a quickstart; that document is
the complete reference.

## Layout

| Path | What it is |
|---|---|
| `preprocessing/` | NFKC normalization + regex PII masking (URL/PHONE/OTP/AMOUNT) — shared by training and inference |
| `service/` | FastAPI inference service (`/health`, `/classify`) |
| `training/` | XLM-RoBERTa fine-tuning environment (config, SentencePiece tokenizer, dataset loader, train script) |
| `tests/` | pytest suite (masking, normalization, pipeline, service, training config) |
| `datasets/` | `raw/` → `processed/` → `labeled/` SMS data (raw/processed are git-ignored) |
| `models/` | Fine-tuned model output (git-ignored) |
| `notebooks/`, `evaluation/`, `scripts/` | Exploration, eval reports, helper scripts |

## Setup

```bash
cd ai
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

## Run the inference service

```bash
cd ai
uvicorn service.main:app --reload --port 8001
```

- `GET  /health`   → `{ "status": "ok", "model_ready": <bool> }`
- `POST /classify` → body `{ "message": "<sms text>" }`

Until a fine-tuned model exists in `models/`, `/classify` returns **503** (the
request is still validated and PII is still masked, so the contract is testable).

## Preprocessing / privacy masking

`preprocessing.preprocess(text)` is the single transform used at both train and
inference time:

1. **NFKC** normalization (folds full-width / look-alike Unicode) + whitespace collapse.
2. **Regex masking** → `<EMAIL>`, `<URL>`, `<PHONE>`, `<AMOUNT>`, `<OTP>` (applied
   in that order; tuned for Philippine phone/currency formats, incl. `₱5k`
   shorthand and `hxxp` de-fanged links).

```python
from preprocessing import preprocess

preprocess("Claim ₱5,000 at http://scam.ph code 483920")
# -> "Claim <AMOUNT> at <URL> code <OTP>"
```

## Train (fine-tune XLM-RoBERTa)

1. Put labeled data in `datasets/labeled/` as CSV/JSONL with `text,label`
   columns (`label` = `Ham` / `Spam` / `Scam`, any casing, or 0/1/2). A tiny
   `sample.csv` is included as a format reference, and
   [`LABELING_GUIDE.md`](datasets/LABELING_GUIDE.md) defines each class.
2. Run:

```bash
cd ai
python -m training.train
```

Saves the model + tokenizer to `models/xlm-roberta-smishing/`, which the service
then loads automatically. Model: `xlm-roberta-base` (SentencePiece, ~250K
multilingual vocab; covers Tagalog/English/Taglish). Optimizer: AdamW; 80/20
stratified split. A GPU is strongly recommended.

**No GPU locally?** Upload the `ai/` folder to a free
[Google Colab](https://colab.research.google.com) GPU runtime, `pip install -r
requirements.txt`, add your dataset to `datasets/labeled/`, and run the same
`python -m training.train`. Download the resulting `models/xlm-roberta-smishing/`
back into the repo (it is git-ignored) for the service to load.

## Labels & routing (Ham/Spam/Scam → 4 user buckets)

The model predicts **3 classes** — `Ham`, `Spam`, `Scam`. The app shows **4
buckets**; the fourth (`unknown`) is produced when the top class is below its
confidence threshold, so a weak guess is never hidden:

| Model predicts | If confident enough | Bucket | Where |
|---|---|---|---|
| Ham  | ≥ `SAFE_THRESHOLD` (0.50)  | `safe`    | Inbox |
| Spam | ≥ `SPAM_THRESHOLD` (0.60)  | `spam`    | Dropdown (hidden) |
| Scam | ≥ `BLOCK_THRESHOLD` (0.90) | `blocked` | Dropdown (hidden) |
| any  | below its threshold        | `unknown` | Inbox |

`POST /classify` returns the raw prediction (`label`, `score`, full `scores`
distribution) **and** the derived `bucket`, so the backend has everything for
both routing and analytics. Thresholds are env-configurable (`ai/.env.example`).

## Tests

```bash
cd ai
pytest            # preprocessing/service tests run with the base deps;
                  # training-config tests need scikit-learn/pandas
```

## Code Quality & Security

```bash
cd ai
ruff check .              # lint
ruff check . --fix        # auto-fix what's safe to auto-fix
ruff format .             # format
pip-audit -r requirements.txt   # dependency vulnerability scan
```

Config: `pyproject.toml` `[tool.ruff]`. Deliberately narrow rule set for now —
`select = ["E", "W", "F", "I"]` (correctness + import hygiene). Bugbear (`B`) and pyupgrade
(`UP`) both surfaced 300+ pre-existing findings when trialed, almost entirely cosmetic
(old-style `Optional[X]` typing, `%`-string formatting) — left as a documented follow-up
rather than one large auto-fixed commit. `colab/` is excluded (its `%cd`-before-imports
pattern is a legitimate Colab convention, not a violation).

## Roadmap (per sprint backlog)

- **Sprint 1 (done):** service scaffold, masking + NFKC draft, fine-tuning environment.
- **Sprint 2 (done):**
  - ✅ Completed masking pipeline (EMAIL/URL/PHONE/AMOUNT/OTP + edge cases).
  - ✅ Ham/Spam/Scam label scheme + softmax head wiring.
  - ✅ Threshold routing → Safe/Unknown/Spam/Blocked buckets in `/classify`.
  - ✅ Fine-tuned on the PH smishing dataset (Colab T4; see
    [`PIPELINE.md`](PIPELINE.md) for the full training/evaluation record and
    [`colab/README.md`](colab/README.md) to reproduce a run).
- **Sprint 3 (done):**
  - ✅ Cosine-similarity campaign matching, threshold 0.85 (`service/campaign.py`).
  - ✅ HDBSCAN offline re-clustering, `min_cluster_size = 5` (`scripts/cluster_campaigns.py`).
  - ✅ SHAP explainability + curated indicator tag dictionary, incl. Tagalog/Taglish
    coverage (`service/explainer.py`, `service/indicator_tags.py`).
  - ✅ Scam awareness tip lookup by cluster (`service/tips.py`).
- **Sprint 4 (Track B — 7/8 done):**
  - ✅ Retraining trigger thresholds — sample count, macro-F1 floor, Page-Hinkley
    drift (`retraining/triggers.py`).
  - ✅ Reservoir sampling, Vitter's Algorithm R (`retraining/sampling.py`).
  - ✅ McNemar test + F1-floor promotion gate (`retraining/promotion.py`).
  - ✅ TF-IDF thread summarization, `POST /summarize` (`service/summarize.py`).
  - ✅ Campaign evolution tracking — new/dissolved/growing/merged/split
    campaigns between clustering snapshots (`campaign_evolution.py`).
  - 🟡 **Automated retraining pipeline** — built and dry-run verified end-to-end
    (`retraining/snapshot.py`, `retraining/reports.py`, `retraining/pipeline.py`,
    `scripts/retrain.py`). Track A's `UserReports` table + intake endpoint
    (WBS 4.3.1) has since landed, but `reports.py` doesn't read from it yet —
    only `NullReportSource`/`FileReportSource` exist, `DatabaseReportSource` is
    the remaining piece. See [`RETRAINING.md`](RETRAINING.md). Also outstanding:
    a real GPU fine-tune (no local GPU; see `ai/colab/`).
