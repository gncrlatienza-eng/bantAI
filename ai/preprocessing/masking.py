"""Regex privacy-masking layer (Sprint 2 — completed).

Replaces volatile, structured tokens with stable placeholders so that (a)
those specific values do not reach features or logs, and (b) the classifier
learns the *shape* of a scam ("click <URL> to claim <AMOUNT>") rather than
memorizing specific links, numbers or one-time codes.

Placeholders: ``<EMAIL>``, ``<URL>``, ``<PHONE>``, ``<AMOUNT>``, ``<OTP>``.

**⚠️ Masked is not anonymous. What this does NOT remove** (Reymark's audit,
items 17-18) — confirmed by reviewer probes against the live regexes:

- **Names.** "Hi NEMIA, your GCash is locked" keeps the name. Nothing here
  does named-entity recognition, and a regex cannot.
- **Addresses.** Street and place names survive as ordinary words.
- **TINs, account numbers, reference numbers.** ``OTP_RE`` matches runs of
  **4-8** digits; ``PHONE_RE`` matches phone shapes. A 9+ digit identifier
  that is not phone-shaped (a TIN, a long reference number) matches neither
  and passes through intact.
- **Anything identifying expressed in words** — employer, barangay, "your
  daughter Maria".

So masked text is **reduced-risk, not de-identified**, and every downstream
use has to keep treating it as personal data: the snapshot CSVs, the holdout
set, ``disagreements.json``, anything exported to Colab or Drive, and
anything pasted into an issue or the manuscript. The de-duplication key is
masked text, which is exactly why the snapshot still stores the raw body.

Extending coverage (a ``<NUMBER>`` placeholder for long digit runs, or NER
for names) would change the model's input distribution, so it cannot be
switched on under a deployed checkpoint without retraining and re-measuring.
Documented as future work rather than done quietly.

Masking order matters and is deliberate:
    1. EMAIL   — consume addresses first (they contain '@' + a domain-like tail).
    2. URL     — links next (they may contain digits); also catches ``hxxp`` obfuscation.
    3. PHONE   — long, structured digit runs (PH mobile / landline / intl).
    4. AMOUNT  — currency-anchored money values (incl. ``₱5k`` shorthand).
    5. OTP     — whatever short 4–8 digit numeric run remains.
"""

from __future__ import annotations

import re
from typing import Dict

EMAIL_PLACEHOLDER = "<EMAIL>"
URL_PLACEHOLDER = "<URL>"
PHONE_PLACEHOLDER = "<PHONE>"
AMOUNT_PLACEHOLDER = "<AMOUNT>"
OTP_PLACEHOLDER = "<OTP>"

# --- EMAIL -----------------------------------------------------------------
# Standard address shape; masked before URL so the domain tail isn't eaten by
# the URL pass.
EMAIL_RE = re.compile(
    r"\b[a-z0-9._%+\-]+@[a-z0-9](?:[a-z0-9\-]*[a-z0-9])?(?:\.[a-z0-9\-]+)*\.[a-z]{2,24}\b",
    re.IGNORECASE,
)

# --- URL -------------------------------------------------------------------
# Either an explicit scheme / www prefix (greedy to whitespace) — including the
# common ``hxxp`` / ``hxxps`` de-fanging seen in threat reports — or a bare
# domain with an alphabetic TLD (2–24 letters) and an optional path. Requiring
# an alphabetic TLD keeps decimals like "3.50" from being read as domains.
URL_RE = re.compile(
    r"\b(?:h(?:tt|xx)ps?://|www\.)\S+"
    r"|\b(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,24}\b(?:/\S*)?",
    re.IGNORECASE,
)

# --- PHONE -----------------------------------------------------------------
# Philippine mobile (+63 9xx xxx xxxx / 09xx xxx xxxx), landline ((0xx) xxx
# xxxx) and a generic international fallback. Separators (space, dot, hyphen)
# are optional. Word-boundary look-arounds avoid biting into larger tokens.
PHONE_RE = re.compile(
    r"(?<!\w)(?:"
    r"\+?63[\s.\-]?9\d{2}[\s.\-]?\d{3}[\s.\-]?\d{4}"  # +63 9xx xxx xxxx
    r"|09\d{2}[\s.\-]?\d{3}[\s.\-]?\d{4}"  # 09xx xxx xxxx
    r"|\(?0\d{1,2}\)?[\s.\-]?\d{3,4}[\s.\-]?\d{4}"  # landline (0xx) xxx xxxx
    r"|\+\d{7,14}"  # generic international
    r")(?!\w)"
)

# --- AMOUNT ----------------------------------------------------------------
# Currency-anchored money values only (a leading ₱/PHP/P or a trailing
# pesos/PHP), so plain numbers are left for the OTP pass. An optional k/m
# shorthand ("₱5k", "P2m") is folded in. The left look-behind keeps the "P"
# branch from firing mid-word (e.g. the P in "iPhone 5").
AMOUNT_RE = re.compile(
    r"(?<![A-Za-z0-9])(?:"
    r"(?:₱|php|p)\s?\d[\d,]*(?:\.\d{1,2})?[km]?"  # ₱5,000.00 / PHP 1200 / P50 / ₱5k
    r"|\d[\d,]*(?:\.\d{1,2})?[km]?\s?(?:pesos|php)"  # 5000 pesos / 1200 php / 5k pesos
    r")",
    re.IGNORECASE,
)

# --- OTP -------------------------------------------------------------------
# Any standalone 4–8 digit numeric run left after the passes above. One-time
# codes are the dominant such token in SMS once links, phones and money are
# already masked.
OTP_RE = re.compile(r"(?<!\d)\d{4,8}(?!\d)")


def mask_pii(text: str) -> str:
    """Replace emails, URLs, phone numbers, money amounts and OTP codes."""
    if not text:
        return ""
    text = EMAIL_RE.sub(EMAIL_PLACEHOLDER, text)
    text = URL_RE.sub(URL_PLACEHOLDER, text)
    text = PHONE_RE.sub(PHONE_PLACEHOLDER, text)
    text = AMOUNT_RE.sub(AMOUNT_PLACEHOLDER, text)
    text = OTP_RE.sub(OTP_PLACEHOLDER, text)
    return text


def mask_counts(text: str) -> Dict[str, int]:
    """Return how many of each PII category were found (for logging/metrics)."""
    empty = {"email": 0, "url": 0, "phone": 0, "amount": 0, "otp": 0}
    if not text:
        return empty
    email = len(EMAIL_RE.findall(text))
    text = EMAIL_RE.sub(EMAIL_PLACEHOLDER, text)
    url = len(URL_RE.findall(text))
    text = URL_RE.sub(URL_PLACEHOLDER, text)
    phone = len(PHONE_RE.findall(text))
    text = PHONE_RE.sub(PHONE_PLACEHOLDER, text)
    amount = len(AMOUNT_RE.findall(text))
    text = AMOUNT_RE.sub(AMOUNT_PLACEHOLDER, text)
    otp = len(OTP_RE.findall(text))
    return {"email": email, "url": url, "phone": phone, "amount": amount, "otp": otp}
