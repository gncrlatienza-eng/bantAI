"""Readable names and categories for campaign clusters (UAT, 2026-09-28).

The Campaigns tab showed ``cluster-9``. This gives each cluster a category and
a short name, e.g. ``BDO bank phishing`` or ``Online gambling / casino #3``,
worked out from its members' wording with keyword rules.

The name and category are built only from the fixed vocabularies below (brand
names and category words), never copied from message text, so they can be sent
to the backend and shown in the app without carrying anything a participant
wrote.

Each member message votes for the category whose keywords it hits most; the
cluster takes the most common vote if at least ``MIN_SHARE`` of members agree,
otherwise it is "Other scam". Spam-majority clusters are named as promos.
Ordering in ``SCAM_CATEGORIES`` breaks ties: phishing that merely mentions a
payment channel ("deposit via GCash") must not outrank the gambling wording
around it, so gambling is checked before the brand-led phishing rules only
when it actually has more hits.
"""

from __future__ import annotations

import re
from collections import Counter
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

#: A category must win at least this share of member votes to name the cluster.
MIN_SHARE = 0.4

#: A brand must appear in at least this share of members to be put in the name.
BRAND_SHARE = 0.3

#: (category, keywords). Order breaks ties between equal hit counts.
SCAM_CATEGORIES: List[Tuple[str, List[str]]] = [
    (
        "Parcel / delivery scam",
        [
            "parcel",
            "delivery",
            "redelivery",
            "lbc",
            "j&t",
            "jnt",
            "ninja van",
            "shipment",
            "package",
            "courier",
            "recipient",
            "address",
        ],
    ),
    (
        "Bank phishing",
        [
            "bdo",
            "bpi",
            "metrobank",
            "unionbank",
            "landbank",
            "security bank",
            "rcbc",
            "pnb",
            "chinabank",
            "unauthorized",
            "transaction",
            "mybdo",
        ],
    ),
    (
        "E-wallet phishing",
        ["gcash", "maya", "paymaya", "deactivation", "deactivated", "disabled", "temporarily", "advisory"],
    ),
    (
        "Loan / credit offer",
        [
            "loan",
            "collateral",
            "credit card",
            "approval",
            "lending",
            "utang",
            "pautang",
            "need cash",
            "easy cash",
            "credit",
            "processing",
            "getcash",
        ],
    ),
    (
        "Online gambling / casino",
        [
            "bonus",
            "deposit",
            "deposito",
            "magdeposito",
            "jackpot",
            "slot",
            "casino",
            "bet",
            "roulette",
            "bingo",
            "jili",
            "sabong",
            "cashback",
            "turnover",
            "laro",
            "maglaro",
            "games",
            "game",
            "gojackpot",
            "manalo",
            "panalo",
            "bets",
            "roulette",
            "cash out",
            "play",
            "wins",
        ],
    ),
    (
        "Rewards / prize claim",
        [
            "points",
            "redeem",
            "expire",
            "reward",
            "rewards",
            "prize",
            "raffle",
            "congratulations",
            "won",
            "premyo",
            "red envelope",
            "lucky",
            "gift",
        ],
    ),
    (
        "Job / task offer",
        [
            "trabaho",
            "job",
            "hiring",
            "salary",
            "sahod",
            "kumita",
            "earn",
            "commission",
            "task",
            "part-time",
            "part time",
            "work from home",
            "natutulog",
            "habang",
            "share",
            "earn money",
        ],
    ),
    ("OTP / account update", ["otp", "pin", "update", "updated", "registered", "sim", "verify", "verification"]),
    (
        "Government / ID request",
        [
            "government",
            "requirements",
            "dswd",
            "sss",
            "philhealth",
            "bir",
            "lto",
            "nbi",
            "ayuda",
            "pagibig",
            "pag-ibig",
            "frontface",
            "front face",
            "valid id",
            "selfie",
            "kindly",
        ],
    ),
]

OTHER_SCAM = "Other scam"
_BANK_BRANDS = {"BDO", "BPI", "Metrobank", "UnionBank", "Landbank"}
_EWALLET_BRANDS = {"GCash", "Maya"}
PROMO = "Promo / marketing"

#: Display spelling for brands found in messages.
BRANDS: Dict[str, str] = {
    "gcash": "GCash",
    "paymaya": "Maya",
    "maya": "Maya",
    "bdo": "BDO",
    "bpi": "BPI",
    "metrobank": "Metrobank",
    "unionbank": "UnionBank",
    "landbank": "Landbank",
    "lbc": "LBC",
    "j&t": "J&T",
    "globe": "Globe",
    "smart": "Smart",
    "dito": "DITO",
    "shopee": "Shopee",
    "lazada": "Lazada",
    "sss": "SSS",
    "philhealth": "PhilHealth",
}

_WORD = {}


def _has(low: str, kw: str) -> bool:
    """Whole-word (or whole-phrase) match, so 'bet' does not fire on 'better'."""
    pat = _WORD.get(kw)
    if pat is None:
        pat = _WORD[kw] = re.compile(r"(?<![a-z0-9])" + re.escape(kw) + r"(?![a-z0-9])")
    return pat.search(low) is not None


def message_category(text: str) -> Optional[str]:
    low = str(text).lower()
    best, best_hits = None, 0
    for category, keywords in SCAM_CATEGORIES:
        hits = sum(1 for kw in keywords if _has(low, kw))
        if hits > best_hits:
            best, best_hits = category, hits
    return best


def message_brand(text: str) -> Optional[str]:
    low = str(text).lower()
    for key, display in BRANDS.items():
        if _has(low, key):
            return display
    return None


def describe(texts: Sequence[str], labels: Dict[str, int]) -> Tuple[str, str]:
    """``(category, base_name)`` for one cluster, from its members' texts."""
    n = max(len(texts), 1)
    brands = Counter(b for b in (message_brand(t) for t in texts) if b)
    brand = None
    if brands:
        top, count = brands.most_common(1)[0]
        if count / n >= BRAND_SHARE:
            brand = top

    if labels.get("Scam", 0) <= labels.get("Spam", 0):
        return PROMO, f"Promo ({brand})" if brand else PROMO

    votes = Counter(c for c in (message_category(t) for t in texts) if c)
    category = OTHER_SCAM
    if votes:
        top, count = votes.most_common(1)[0]
        if count / n >= MIN_SHARE:
            category = top
    # Bank vs e-wallet phishing is decided by whose name is on it.
    if category in ("Bank phishing", "E-wallet phishing") and brand:
        if brand in _EWALLET_BRANDS:
            category = "E-wallet phishing"
        elif brand in _BANK_BRANDS:
            category = "Bank phishing"
    # A brand in the name only where it says something about the scam: "Bank
    # phishing (BDO)" yes, "Online gambling (GCash)" -- GCash as the deposit
    # channel -- no.
    branded = category in (
        "Bank phishing",
        "E-wallet phishing",
        "Parcel / delivery scam",
        "Rewards / prize claim",
        "OTP / account update",
        "Government / ID request",
    )
    return category, f"{category} ({brand})" if brand and branded else category


def name_clusters(clusters: Iterable[Tuple[int, Sequence[str], Dict[str, int]]]) -> Dict[int, Tuple[str, str]]:
    """``{cluster_id: (category, unique_name)}``. Repeated names get ``#2``, ``#3``
    in cluster-size order (largest keeps the plain name)."""
    rows = [(cid, len(texts), *describe(texts, labels)) for cid, texts, labels in clusters]
    rows.sort(key=lambda r: -r[1])
    seen: Counter = Counter()
    out = {}
    for cid, _size, category, base in rows:
        seen[base] += 1
        name = base
        out[cid] = (category, name if seen[base] == 1 else f"{name} #{seen[base]}")
    return out
