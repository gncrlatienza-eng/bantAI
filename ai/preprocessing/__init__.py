"""Text preprocessing for the BantAI ML pipeline.

Public API:
    preprocess(text)      -> NFKC-normalized, PII-masked text (train == infer)
    normalize_text(text)  -> NFKC + whitespace normalization only
    mask_pii(text)        -> regex masking only (URL/PHONE/AMOUNT/OTP)
    mask_counts(text)     -> per-category PII counts
"""

from .masking import mask_counts, mask_pii
from .normalization import normalize_text
from .pipeline import preprocess

__all__ = ["preprocess", "normalize_text", "mask_pii", "mask_counts"]
