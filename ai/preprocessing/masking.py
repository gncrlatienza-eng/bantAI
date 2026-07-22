"""Regex privacy-masking layer (draft — Sprint 1).

Replaces personally identifiable / volatile tokens with stable placeholders so
that (a) we never persist raw PII in features or logs, and (b) the classifier
learns the *shape* of a scam ("click <URL> to claim <AMOUNT>") rather than
memorizing specific links, numbers or one-time codes.

Placeholders: ``<URL>``, ``<PHONE>``, ``<OTP>``, ``<AMOUNT>``.

Masking order matters and is deliberate:
    1. URL     — consume links first (they may contain digits).
    2. PHONE   — long, structured digit runs (PH mobile / landline / intl).
    3. AMOUNT  — currency-anchored money values.
    4. OTP     — whatever short 4–8 digit numeric run remains.

This is the *draft* layer for Sprint 1; the "complete" pipeline (Sprint 2)
will refine edge cases and add unit-tested boundary handling.
"""

from __future__ import annotations

import re
from typing import Dict

URL_PLACEHOLDER = "<URL>"
PHONE_PLACEHOLDER = "<PHONE>"
AMOUNT_PLACEHOLDER = "<AMOUNT>"
OTP_PLACEHOLDER = "<OTP>"

# --- URL -------------------------------------------------------------------
# Either an explicit scheme / www prefix (greedy to whitespace), or a bare
# domain with an alphabetic TLD (2–24 letters) and an optional path. Requiring
# an alphabetic TLD keeps decimals like "3.50" from being read as domains.
URL_RE = re.compile(
    r"\b(?:https?://|www\.)\S+"
    r"|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}\b(?:/\S*)?",
    re.IGNORECASE,
)

# --- PHONE -----------------------------------------------------------------
# Philippine mobile (+63 9xx xxx xxxx / 09xx xxx xxxx), landline ((0xx) xxx
# xxxx) and a generic international fallback. Separators (space, dot, hyphen)
# are optional. Word-boundary look-arounds avoid biting into larger tokens.
PHONE_RE = re.compile(
    r"(?<!\w)(?:"
    r"\+?63[\s.\-]?9\d{2}[\s.\-]?\d{3}[\s.\-]?\d{4}"   # +63 9xx xxx xxxx
    r"|09\d{2}[\s.\-]?\d{3}[\s.\-]?\d{4}"              # 09xx xxx xxxx
    r"|\(?0\d{1,2}\)?[\s.\-]?\d{3,4}[\s.\-]?\d{4}"     # landline (0xx) xxx xxxx
    r"|\+\d{7,14}"                                      # generic international
    r")(?!\w)"
)

# --- AMOUNT ----------------------------------------------------------------
# Currency-anchored money values only (a leading ₱/PHP/P or a trailing
# pesos/PHP), so plain numbers are left for the OTP pass. The left look-behind
# keeps the "P" branch from firing mid-word (e.g. the P in "iPhone 5").
AMOUNT_RE = re.compile(
    r"(?<![A-Za-z0-9])(?:"
    r"(?:₱|php|p)\s?\d[\d,]*(?:\.\d{1,2})?"     # ₱5,000.00 / PHP 1200 / P50
    r"|\d[\d,]*(?:\.\d{1,2})?\s?(?:pesos|php)"   # 5000 pesos / 1200 php
    r")",
    re.IGNORECASE,
)

# --- OTP -------------------------------------------------------------------
# Any standalone 4–8 digit numeric run left after the passes above. One-time
# codes are the dominant such token in SMS once links, phones and money are
# already masked.
OTP_RE = re.compile(r"(?<!\d)\d{4,8}(?!\d)")


def mask_pii(text: str) -> str:
    """Replace URLs, phone numbers, money amounts and OTP codes with tags."""
    if not text:
        return ""
    text = URL_RE.sub(URL_PLACEHOLDER, text)
    text = PHONE_RE.sub(PHONE_PLACEHOLDER, text)
    text = AMOUNT_RE.sub(AMOUNT_PLACEHOLDER, text)
    text = OTP_RE.sub(OTP_PLACEHOLDER, text)
    return text


def mask_counts(text: str) -> Dict[str, int]:
    """Return how many of each PII category were found (for logging/metrics)."""
    if not text:
        return {"url": 0, "phone": 0, "amount": 0, "otp": 0}
    url = len(URL_RE.findall(text))
    text = URL_RE.sub(URL_PLACEHOLDER, text)
    phone = len(PHONE_RE.findall(text))
    text = PHONE_RE.sub(PHONE_PLACEHOLDER, text)
    amount = len(AMOUNT_RE.findall(text))
    text = AMOUNT_RE.sub(AMOUNT_PLACEHOLDER, text)
    otp = len(OTP_RE.findall(text))
    return {"url": url, "phone": phone, "amount": amount, "otp": otp}
