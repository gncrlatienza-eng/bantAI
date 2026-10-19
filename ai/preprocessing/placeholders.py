"""Canonical model spelling for privacy placeholders received from clients."""

from __future__ import annotations

import re

_BRACKET_PLACEHOLDERS = {f"[{name}]": f"<{name}>" for name in ("URL", "EMAIL", "PHONE", "AMOUNT", "OTP", "NUMBER")}
_BRACKET_RE = re.compile("|".join(re.escape(key) for key in _BRACKET_PLACEHOLDERS))


def normalize_placeholders(text: str) -> str:
    """Use training's angle brackets without guessing any redacted values.

    NUMBER stays distinct from OTP: a generic client redaction cannot tell us
    whether the original value was a code, phone number, or reference number.
    Only the exact uppercase wire tokens are rewritten; ordinary brackets and
    tokenizer special tokens are preserved.
    """
    return _BRACKET_RE.sub(lambda match: _BRACKET_PLACEHOLDERS[match.group(0)], text or "")
