"""End-to-end text preprocessing entry point.

The single ``preprocess`` function is the contract shared by the inference
service (``ai/service``) and the training data loader (``ai/training``) so that
a message is transformed identically at train time and at inference time.
"""

from __future__ import annotations

from .masking import mask_pii
from .normalization import normalize_text


def preprocess(text: str) -> str:
    """Normalize (NFKC + whitespace) then mask PII. Returns model-ready text."""
    return mask_pii(normalize_text(text))
