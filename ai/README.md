# BantAI — AI/ML Pipeline (Track B)

Python ML pipeline for SMS smishing detection: **privacy masking → XLM-RoBERTa
classification → confidence-threshold routing**. Consumed by the NestJS backend
(`backend/src/ai`) over HTTP.

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
2. **Regex masking** → `<URL>`, `<PHONE>`, `<OTP>`, `<AMOUNT>` (applied in that
   order; tuned for Philippine phone/currency formats).

```python
from preprocessing import preprocess
preprocess("Claim ₱5,000 at http://scam.ph code 483920")
# -> "Claim <AMOUNT> at <URL> code <OTP>"
```

## Train (fine-tune XLM-RoBERTa)

1. Put labeled data in `datasets/labeled/` as CSV/JSONL with `text,label`
   columns (`label` = `Likely Smishing` / `Suspicious` / `Unknown`, or 0/1/2).
   A tiny `sample.csv` is included as a format reference.
2. Run:

```bash
cd ai
python -m training.train
```

Saves the model + tokenizer to `models/xlm-roberta-smishing/`, which the service
then loads automatically. Model: `xlm-roberta-base` (SentencePiece, ~250K
multilingual vocab; covers Tagalog/English/Taglish). Optimizer: AdamW; 80/20
stratified split. A GPU is strongly recommended.

## Tests

```bash
cd ai
pytest            # preprocessing/service tests run with the base deps;
                  # training-config tests need scikit-learn/pandas
```

## Roadmap (per sprint backlog)

- **Sprint 1 (done):** service scaffold, masking + NFKC draft, fine-tuning environment.
- **Sprint 2:** complete masking pipeline, fine-tune on the PH smishing dataset,
  softmax head, wire threshold routing into `/classify`.
- **Sprint 3+:** cosine-similarity campaign clustering, HDBSCAN, SHAP
  explainability, retraining workflow, TF-IDF summarization.
