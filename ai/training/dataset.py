"""Dataset loading + preprocessing for fine-tuning.

Expects labeled data under ``config.dataset_path`` as CSV or JSONL files with a
text column and a label column. Labels may be either the integer ids (0/1/2) or
the string names in ``LABEL2ID``. Every row is run through the shared
``preprocess`` pipeline so training text matches inference exactly.
"""

from __future__ import annotations

import glob
import os
from typing import List, Tuple

from preprocessing import preprocess

from .config import LABEL2ID, TrainingConfig


def _read_files(path: str) -> "pd.DataFrame":
    import pandas as pd

    files = sorted(
        glob.glob(os.path.join(path, "*.csv"))
        + glob.glob(os.path.join(path, "*.jsonl"))
        + glob.glob(os.path.join(path, "*.json"))
    )
    if not files:
        raise FileNotFoundError(
            f"No .csv/.json/.jsonl files found in '{path}'. "
            "Add labeled data before training (see ai/README.md)."
        )
    frames = []
    for f in files:
        if f.endswith(".csv"):
            frames.append(pd.read_csv(f))
        else:
            frames.append(pd.read_json(f, lines=f.endswith(".jsonl")))
    return pd.concat(frames, ignore_index=True)


def _coerce_label(value) -> int:
    if isinstance(value, str) and value in LABEL2ID:
        return LABEL2ID[value]
    ivalue = int(value)
    if ivalue not in (0, 1, 2):
        raise ValueError(f"Label out of range: {value!r}")
    return ivalue


def load_split(config: TrainingConfig) -> Tuple[List[str], List[str], List[int], List[int]]:
    """Return ``(train_texts, val_texts, train_labels, val_labels)``.

    Text is preprocessed (NFKC + PII masking); the split is stratified 80/20.
    """
    from sklearn.model_selection import train_test_split

    df = _read_files(config.dataset_path)
    if config.text_column not in df or config.label_column not in df:
        raise KeyError(
            f"Dataset must contain '{config.text_column}' and "
            f"'{config.label_column}' columns; got {list(df.columns)}."
        )

    texts = [preprocess(str(t)) for t in df[config.text_column].tolist()]
    labels = [_coerce_label(v) for v in df[config.label_column].tolist()]

    return train_test_split(
        texts,
        labels,
        test_size=config.test_size,
        random_state=config.seed,
        stratify=labels,
    )


def build_hf_datasets(config: TrainingConfig, tokenizer):
    """Build tokenized HuggingFace datasets for the Trainer."""
    from datasets import Dataset

    train_texts, val_texts, train_labels, val_labels = load_split(config)

    def _to_ds(texts, labels):
        ds = Dataset.from_dict({"text": texts, "label": labels})
        return ds.map(
            lambda b: tokenizer(
                b["text"], truncation=True, max_length=config.max_length
            ),
            batched=True,
        )

    return _to_ds(train_texts, train_labels), _to_ds(val_texts, val_labels)
