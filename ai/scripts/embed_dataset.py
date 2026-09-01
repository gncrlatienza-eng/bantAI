"""Embed the whole labeled dataset once, for offline campaign clustering.

Sprint 3 Track B (WBS 3.3.5 prerequisite).

Produces the 768-dim [CLS] embedding for every row of
``datasets/labeled/bantai_labeled.csv`` using the *installed fine-tuned model*
(the same one the classifier serves), and caches them to
``datasets/processed/embeddings.npz`` so HDBSCAN experiments can be re-run in
seconds instead of re-embedding each time.

IMPORTANT: embeddings are only comparable to each other when produced by the
same model checkpoint. Re-run this after any retrain -- a new checkpoint moves
the whole semantic space, so old embeddings and old cluster centroids become
meaningless against new ones. The output records the model directory and row
count so a stale cache is detectable.

Run:  cd ai && python scripts/embed_dataset.py
"""

from __future__ import annotations

import csv
import os
import sys
import time

sys.path.insert(0, ".")

import numpy as np
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from service.config import settings
from service.embeddings import embed_texts

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.normpath(os.path.join(HERE, ".."))
LABELED = os.path.join(AI, "datasets", "labeled", "bantai_labeled.csv")
OUT_DIR = os.path.join(AI, "datasets", "processed")
OUT = os.path.join(OUT_DIR, "embeddings.npz")

csv.field_size_limit(min(sys.maxsize, 2**31 - 1))


def main() -> None:
    if not os.path.isdir(settings.model_dir):
        raise SystemExit(f"No model at '{settings.model_dir}'. Train first (see colab/README.md).")

    with open(LABELED, encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    print(f"Loaded {len(rows)} rows from {os.path.relpath(LABELED, AI)}", flush=True)

    texts = [r["text"] for r in rows]
    labels = [r["label"] for r in rows]
    senders = [r.get("sender", "") for r in rows]

    print(f"Loading model from {settings.model_dir} ...", flush=True)
    tokenizer = AutoTokenizer.from_pretrained(settings.model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(settings.model_dir)

    print(f"Embedding {len(texts)} messages (CPU, this is the slow part) ...", flush=True)
    start = time.time()

    # Chunked so progress is visible on a long CPU run rather than silent.
    CHUNK = 512
    parts = []
    for i in range(0, len(texts), CHUNK):
        parts.append(embed_texts(texts[i : i + CHUNK], model, tokenizer, batch_size=32))
        done = min(i + CHUNK, len(texts))
        elapsed = time.time() - start
        rate = done / elapsed if elapsed else 0
        remaining = (len(texts) - done) / rate if rate else 0
        print(
            f"  {done}/{len(texts)}  ({100 * done / len(texts):.1f}%)  "
            f"{rate:.1f} msg/s  ~{remaining / 60:.1f} min left",
            flush=True,
        )

    embeddings = np.vstack(parts)
    os.makedirs(OUT_DIR, exist_ok=True)
    np.savez_compressed(
        OUT,
        embeddings=embeddings,
        labels=np.array(labels),
        senders=np.array(senders),
        texts=np.array(texts, dtype=object),
        model_dir=np.array(settings.model_dir),
    )

    total = time.time() - start
    print(f"\nDone in {total / 60:.1f} min. Shape {embeddings.shape}", flush=True)
    print(f"Wrote {os.path.relpath(OUT, AI)}", flush=True)


if __name__ == "__main__":
    main()
