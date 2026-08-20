"""SHAP indicator tag dictionary (Sprint 3, WBS 3.1.2).

The manuscript's Stage 6 (Explainability and Tip Retrieval) describes SHAP
computing a Shapley value per token, then mapping the top contributing tokens
"through a curated dictionary into human readable indicator tags such as
'Prize Lure,' 'Suspicious URL,' or 'Brand Impersonation'" (also names
"Urgency Cue" elsewhere). This module IS that dictionary — the manuscript
names it, but leaves its full contents to be decided during implementation.

This is deliberately the vocabulary-and-matching-logic step, not the SHAP
integration itself (that's WBS 3.3.6). Actual SHAP wiring will call
``compute_shap_values(masked_text)`` to get per-token importances, then look
each top token up against these ``KEYWORDS`` sets to pick its tag -- this
module defines what tags exist and what triggers each one, so that lookup has
something to consume. Until 3.3.6 lands, ``tags_for_message`` below is also a
directly usable *keyword-based* explainer on its own (deterministic, cheap,
same tags SHAP will eventually confirm token-by-token).

Grounded in the same real-message vocabulary already validated over 7 dataset
review rounds (``ai/scripts/build_dataset.py``) rather than invented fresh --
that file's job is deciding a training LABEL from a rule cascade (one winner);
this one's job is explaining a prediction to a user (multiple tags can apply
at once, order doesn't encode precedence). Deliberately not importing from
build_dataset.py: the two serve different purposes and should be free to
diverge without one script's edits silently changing the other's output.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Sequence
from urllib.parse import urlparse

# Reuse the trained model's own official-domain whitelist logic conceptually,
# but keep a small local copy -- this module must stay importable (and cheap)
# without pulling in the full rule-cascade module.
_OFFICIAL_DOMAINS = {
    "gcash.com",
    "go.gcash.com",
    "globe.com.ph",
    "glbe.co",
    "dito.ph",
    "app.dito.ph",
    "smart.com.ph",
    "smrt.ph",
    "bpi.com.ph",
    "bdo.com.ph",
    "landbank.com",
    "unionbankph.com",
    "maya.ph",
    "paymaya.com",
    "mayaph.co",
    "lazada.com.ph",
    "lzd.co",
    "shopee.ph",
    "shp.ee",
    "lbcexpress.com",
    "jtexpress.ph",
    "grab.com",
    "foodpanda.ph",
}
_SHORTENER_HOSTS = {
    "bit.ly",
    "tinyurl.com",
    "cutt.ly",
    "rb.gy",
    "bl.ink",
    "is.gd",
    "t.co",
    "ln.run",
    "goo.gl",
    "ow.ly",
    "buff.ly",
    "short.io",
    "v.gd",
}

_URL_RE = re.compile(r"(?:https?://\S+|\bwww\.\S+)", re.I)


@dataclass(frozen=True)
class IndicatorTag:
    tag: str
    weight: float  # placeholder confidence until SHAP (3.3.6) supplies real values


# --- Manuscript-named tags (must exist verbatim) --------------------------- #

_PRIZE_LURE = [
    "you won",
    "you have won",
    "you've won",
    "you are a winner",
    "lucky winner",
    "lucky winners",
    "congratulations",
    "claim your prize",
    "cash prize",
    "gcash prize",
    "you have been selected",
    "napanalunan",
    "premyo",
    "kolektahin",
    "spin to win",
    "lucky roulette",
    "maswerteng nanalo",
]

_URGENCY_CUE = [
    "act now",
    "expires today",
    "expires in",
    "24 hours only",
    "last chance",
    "hurry",
    "limited time",
    "before it's too late",
    "ngayon lang",
    "kailangan agad",
    "mag-ingat",
    "huwag palampasin",
    "one time only",
    "only today",
    "24 hrs",
    "within 24 hours",
]

# --- Additional tags grounded in the dataset's own rule vocabulary --------- #

_GAMBLING_BAIT = [
    "jili",
    "okbet",
    "betfil",
    "pagcor",
    "slots",
    "jackpot",
    "cash out",
    "deposit bonus",
    "free spin",
    "play or cash out",
    "gambling",
    # Tagalog gambling vocabulary. Found 2026-07-30 when SHAP explained a real
    # gambling blast ("Magparehistro para sa libreng 7777, tumaya: ...") and
    # produced no tag at all, because every term above is English. This is the
    # same language-coverage gap PROMO_TL and JOB_SCAM already fixed on the
    # dataset side -- worth checking for in every lexicon added here.
    "tumaya",
    "magparehistro",
    "parehistro",
    "deposito",
    "pusta",
    "magtaya",
]

_FAKE_JOB_OFFER = [
    "earn while at home",
    "work from home",
    "homebased",
    "home-based",
    "appointment setter",
    "copy-paste system",
    "be an onliner",
    "part-time job",
    "no experience needed",
    "kumita ng malaki",
    "raket sa bahay",
]

_UNSOLICITED_CREDIT_OFFER = [
    "you are qualified",
    "you are granted",
    "granted credit",
    "pre-approved",
    "preapproved",
    "no collateral",
    "cash loan",
    "cash loans",
    "personal loan",
    "no guarantee",
    "qualified to avail",
    # Tagalog/Taglish loan-offer vocabulary. Added 2026-08-04 during the
    # 3.1.2 confirmation pass -- this tag had zero non-English coverage,
    # the same recurring gap already fixed for PROMO_TL, JOB_SCAM, and
    # Gambling Bait (see the note on that tag below).
    "walang collateral",
    "kwalipikado ka",
    "confirmed loan",
    "pautang",
]

_PERSONAL_INFO_REQUEST = [
    "government id",
    "frontface of",
    "front face of",
    "send your name",
    "email your requirements",
    "provide your",
    "share your otp",
    "confirm your identity",
    "verify your account",
    # Tagalog/Taglish. Added 2026-08-04, see note on _UNSOLICITED_CREDIT_OFFER.
    "ipadala ang",
    "i-share mo",
    "kailangan ng id",
]

_OTP_PHISHING = [
    "account will be blocked",
    "will be suspended",
    "will be deactivated",
    "temporarily disabled",
    "click the link",
    "click this link",
    "verify now",
    "reactivate",
    "otp",
    "one time pin",
    "one-time pin",
    # Tagalog/Taglish. Added 2026-08-04, see note on _UNSOLICITED_CREDIT_OFFER.
    "ma-block ang account",
    "i-verify ang account",
    "i-click ang link",
]

TAG_KEYWORDS: dict[str, List[str]] = {
    "Prize Lure": _PRIZE_LURE,
    "Urgency Cue": _URGENCY_CUE,
    "Gambling Bait": _GAMBLING_BAIT,
    "Fake Job Offer": _FAKE_JOB_OFFER,
    "Unsolicited Credit Offer": _UNSOLICITED_CREDIT_OFFER,
    "Personal Info Request": _PERSONAL_INFO_REQUEST,
    "OTP / Account Phishing": _OTP_PHISHING,
    # "Suspicious URL" and "Brand Impersonation" are structural (link/domain
    # analysis), not keyword lists -- handled separately below.
}


def _keyword_tags(text: str) -> List[IndicatorTag]:
    low = text.lower()
    out = []
    for tag, keywords in TAG_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in low)
        if hits:
            # Placeholder weight: more distinct keyword hits -> higher
            # confidence, capped at 0.9 so a real SHAP weight (3.3.6) always
            # has room to outrank a keyword-only guess.
            out.append(IndicatorTag(tag=tag, weight=min(0.3 + 0.2 * hits, 0.9)))
    return out


def _domain_tags(raw_text: str) -> List[IndicatorTag]:
    """Suspicious URL + Brand Impersonation -- both need the real link, not
    the <URL> placeholder, so this runs on raw (pre-masking) text."""
    out: List[IndicatorTag] = []
    urls = _URL_RE.findall(raw_text or "")
    if not urls:
        return out

    suspicious = False
    for url in urls:
        host = urlparse(url if "://" in url else f"//{url}").hostname or ""
        host = host.lower()
        if host.startswith("www."):
            host = host[4:]
        if host in _SHORTENER_HOSTS:
            suspicious = True
        elif not any(host == d or host.endswith(f".{d}") for d in _OFFICIAL_DOMAINS):
            suspicious = True
    if suspicious:
        out.append(IndicatorTag(tag="Suspicious URL", weight=0.7))

    low = raw_text.lower()
    brands = (
        "gcash",
        "bpi",
        "bdo",
        "globe",
        "smart",
        "dito",
        "lazada",
        "shopee",
        "unionbank",
        "landbank",
        "maya",
        "paymaya",
    )
    named_brand = next((b for b in brands if b in low), None)
    if named_brand and suspicious:
        out.append(IndicatorTag(tag="Brand Impersonation", weight=0.75))
    return out


def tags_for_message(raw_text: str, masked_text: str | None = None) -> List[IndicatorTag]:
    """Keyword/structural indicator tags for a message.

    Interim explainer usable standalone today; also the exact vocabulary
    WBS 3.3.6 (real SHAP integration) should map its top Shapley-value tokens
    against once wired in. ``masked_text`` is accepted for that future caller
    (SHAP runs on the masked text the model actually sees) but currently
    unused here since keyword matching wants the raw text for URL analysis.
    """
    tags = _keyword_tags(masked_text or raw_text)
    tags.extend(_domain_tags(raw_text))
    # Highest-weight first, matching the manuscript's "top contributing
    # tokens" framing -- most-influential indicator shown first.
    return sorted(tags, key=lambda t: t.weight, reverse=True)


def to_indicator_dicts(tags: Sequence[IndicatorTag]) -> List[dict]:
    """Shape expected by ``POST /sms/:messageId/indicators``
    (backend's ``StoreIndicatorsDto`` -- ``[{tag: string, weight: number}]``)."""
    return [{"tag": t.tag, "weight": t.weight} for t in tags]
