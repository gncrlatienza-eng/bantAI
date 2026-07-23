"""Smishing classifier wrapper.

Loads a fine-tuned XLM-RoBERTa sequence-classification model from
``settings.model_dir`` and runs inference over PII-masked text. Torch and
Transformers are imported lazily so the service (and its ``/health`` endpoint)
starts even before any model or heavy dependency is present — which is the
state during Sprint 1, before training has produced weights.
"""

from __future__ import annotations

import os
from threading import Lock
from typing import Dict, Mapping, Optional, Tuple

from preprocessing import preprocess

from .config import settings
from .schemas import Bucket, Label

LABELS: Tuple[Label, ...] = ("Ham", "Spam", "Scam")


class ModelNotReadyError(RuntimeError):
    """Raised when classification is requested but no model is loaded."""


def route(scores: Mapping[Label, float]) -> Bucket:
    """Translate the full class distribution into a user-facing bucket.

    Runs the last three steps of the routing pipeline (softmax already happened
    upstream in ``classify``):

        1. **argmax**    — pick the winning class.
        2. **gap check** — if the winner leads the runner-up by less than
           ``review_margin``, the model is torn (e.g. 0.50/0.50/0.00); route to
           "unknown" no matter what the thresholds say.
        3. **threshold** — the winner must also clear its own confidence bar.

    Anything that fails the gap or threshold check falls back to "unknown", so
    the message stays visible in the inbox instead of being acted on from a weak
    or ambiguous guess. Mapping when confident enough:

        Ham  -> safe     (inbox)
        Spam -> spam     (dropdown)
        Scam -> blocked  (dropdown)
    """
    # argmax: winning class and its confidence.
    label = max(scores, key=lambda k: scores[k])
    top = scores[label]

    # Runner-up probability, for the "too close to call" gap check.
    ordered = sorted(scores.values(), reverse=True)
    second = ordered[1] if len(ordered) > 1 else 0.0
    if top - second < settings.review_margin:
        return "unknown"

    if label == "Scam" and top >= settings.block_threshold:
        return "blocked"
    if label == "Spam" and top >= settings.spam_threshold:
        return "spam"
    if label == "Ham" and top >= settings.safe_threshold:
        return "safe"
    return "unknown"


class SmishingClassifier:
    """Thread-safe, lazily initialized classifier."""

    def __init__(self, model_dir: str = settings.model_dir) -> None:
        self.model_dir = model_dir
        self._model = None
        self._tokenizer = None
        self._lock = Lock()

    def _has_weights(self) -> bool:
        return os.path.isdir(self.model_dir) and os.path.isfile(
            os.path.join(self.model_dir, "config.json")
        )

    def _ensure_loaded(self) -> None:
        if self._model is not None:
            return
        if not self._has_weights():
            raise ModelNotReadyError(
                f"No fine-tuned model at '{self.model_dir}'. "
                "Run ai/training/train.py first (Sprint 2)."
            )
        with self._lock:
            if self._model is not None:  # re-check inside the lock
                return
            # Imported here so the service starts without torch installed.
            import torch  # noqa: F401
            from transformers import (
                AutoModelForSequenceClassification,
                AutoTokenizer,
            )

            self._tokenizer = AutoTokenizer.from_pretrained(self.model_dir)
            self._model = AutoModelForSequenceClassification.from_pretrained(
                self.model_dir
            )
            self._model.eval()

    def is_ready(self) -> bool:
        return self._model is not None or self._has_weights()

    def _label_for(self, idx: int) -> Label:
        # Prefer the label map baked into the model config when present.
        id2label = getattr(self._model.config, "id2label", None)
        if id2label and idx in id2label:
            return id2label[idx]
        return LABELS[idx]

    def classify(self, message: str) -> Tuple[Label, float, Dict[Label, float], str]:
        """Return ``(label, score, scores, masked_text)`` for a raw SMS body.

        ``scores`` is the full softmax distribution over Ham/Spam/Scam; ``score``
        is the confidence of the winning ``label``.
        """
        masked = preprocess(message)
        self._ensure_loaded()

        import torch

        inputs = self._tokenizer(
            masked,
            truncation=True,
            max_length=settings.max_length,
            return_tensors="pt",
        )
        with torch.no_grad():
            logits = self._model(**inputs).logits
        probs = torch.softmax(logits, dim=-1)[0]
        scores = {self._label_for(i): float(probs[i]) for i in range(len(probs))}
        idx = int(torch.argmax(probs))
        label = self._label_for(idx)
        return label, float(probs[idx]), scores, masked


# Module-level singleton reused across requests.
classifier: Optional[SmishingClassifier] = SmishingClassifier()
