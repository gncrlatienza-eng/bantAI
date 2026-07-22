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
from typing import Optional, Tuple

from preprocessing import preprocess

from .config import settings
from .schemas import Label, Routing

LABELS: Tuple[Label, ...] = ("Likely Smishing", "Suspicious", "Unknown")


class ModelNotReadyError(RuntimeError):
    """Raised when classification is requested but no model is loaded."""


def route(score: float) -> Routing:
    """Map a confidence score to a routing decision (Sprint 2 contract)."""
    if score >= settings.auto_block_threshold:
        return "auto_block"
    if score >= settings.alert_threshold:
        return "alert"
    return "inbox"


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

    def classify(self, message: str) -> Tuple[Label, float, str]:
        """Return ``(label, score, masked_text)`` for a raw SMS body."""
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
        idx = int(torch.argmax(probs))
        # Prefer the label map baked into the model config when present.
        id2label = getattr(self._model.config, "id2label", None)
        label = (
            id2label[idx]
            if id2label and idx in id2label
            else LABELS[idx]
        )
        return label, float(probs[idx]), masked


# Module-level singleton reused across requests.
classifier: Optional[SmishingClassifier] = SmishingClassifier()
