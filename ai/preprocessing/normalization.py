"""Unicode normalization for incoming SMS text.

Smishing messages frequently abuse Unicode look-alikes and full-width
characters to slip past naive keyword filters (e.g. ``ＧＣａｓｈ`` instead of
``GCash``). Normalizing to NFKC folds these compatibility characters back to
their canonical form before any masking or tokenization happens.
"""

from __future__ import annotations

import re
import unicodedata

# Any run of Unicode whitespace (spaces, tabs, newlines, non-breaking spaces
# once NFKC has folded them) collapses to a single ASCII space.
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_text(text: str) -> str:
    """Return ``text`` in NFKC form with collapsed, trimmed whitespace.

    Casing is intentionally preserved: XLM-RoBERTa is a cased model and
    all-caps segments ("CONGRATULATIONS!") are a useful smishing signal.
    """
    if not text:
        return ""
    # NFKC: fold compatibility variants (full-width, ligatures, circled digits…)
    text = unicodedata.normalize("NFKC", text)
    text = _WHITESPACE_RE.sub(" ", text)
    return text.strip()
