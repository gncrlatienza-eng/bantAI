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

import pandas as pd

from preprocessing import preprocess

from .config import ID2LABEL, LABEL2ID, ORIGIN_COLUMN, SYNTHETIC_ORIGINS, TrainingConfig

#: Conflicting texts quoted in the error before it is truncated. The full set
#: is always available on ``LabelConflictError.conflicts``.
_CONFLICT_REPORT_LIMIT = 20


class LabelConflictError(ValueError):
    """One masked text carries more than one label.

    Not a de-duplication detail: it means two sources or two annotators
    disagree about ground truth for the exact string the model is trained on.
    Resolving that by keeping whichever row was read first would manufacture a
    gold label nobody approved, so the load fails and an annotator adjudicates.

    ``conflicts`` maps masked text -> the sorted label names claimed for it, so
    the annotation-QA step can write a review file without parsing the message.
    """

    def __init__(self, conflicts: dict):
        self.conflicts = conflicts
        super().__init__(_format_conflict_report(conflicts))


def _format_conflict_report(conflicts: dict) -> str:
    # Texts are already masked by ``preprocess``, so quoting them here does not
    # leak PII into logs or CI output.
    lines = [
        f"{len(conflicts)} masked text(s) carry more than one label. PII masking collapses "
        "distinct raw messages onto a single model input, so these cannot be resolved by "
        "de-duplication -- adjudicate each one and correct the source files before training:"
    ]
    for text, labels in list(conflicts.items())[:_CONFLICT_REPORT_LIMIT]:
        lines.append(f"  {'/'.join(labels)}: {text!r}")
    if len(conflicts) > _CONFLICT_REPORT_LIMIT:
        lines.append(f"  ... and {len(conflicts) - _CONFLICT_REPORT_LIMIT} more")
    return "\n".join(lines)


def _read_files(path: str) -> pd.DataFrame:
    files = sorted(
        glob.glob(os.path.join(path, "*.csv"))
        + glob.glob(os.path.join(path, "*.jsonl"))
        + glob.glob(os.path.join(path, "*.json"))
    )
    # ``sample.csv`` is the hand-written format reference documented in
    # ai/README.md, not real data -- globbing the directory would silently
    # concatenate its 9 dummy rows into the training set.
    files = [f for f in files if not os.path.basename(f).startswith("sample")]
    if not files:
        raise FileNotFoundError(
            f"No .csv/.json/.jsonl files found in '{path}'. Add labeled data before training (see ai/README.md)."
        )
    frames = []
    for f in files:
        if f.endswith(".csv"):
            frames.append(pd.read_csv(f))
        else:
            frames.append(pd.read_json(f, lines=f.endswith(".jsonl")))
    return pd.concat(frames, ignore_index=True)


# Case-insensitive name -> id lookup (datasets vary: "Ham", "ham", "HAM").
_LABEL_LOOKUP = {name.lower(): idx for name, idx in LABEL2ID.items()}


def _coerce_label(value) -> int:
    if isinstance(value, str):
        key = value.strip().lower()
        if key in _LABEL_LOOKUP:
            return _LABEL_LOOKUP[key]
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
            f"Dataset must contain '{config.text_column}' and '{config.label_column}' columns; got {list(df.columns)}."
        )

    texts = [preprocess(str(t)) for t in df[config.text_column].tolist()]
    labels = [_coerce_label(v) for v in df[config.label_column].tolist()]
    origins = [str(o) for o in df[ORIGIN_COLUMN].tolist()] if ORIGIN_COLUMN in df else ["" for _ in texts]

    # Two different raw messages can collapse to the same model input once PII is
    # masked -- "...libre 1q2w3e7.ca" and "...libre 1q2w3e8.ca" both become
    # "...libre <URL>". The source CSV is de-duplicated on RAW text, so those
    # survive as separate rows and land on both sides of the split, letting the
    # model be scored on strings it memorised verbatim (measured at 13.7% of the
    # validation set, and 31.8% of validation Scams). De-duplicate on the masked
    # text instead, since that is what the model actually sees.
    # Rows that agree collapse to one. Rows that disagree are an annotation
    # defect and stop the run -- see LabelConflictError.
    deduped: dict = {}
    conflicting: dict = {}
    for text, label, origin in zip(texts, labels, origins):
        seen = deduped.get(text)
        if seen is None:
            deduped[text] = (label, origin)
        elif seen[0] != label:
            conflicting.setdefault(text, {seen[0]}).add(label)
    if conflicting:
        raise LabelConflictError(
            {text: sorted(ID2LABEL[label] for label in found) for text, found in conflicting.items()}
        )

    real = [(t, lo[0]) for t, lo in deduped.items() if lo[1] not in SYNTHETIC_ORIGINS]
    synthetic = [(t, lo[0]) for t, lo in deduped.items() if lo[1] in SYNTHETIC_ORIGINS]

    # Synthetic rows train, never validate. A candidate trained on generated
    # text scores well on more generated text from the same templates, while
    # the incumbent it is measured against has never seen any -- so scoring
    # both on a split containing synthetic rows reports "learned our templates"
    # as "better at detecting scams". See SYNTHETIC_ORIGINS in training/config.
    train_texts, val_texts, train_labels, val_labels = train_test_split(
        [t for t, _ in real],
        [lab for _, lab in real],
        test_size=config.test_size,
        random_state=config.seed,
        stratify=[lab for _, lab in real],
    )
    if synthetic:
        train_texts = train_texts + [t for t, _ in synthetic]
        train_labels = train_labels + [lab for _, lab in synthetic]
    return train_texts, val_texts, train_labels, val_labels


def build_hf_datasets(config: TrainingConfig, tokenizer):
    """Build tokenized HuggingFace datasets for the Trainer."""
    from datasets import Dataset

    train_texts, val_texts, train_labels, val_labels = load_split(config)

    def _to_ds(texts, labels):
        ds = Dataset.from_dict({"text": texts, "label": labels})
        return ds.map(
            lambda b: tokenizer(b["text"], truncation=True, max_length=config.max_length),
            batched=True,
        )

    return _to_ds(train_texts, train_labels), _to_ds(val_texts, val_labels)
