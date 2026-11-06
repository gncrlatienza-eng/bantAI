"""End-to-end text preprocessing entry point.

The single ``preprocess`` function is the contract shared by the inference
service (``ai/service``) and the training data loader (``ai/training``) so that
a message is transformed identically at train time and at inference time.
"""

from __future__ import annotations

from .masking import mask_pii
from .normalization import normalize_text
from .placeholders import normalize_placeholders


def preprocess(text: str) -> str:
    """Normalize text and client placeholders, then mask remaining PII.

    The phone/backend send square-bracket redactions. Training masks raw text
    with angle brackets, so canonicalize before tokenization in both paths.
    """
    return mask_pii(normalize_placeholders(normalize_text(text)))
