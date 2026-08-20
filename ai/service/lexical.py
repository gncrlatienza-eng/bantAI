"""Lexical campaign fingerprinting -- the second signal (Sprint 5, WBS 5.3.6).

Why this module exists
----------------------
Stage 5b matches a message to a campaign using the classifier's ``[CLS]``
embedding, per the manuscript's "one embedding, two branches". Measurement
(WBS 5.3.6) showed that signal has almost no room to work in:

    real campaign members ~0.9998 cosine to their centroid
    unrelated Scam messages ~0.90 cosine to *any* Scam centroid

A classifier is trained to collapse each class toward one prototype, so within
the Scam class every vector is nearly parallel. The usable gap between "same
campaign" and "random stranger" is ~0.0008 wide. A threshold can be placed in
it -- 0.999, see ``campaign.DEFAULT_SIMILARITY_THRESHOLD`` -- but two things
follow from a margin that thin:

1. It already costs recall: 6.2% of genuine members fall below it.
2. It is fragile. Sprint 4's retraining pipeline periodically fine-tunes this
   same model. Any shift in the embedding geometry moves members relative to
   the bar, and the failure is silent -- matching just quietly stops working.

This module supplies an **independent** signal that does not share that
failure mode. It compares the *words* of a message against the words a
campaign actually blasts. Measured separation on the same data:

    representation              members    strangers    gap
    [CLS] embedding              0.999       0.840     0.160
    lexical (this module)        0.823       0.035     0.788

~5x wider, and it moves for entirely different reasons than the embedding
does, so the two signals fail independently -- which is the whole point of
having two.

Design constraints
------------------
This runs on the **fast path**, per message, inside /classify. So:

* **No corpus fit.** TF-IDF would need a fitted vocabulary kept in sync with
  the campaign set; a set-overlap coefficient needs nothing but the message.
* **No new model.** Pure string work -- no second transformer to load, host,
  version, or retrain. That keeps the manuscript's "one embedding" claim
  intact for the thing it actually governs (classification); this is a
  string-matching helper, not a second representation of meaning.
* **Stateless and cheap.** Tokenizing is O(len(text)); scoring against ~240
  campaign profiles is a few thousand set lookups, i.e. microseconds.

Relationship to the manuscript
------------------------------
The manuscript specifies the *embedding* comparison for Stage 5b, and that is
unchanged and still primary -- see ``campaign.CampaignMatcher.match``, where
the embedding gate is evaluated first and a message can never attach on
lexical evidence alone. This adds a corroborating check on top. Flagged for
adviser sign-off alongside the 0.85 -> 0.999 recalibration; see PIPELINE.md
"Stage 5b -- measured limits".
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Dict, Iterable, List, Optional, Sequence, Set
from urllib.parse import urlparse

from preprocessing.masking import mask_pii

#: Shingles must appear in at least this share of a campaign's members to enter
#: its profile. Rationale: a campaign is a *template* with variable slots, so
#: the wording common to most members is the campaign's identity, while wording
#: unique to one member is that member's noise. At 1.0 (intersection) a single
#: outlier member empties the profile; at 0.0 (union) the profile absorbs every
#: member's noise and starts matching everything. Half is the natural middle
#: and is what the measurement in calibrate_hybrid_match.py was run against.
PROFILE_MIN_DOCUMENT_FREQUENCY = 0.5

#: Campaigns whose profile ends up smaller than this are not distinctive enough
#: to corroborate anything -- a 2-shingle profile like {"your", "account"}
#: would "confirm" half the Scam corpus. Below it, ``lexical_similarity``
#: reports 0.0 and the hybrid path falls back to embedding-only matching.
MIN_PROFILE_SHINGLES = 4

_TOKEN_RE = re.compile(r"[a-z0-9<>]+")
_URL_RE = re.compile(r"(?:h(?:tt|xx)ps?://\S+|\bwww\.\S+)", re.I)


def extract_domains(text: str) -> List[str]:
    """Lowercased hostnames appearing in a message, ``www.`` stripped.

    Mirrors ``scripts/cluster_campaigns.py:_extract_domains`` (which populates
    the ``top_domains`` this is compared against) so the two cannot disagree
    about what counts as a domain. Kept as a separate signal from the shingles
    below because masking replaces every URL with ``<URL>`` -- the *identity*
    of the link is exactly what masking is designed to destroy, and exactly
    what makes two scam texts the same blast.
    """
    out: List[str] = []
    for url in _URL_RE.findall(text or ""):
        host = urlparse(url if "://" in url else f"//{url}").hostname or ""
        host = host.lower()
        if host.startswith("www."):
            host = host[4:]
        if host:
            out.append(host)
    return out


def shingles(text: str) -> Set[str]:
    """Word unigrams + bigrams of the **masked** text.

    Masking first is deliberate: it strips the volatile parts (the specific
    link, amount, OTP) and leaves the template. Two sends of one campaign
    differ precisely in those slots, so comparing masked text compares what
    the campaign holds constant. ``<URL>``/``<AMOUNT>`` placeholders survive
    tokenization -- the *shape* "click <URL> claim <AMOUNT>" is itself
    campaign-identifying, even though the link identity is handled separately
    by ``extract_domains``.

    Bigrams carry the word order that makes a template a template; unigrams
    alone would call any two messages about "account" and "verify" the same
    campaign regardless of arrangement.
    """
    words = _TOKEN_RE.findall(mask_pii(text or "").lower())
    if not words:
        return set()
    out: Set[str] = set(words)
    out.update(f"{a} {b}" for a, b in zip(words, words[1:]))
    return out


@dataclass
class LexicalProfile:
    """The wording a campaign holds in common, plus the domains it blasts.

    Built once per campaign by the offline clustering pass and carried
    alongside the centroid; the fast path only reads it.
    """

    #: Shingles present in at least PROFILE_MIN_DOCUMENT_FREQUENCY of members.
    shingles: Set[str] = field(default_factory=set)
    #: Hostnames seen in this campaign's messages (from ``top_domains``).
    domains: Set[str] = field(default_factory=set)
    #: How many messages the profile was built from -- audit only.
    member_count: int = 0

    @property
    def is_distinctive(self) -> bool:
        """Whether this profile is specific enough to corroborate a match."""
        return len(self.shingles) >= MIN_PROFILE_SHINGLES

    def to_dict(self) -> dict:
        return {
            "shingles": sorted(self.shingles),
            "domains": sorted(self.domains),
            "member_count": self.member_count,
        }

    @classmethod
    def from_dict(cls, data: Optional[dict]) -> Optional["LexicalProfile"]:
        """Rebuild from ``campaign_clusters.json`` / the backend payload.

        Returns ``None`` for missing or malformed input rather than raising:
        campaigns clustered before this module existed have no profile, and
        those must degrade to embedding-only matching, not crash the service.
        """
        if not isinstance(data, dict):
            return None
        raw_shingles = data.get("shingles")
        if not isinstance(raw_shingles, (list, tuple, set)):
            return None
        return cls(
            shingles={str(s) for s in raw_shingles},
            domains={str(d).lower() for d in data.get("domains") or ()},
            member_count=int(data.get("member_count") or 0),
        )


def build_profile(
    texts: Sequence[str],
    domains: Optional[Iterable[str]] = None,
    min_document_frequency: float = PROFILE_MIN_DOCUMENT_FREQUENCY,
) -> LexicalProfile:
    """Derive a campaign's profile from its member messages.

    A shingle enters the profile when it appears in at least
    ``min_document_frequency`` of members -- see the constant's note for why
    neither intersection nor union works here.
    """
    member_sets = [shingles(t) for t in texts]
    member_sets = [s for s in member_sets if s]
    if not member_sets:
        return LexicalProfile(domains={d.lower() for d in domains or ()}, member_count=0)

    counts: Dict[str, int] = {}
    for s in member_sets:
        for sh in s:
            counts[sh] = counts.get(sh, 0) + 1

    cutoff = max(1, int(round(min_document_frequency * len(member_sets))))
    common = {sh for sh, n in counts.items() if n >= cutoff}

    return LexicalProfile(
        shingles=common,
        domains={d.lower() for d in domains or ()},
        member_count=len(member_sets),
    )


def lexical_similarity(text: str, profile: Optional[LexicalProfile]) -> float:
    """How strongly one message's wording matches a campaign's template, 0..1.

    Dice coefficient over shingle sets -- the harmonic mean of two things that
    are each insufficient alone:

    * **coverage** (|shared| / |profile|): how much of the campaign template
      the message reproduces. Alone, a long message quoting everything scores
      high on every campaign.
    * **precision** (|shared| / |message|): how much of the message is
      campaign template. Alone, a two-word message that happens to be on
      template scores a perfect 1.0.

    Requiring both to be high is what makes the signal specific. Returns 0.0
    for a missing or non-distinctive profile, which makes the caller fall back
    to embedding-only matching rather than treating "no evidence" as
    "contradicting evidence".

    Tokenizes ``text`` on every call -- fine for a single text-vs-profile
    comparison, but a caller comparing one message against many profiles
    (``CampaignMatcher.match``) should tokenize once and call
    ``similarity_from_shingles`` directly instead of calling this per profile.
    """
    if profile is None or not profile.is_distinctive:
        return 0.0
    return similarity_from_shingles(shingles(text), profile)


def similarity_from_shingles(msg_shingles: Set[str], profile: Optional[LexicalProfile]) -> float:
    """Dice-coefficient core of ``lexical_similarity``, given an already-
    tokenized shingle set instead of raw text.

    Split out so a message compared against many campaign profiles in one
    pass -- ``CampaignMatcher.match`` loops over ~240 active centroids -- can
    call ``shingles(text)`` once (masking + tokenizing) and reuse the result,
    instead of ``lexical_similarity`` silently repeating that work per
    centroid for text that never changes across the loop.
    """
    if profile is None or not profile.is_distinctive:
        return 0.0
    if not msg_shingles:
        return 0.0
    shared = len(msg_shingles & profile.shingles)
    if shared == 0:
        return 0.0
    coverage = shared / len(profile.shingles)
    precision = shared / len(msg_shingles)
    return 2.0 * coverage * precision / (coverage + precision)


def shares_domain(text: str, profile: Optional[LexicalProfile]) -> bool:
    """Whether the message links to a domain this campaign is known to blast.

    The single strongest piece of evidence available, and the reason it gets
    its own tier in ``CampaignMatcher.match``: a scam campaign's whole purpose
    is driving traffic to one destination, so link identity is close to a
    campaign identifier. It is also the field the backend already maintains
    for link suppression (``getActiveDomains()``), so nothing new has to be
    collected to use it.

    Extracts domains from ``text`` on every call -- fine for a single
    comparison, but a caller checking one message against many profiles
    should extract once and call ``domains_overlap`` directly instead of
    calling this per profile.
    """
    if profile is None or not profile.domains:
        return False
    return domains_overlap(extract_domains(text), profile)


def domains_overlap(msg_domains: Iterable[str], profile: Optional[LexicalProfile]) -> bool:
    """Core of ``shares_domain``, given an already-extracted domain list.

    Split out for the same reason as ``similarity_from_shingles``:
    ``CampaignMatcher.match`` loops over ~240 active centroids for one
    message and would otherwise re-run URL extraction from scratch on every
    centroid for text that never changes across the loop.
    """
    if profile is None or not profile.domains:
        return False
    return any(d in profile.domains for d in msg_domains)
