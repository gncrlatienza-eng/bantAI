"""SHAP token-level attribution -> indicator tags (Sprint 3, WBS 3.3.6).

Manuscript Stage 6: "SHAP computes a Shapley value for every token in the
message, indicating how much each token contributed to the predicted class.
Top contributing tokens are mapped through a curated dictionary into human
readable indicator tags."

This module is the *integration*; the curated dictionary itself is
``service/indicator_tags.py`` (WBS 3.1.2).

**Why this runs asynchronously.** True SHAP on a transformer needs hundreds of
masked forward passes per message -- seconds, not milliseconds, on CPU. Running
it inline would make ``POST /classify`` unusably slow and break the
manuscript's real-time interception requirement. Instead classification returns
immediately, and explanation is computed after the fact and attached via the
backend's existing ``POST /sms/:messageId/indicators`` endpoint -- which is
precisely why that endpoint exists as a separate call rather than being folded
into the ingest response. The user sees the verdict instantly and the "why"
resolves a moment later.

**Graceful degradation.** ``shap`` is an optional dependency. When it is not
installed (or fails on a given input), this falls back to the deterministic
keyword/structural tagger in ``indicator_tags``. Same tag vocabulary either
way, so the contract with the backend and mobile app never changes -- only the
precision of the weights. ``method`` on the result says which path produced it,
so a reader can always tell a real Shapley value from a keyword heuristic.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Dict, List, Optional, Sequence

from .indicator_tags import (
    TAG_KEYWORDS,
    IndicatorTag,
    tags_for_message,
    to_indicator_dicts,
)

#: How many top-contributing tokens to consider. The manuscript speaks of "top
#: contributing tokens" without fixing a number; 10 comfortably covers the
#: handful of tokens that carry a short SMS.
TOP_K_TOKENS = 10

#: Tokens below this absolute Shapley value are noise, not signal.
MIN_ABS_SHAP = 0.01


@dataclass
class Explanation:
    """Indicator tags for one message, plus provenance."""

    tags: List[IndicatorTag]
    method: str  # "shap" | "keyword-fallback"
    top_tokens: List[tuple]  # [(token, shap_value), ...] -- empty for fallback

    def to_indicator_payload(self) -> List[dict]:
        """Body for ``POST /sms/:messageId/indicators``."""
        return to_indicator_dicts(self.tags)


def _clean_token(token: str) -> str:
    """Strip SentencePiece word-boundary markers and punctuation."""
    return token.replace("▁", "").strip().strip(".,!?:;()[]\"'").lower()


def _keyword_words(keyword: str) -> List[str]:
    """Split a keyword phrase into comparable words.

    Splits on any non-alphanumeric character so hyphenated and possessive
    forms ("mag-ingat", "you've won") yield their component words.
    """
    return [w for w in re.split(r"[^a-z0-9]+", keyword.lower()) if w]


def _matches_keyword(token: str, keyword: str) -> bool:
    """Does a token genuinely correspond to this keyword?

    Whole-word comparison rather than substring: a substring test lets any
    short token match unrelated phrases (see ``_tokens_to_tags``). A token
    counts as matching when it is one of the keyword's words, or -- for longer
    tokens, since SentencePiece splits mid-word -- when it is a prefix of one
    of them ("gambl" for "gambling").
    """
    words = _keyword_words(keyword)
    if token in words:
        return True
    return len(token) >= 5 and any(w.startswith(token) for w in words)


def _tokens_to_tags(scored_tokens: Sequence[tuple]) -> List[IndicatorTag]:
    """Map (token, shap_value) pairs onto indicator tags.

    A tag's weight is the summed positive Shapley mass of the tokens that
    matched its keyword vocabulary -- i.e. "how much of this prediction did
    this indicator actually account for", which is the quantity the manuscript
    describes and is more meaningful to a user than a raw per-token number.
    """
    totals: Dict[str, float] = {}

    for raw_token, value in scored_tokens:
        token = _clean_token(raw_token)
        # Short tokens match far too many keywords to attribute meaningfully.
        # Verified 2026-07-30: at length 3, the Tagalog prefix "mag" matched
        # the keyword "mag-ingat" and mislabeled a gambling blast as "Urgency
        # Cue". Tagalog is heavily agglutinative, so short prefixes ("mag",
        # "nag", "pag", "ka") appear inside unrelated keywords constantly.
        if len(token) < 4 or value <= 0:
            continue
        for tag, keywords in TAG_KEYWORDS.items():
            if any(_matches_keyword(token, kw) for kw in keywords):
                totals[tag] = totals.get(tag, 0.0) + float(value)

    if not totals:
        return []

    # Normalize so the strongest indicator reads as ~1.0 -- absolute Shapley
    # magnitudes vary with message length and are not comparable across
    # messages, but their relative ordering is exactly what we want to show.
    peak = max(totals.values())
    return sorted(
        (
            IndicatorTag(tag=tag, weight=round(min(total / peak, 1.0), 4))
            for tag, total in totals.items()
        ),
        key=lambda t: t.weight,
        reverse=True,
    )


def shap_available() -> bool:
    try:
        import shap  # noqa: F401

        return True
    except ImportError:
        return False


def explain(
    raw_text: str,
    masked_text: Optional[str] = None,
    model=None,
    tokenizer=None,
    *,
    predicted_label: Optional[str] = None,
) -> Explanation:
    """Explain one classification as indicator tags.

    Uses real SHAP when the library and a loaded model are both available,
    otherwise the keyword tagger. Never raises on explanation failure -- an
    unexplained message must still classify, so any SHAP error degrades to the
    fallback rather than propagating.
    """
    if model is not None and tokenizer is not None and shap_available():
        try:
            return _explain_with_shap(
                raw_text, masked_text or raw_text, model, tokenizer, predicted_label
            )
        except Exception:  # noqa: BLE001 -- explanation must never break classify
            pass

    return Explanation(
        tags=tags_for_message(raw_text, masked_text),
        method="keyword-fallback",
        top_tokens=[],
    )


def _explain_with_shap(
    raw_text: str,
    masked_text: str,
    model,
    tokenizer,
    predicted_label: Optional[str],
) -> Explanation:
    """Real Shapley values via shap's Partition explainer over a HF pipeline."""
    import numpy as np
    import shap
    from transformers import pipeline

    pipe = pipeline(
        "text-classification",
        model=model,
        tokenizer=tokenizer,
        top_k=None,
        truncation=True,
    )
    explainer = shap.Explainer(pipe)
    shap_values = explainer([masked_text])

    # Pick the output column for the predicted class; default to the
    # highest-scoring one when no label was supplied.
    output_names = list(getattr(shap_values, "output_names", []) or [])
    col = 0
    if predicted_label and predicted_label in output_names:
        col = output_names.index(predicted_label)
    elif output_names:
        col = int(np.argmax(shap_values.values[0].sum(axis=0)))

    tokens = list(shap_values.data[0])
    values = shap_values.values[0][:, col]

    scored = [
        (tok, float(val))
        for tok, val in zip(tokens, values)
        if abs(float(val)) >= MIN_ABS_SHAP
    ]
    scored.sort(key=lambda p: abs(p[1]), reverse=True)
    top = scored[:TOP_K_TOKENS]

    tags = _tokens_to_tags(top)
    if not tags:
        # SHAP ran but nothing mapped to a known indicator (e.g. the decisive
        # tokens are outside the curated vocabulary). Structural signals -- a
        # suspicious URL or impersonated brand -- are still worth reporting.
        tags = tags_for_message(raw_text, masked_text)
        if not tags:
            return Explanation(tags=[], method="shap", top_tokens=top)

    return Explanation(tags=tags, method="shap", top_tokens=top)
