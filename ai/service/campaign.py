"""Campaign cluster matching via cosine similarity (Sprint 3, WBS 3.3.4).

Implements the manuscript's Stage 5b (campaign-level branch):

    "the same embedding is compared via cosine similarity against the
    centroids of all existing active campaign clusters. If the similarity to
    any centroid is at least 0.85, the message is attached to that cluster. If
    not, the embedding is buffered for an offline HDBSCAN re-clustering pass
    with min_cluster_size = 5."

The mechanism is implemented as specified. The **threshold** is not: 0.85 was
measured to attach 54.5% of unrelated messages on this embedding space and has
been re-calibrated to 0.999 (Sprint 5, WBS 5.3.6 -- "re-evaluate thresholds
against real campaign data"). See ``DEFAULT_SIMILARITY_THRESHOLD`` below for
the measurement and why the gap is structural.

This module is the **fast path** -- it runs per message, in-process, during
/classify. The slow path (offline HDBSCAN over the buffer) is
``scripts/cluster_campaigns.py`` (WBS 3.3.5).

Design note: this holds centroids in memory and returns a match decision; it
never touches the database. The backend owns all campaign persistence (see
``docs/api/sms.md`` and ``backend/src/campaigns/``), so the AI service reports
"this message belongs to cluster X" / "no match, buffer it" and the backend
writes it. That keeps the dependency one-directional (backend -> AI service)
instead of circular.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

from .lexical import (
    LexicalProfile,
    build_profile,
    domains_overlap,
    extract_domains,
    shingles,
    similarity_from_shingles,
)

# Campaign match threshold, re-calibrated against real data (Sprint 5, WBS
# 5.3.6). The manuscript specifies 0.85; that value does not discriminate on
# this embedding space, and the reason is structural rather than a tuning miss.
#
# Stage 5b reuses the classifier's final-layer [CLS] vector for campaign
# matching. A classifier is trained to collapse each class toward a single
# prototype, so *within* the Scam class the vectors are nearly parallel: two
# entirely unrelated Scam messages average 0.90 cosine, and random Spam/Scam
# pairs average 0.84. The 0.85 bar therefore sits inside the distribution of
# unrelated messages rather than above it.
#
# Measured against centroids under the real operating condition
# (scripts/calibrate_match_threshold.py -- held-out members of a campaign vs.
# random strangers, both scored against that campaign's centroid):
#
#     threshold   members attached   strangers attached
#     0.85               100.0%            71.8%   <- manuscript
#     0.99                99.3%            31.6%
#     0.998               94.8%             2.8%   <- selected
#     0.999               91.3%             0.4%
#     0.9995              85.2%             0.1%
#
# ⚠️ 2026-08-30 promotion note: these numbers, and the 0.998 pick, are against
# the checkpoint promoted that day (v2026-08-27T09-46-20Z), not the original
# v2026-07-29-run3 the 0.999 bar (Sprint 5, WBS 5.3.6) was calibrated against.
# 0.998 here reproduces the *same* recall/false-match trade-off that 0.999 gave
# under the old checkpoint (93.8%/2.6%) -- carrying 0.999 forward unchanged
# would have been stricter than the trade-off actually approved, not equivalent
# to it. Full sweep and reasoning: `Retrain Candidate Review` artifact and
# PIPELINE.md "Stage 5b" promotion note. Unlike the 0.85 -> 0.999 recalibration,
# this threshold move was **not** put to the adviser before being applied --
# see that PIPELINE.md note for exactly who decided this and on what basis.
#
# 0.998 is the knee: stricter costs 6pp of real campaign members to save 2pp of
# false attachments -- the same shape of trade-off as before. At 0.85 the
# feature was attaching a majority of unrelated messages to campaigns, which is
# worse than not grouping at all -- a user told "this is part of a known
# campaign" learns nothing if it is a coin flip.
#
# ⚠️ The margin is narrow by construction: members sit at ~0.9998 and the
# threshold at 0.998-0.999. That is a property of reusing a classifier
# embedding for similarity, not of this particular number, and it is the
# strongest argument for giving campaign matching its own representation. See
# PIPELINE.md "Stage 5b -- measured limits" and scripts/compare_campaign_embeddings.py.
#
# That narrowness is what the hybrid tiers below address: rather than resting
# the whole decision on a sliver of headroom, a second, independent signal
# (service/lexical.py) can corroborate a *relaxed* embedding score. This
# threshold remains the embedding-only bar, so behaviour never degrades below
# what was calibrated here.
DEFAULT_SIMILARITY_THRESHOLD = 0.998

# --- hybrid corroboration gates (Sprint 5, WBS 5.3.6) ------------------------
# The embedding alone has ~0.16 of separation between members and strangers,
# and the usable part of that is ~0.0008 wide. Lexical overlap has ~0.79. The
# two signals fail for unrelated reasons -- the embedding moves when the model
# is retrained, the wording does not -- so requiring them to agree buys back
# recall without spending the false-match budget.
#
# A message may attach to a campaign by any of three routes, checked in order
# of evidential strength. The embedding is consulted in all three: it is the
# manuscript's specified signal, and nothing attaches on wording alone.
#
#   tier "domain"    shares a blasted domain, embedding >= 0.90
#   tier "hybrid"    embedding >= 0.99  AND  lexical >= 0.45
#   tier "embedding" embedding >= 0.999                    (the calibrated bar)
#
# Because the third tier is exactly the pre-hybrid rule, the hybrid path can
# only *add* matches -- recall rises, and every added match carries
# corroboration the embedding-only rule never had.
#
# Measured by scripts/calibrate_hybrid_match.py. That script runs the whole
# sweep under two *independent* definitions of "same campaign", because
# calibrating a wording-based gate on wording-defined groups would be circular
# and would flatter this signal for free. Re-measured 2026-08-30 against the
# promoted checkpoint (v2026-08-27T09-46-20Z) and its 0.998 embedding-only bar
# -- see the promotion note near DEFAULT_SIMILARITY_THRESHOLD above:
#
#   grouping    baseline recall/FMR    with hybrid (0.99 / 0.45)
#   lexical         94.8% / 2.8%           99.6% / 3.2%
#   hdbscan         59.5% / 3.0%           63.1% / 3.6%
#
# The hdbscan row is the one that counts -- its groups are defined purely by
# embedding geometry and know nothing about wording, so it cannot be rigged in
# the lexical gate's favour. It still shows +3.6pp recall for +0.7pp false
# matches, so the gain is real and not an artifact of the ground truth.
#
# ⚠️ Note the baseline gap between the two rows: HDBSCAN's own cluster members
# only re-match their own centroid 59.5% of the time at 0.998, up from 44.4%
# under the old checkpoint but still well short of 100%. The offline pass is
# producing clusters the fast path then cannot fully recognise -- consistent
# with the diffuse "generic scam" region documented in PIPELINE.md, and an
# argument for the min_cluster_size question being settled with the adviser.

#: Relaxed embedding bar, usable only with lexical corroboration. At 0.99 the
#: embedding alone admits 30.5% of strangers (see the table above), which is
#: why it is never sufficient by itself -- it is a coarse "same neighbourhood"
#: filter that the lexical gate then has to confirm.
#:
#: Measured: 0.95 / 0.97 / 0.98 / 0.99 all produce identical recall once the
#: lexical gate is applied, so this costs nothing and 0.99 is chosen as the
#: most conservative of the indistinguishable options.
HYBRID_EMBEDDING_GATE = 0.99

#: Lexical Dice-overlap a message must share with a campaign's template to
#: corroborate a relaxed embedding score.
#:
#: Measured (hdbscan grouping, the non-circular one): 0.30 buys +5.5pp recall
#: for +1.4pp false matches; 0.45 buys +5.2pp for +0.6pp. Nearly all the recall
#: for under half the cost, so 0.45 is the knee. 0.45 and 0.50 differ by 0.1pp
#: on both axes -- within noise, so this is a plateau rather than a sharp
#: optimum, which is the good case: it will not shift under small data changes.
LEXICAL_GATE = 0.45

#: Embedding floor for the domain tier. A shared scam domain is near-conclusive
#: on its own, but this keeps a Ham message that merely quotes a scam link
#: (a user asking "is bdo-verify.xyz legit?") from being filed as a campaign
#: member. 0.90 is roughly "same class", far below the campaign bar.
#:
#: Measured: the tier holds a 0.3% false-match rate across 0.80-0.95, so the
#: floor is not load-bearing for accuracy -- it is a safety rail against the
#: quoted-link case, and 0.90 keeps 11.6% recall of the 11.8% available at 0.80.
DOMAIN_EMBEDDING_FLOOR = 0.90


def cosine_similarity(a, b) -> float:
    """Cosine similarity between two vectors.

    ``service.embeddings`` L2-normalizes everything it produces, so for those
    vectors this is just a dot product. The explicit norm division is kept so
    the function stays correct if handed un-normalized input (e.g. a centroid
    someone averaged without re-normalizing).
    """
    import numpy as np

    a = np.asarray(a, dtype="float32")
    return _cosine_similarity_with_norm(a, float(np.linalg.norm(a)), b)


def _cosine_similarity_with_norm(a, norm_a: float, b) -> float:
    """``cosine_similarity``'s core, given ``norm(a)`` already computed.

    ``CampaignMatcher.match`` compares one message embedding against every
    active centroid (documented above at up to ~240) -- ``norm(a)`` is
    identical on every iteration of that loop, so it computes it once and
    reuses it here instead of letting ``cosine_similarity`` recompute the
    same sqrt-of-768-dims value per centroid. ``norm(b)`` still varies per
    centroid and is always computed fresh -- a backend-sourced centroid has
    no guaranteed normalization (see ``centroid_source.py:load_from_backend``,
    which stores whatever the backend returns as-is), so this cannot be
    dropped the same way ``norm(a)`` can.
    """
    import numpy as np

    a = np.asarray(a, dtype="float32")
    b = np.asarray(b, dtype="float32")
    denom = float(norm_a * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return float(np.dot(a, b) / denom)


@dataclass
class CampaignCentroid:
    """One active campaign cluster, as far as the matcher is concerned.

    Mirrors the fields the backend's ``CampaignCluster`` model already stores
    (``id``, ``label``, ``centroid``, ``urlDomains``) -- see
    ``backend/database/prisma/schema.prisma``.
    """

    cluster_id: str
    centroid: Sequence[float]
    label: Optional[str] = None
    url_domains: List[str] = field(default_factory=list)
    #: Wording this campaign holds in common, for the hybrid tiers. ``None``
    #: for campaigns clustered before WBS 5.3.6 -- those simply fall back to
    #: embedding-only matching.
    lexical: Optional[LexicalProfile] = None


@dataclass
class MatchResult:
    """Outcome of matching one message against the active centroids."""

    cluster_id: Optional[str]
    similarity: float
    matched: bool
    #: True when nothing cleared the threshold, so the embedding should be
    #: buffered for the next offline HDBSCAN pass (manuscript Stage 5b).
    should_buffer: bool
    #: Lexical overlap with the reported cluster's template, 0.0 when no text
    #: was supplied or the campaign predates lexical profiles.
    lexical_similarity: float = 0.0
    #: Which route produced the match -- ``"domain"``, ``"hybrid"``,
    #: ``"embedding"``, or ``None`` when nothing matched. Persisted so a
    #: campaign attribution can be explained after the fact, and so the tiers
    #: can be audited independently once real traffic accumulates.
    match_reason: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "cluster_id": self.cluster_id,
            "similarity": round(self.similarity, 4),
            "matched": self.matched,
            "should_buffer": self.should_buffer,
            "lexical_similarity": round(self.lexical_similarity, 4),
            "match_reason": self.match_reason,
        }


class CampaignMatcher:
    """Matches message embeddings against active campaign centroids.

    Centroids are refreshed from the backend (or seeded from an offline
    clustering run); this object just holds them and answers "closest match?".
    """

    def __init__(
        self,
        centroids: Optional[Sequence[CampaignCentroid]] = None,
        threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    ) -> None:
        self.threshold = threshold
        self._centroids: List[CampaignCentroid] = list(centroids or [])

    def replace_centroids(self, centroids: Sequence[CampaignCentroid]) -> None:
        """Swap in a fresh set (e.g. after an offline re-clustering pass)."""
        self._centroids = list(centroids)

    @property
    def centroids(self) -> List[CampaignCentroid]:
        return list(self._centroids)

    def match(self, embedding, text: Optional[str] = None) -> MatchResult:
        """Find the best-matching active campaign for one embedding.

        ``text`` is the raw message body. It is optional so every existing
        caller keeps working unchanged: without it, only the third tier can
        fire and the behaviour is exactly the pre-hybrid, embedding-only rule.
        Passing it enables the two corroborated tiers described at the top of
        this module.

        With no active clusters yet (cold start), everything buffers -- which
        is correct: campaigns can only be discovered by the offline pass once
        enough unmatched messages accumulate.
        """
        if not self._centroids:
            return MatchResult(cluster_id=None, similarity=0.0, matched=False, should_buffer=True)

        import numpy as np

        # norm(embedding) is identical on every iteration of the loop below --
        # computed once here instead of once per centroid inside
        # cosine_similarity (previously up to ~240 redundant sqrt-of-768-dims
        # calls per matched message).
        norm_embedding = float(np.linalg.norm(np.asarray(embedding, dtype="float32")))

        # Seeded below -1 (cosine's floor) rather than at 0, so a genuinely
        # negative best similarity is reported honestly instead of being
        # rounded up to 0.0 -- the reported number is used for threshold
        # tuning, so it has to be the real one.
        best_sim = -2.0

        # Best candidate found per tier. Every tier is evaluated for every
        # centroid before any decision is made, because the tiers are ranked by
        # how much evidence they carry, not by which centroid scores highest:
        # a domain-corroborated match at 0.94 is stronger evidence than a bare
        # embedding match at 0.9991, and picking the higher cosine first would
        # silently invert that ranking.
        domain_hit: Optional[tuple] = None  # (similarity, lexical, cluster_id)
        hybrid_hit: Optional[tuple] = None
        embedding_hit: Optional[tuple] = None

        # Tokenized/extracted once, not once per centroid: shingles() runs the
        # full masking pipeline (5 regex passes) plus tokenizing, and
        # extract_domains() runs its own regex + urlparse pass -- text never
        # changes across this loop, so re-running either per centroid (up to
        # ~240 of them) redid that work for an identical result every time.
        msg_shingles = shingles(text) if text is not None else None
        msg_domains = extract_domains(text) if text is not None else None

        for centroid in self._centroids:
            sim = _cosine_similarity_with_norm(embedding, norm_embedding, centroid.centroid)
            if sim > best_sim:
                best_sim = sim

            profile = centroid.lexical
            lex = 0.0
            if msg_shingles is not None and profile is not None:
                lex = similarity_from_shingles(msg_shingles, profile)

                if sim >= DOMAIN_EMBEDDING_FLOOR and domains_overlap(msg_domains, profile):
                    cand = (sim, lex, centroid.cluster_id)
                    if domain_hit is None or sim > domain_hit[0]:
                        domain_hit = cand

                if sim >= HYBRID_EMBEDDING_GATE and lex >= LEXICAL_GATE:
                    cand = (sim, lex, centroid.cluster_id)
                    # Ranked by *lexical* score, not cosine: above the hybrid
                    # gate the embeddings are all within ~0.01 of each other
                    # (that is the whole thin-margin problem), so cosine cannot
                    # meaningfully separate candidates there. The wording can.
                    if hybrid_hit is None or lex > hybrid_hit[1]:
                        hybrid_hit = cand

            if sim >= self.threshold:
                if embedding_hit is None or sim > embedding_hit[0]:
                    embedding_hit = (sim, lex, centroid.cluster_id)

        for reason, hit in (
            ("domain", domain_hit),
            ("hybrid", hybrid_hit),
            ("embedding", embedding_hit),
        ):
            if hit is not None:
                sim, lex, cluster_id = hit
                return MatchResult(
                    cluster_id=cluster_id,
                    similarity=sim,
                    matched=True,
                    should_buffer=False,
                    lexical_similarity=lex,
                    match_reason=reason,
                )

        # Nothing cleared any route. Report the closest centroid's similarity
        # anyway (with no cluster_id) -- that number is what the threshold
        # calibration scripts consume.
        return MatchResult(
            cluster_id=None,
            similarity=best_sim,
            matched=False,
            should_buffer=True,
        )


def compute_centroid(embeddings):
    """Mean of a cluster's embeddings, re-normalized to unit length.

    Re-normalizing matters: the average of several unit vectors is generally
    *not* unit length, and leaving it un-normalized would quietly bias
    similarity scores against tightly-packed clusters.
    """
    import numpy as np

    arr = np.asarray(embeddings, dtype="float32")
    if arr.ndim == 1:
        arr = arr.reshape(1, -1)
    mean = arr.mean(axis=0)
    norm = float(np.linalg.norm(mean))
    if norm == 0.0:
        return mean
    return mean / norm


def build_matcher_from_clusters(
    embeddings,
    cluster_labels: Sequence[int],
    threshold: float = DEFAULT_SIMILARITY_THRESHOLD,
    texts: Optional[Sequence[str]] = None,
) -> CampaignMatcher:
    """Build a matcher from an HDBSCAN result.

    ``cluster_labels`` follows sklearn's convention where ``-1`` means noise
    (not part of any cluster) -- those are skipped, since noise points are by
    definition not a campaign.

    ``texts`` are the message bodies in the same order as ``embeddings``. When
    supplied, each cluster also gets a lexical profile built from its members,
    enabling the corroborated tiers; when omitted the matcher is
    embedding-only, which is the pre-WBS-5.3.6 behaviour.
    """
    import numpy as np

    arr = np.asarray(embeddings, dtype="float32")
    centroids: List[CampaignCentroid] = []
    by_cluster: Dict[int, List[int]] = {}
    for idx, cid in enumerate(cluster_labels):
        if cid == -1:
            continue
        by_cluster.setdefault(int(cid), []).append(idx)

    for cid, idxs in sorted(by_cluster.items()):
        profile: Optional[LexicalProfile] = None
        if texts is not None:
            members = [texts[i] for i in idxs if i < len(texts)]
            domains = {d for t in members for d in extract_domains(t)}
            profile = build_profile(members, domains=domains)
        centroids.append(
            CampaignCentroid(
                cluster_id=str(cid),
                centroid=compute_centroid(arr[idxs]),
                url_domains=sorted(profile.domains) if profile else [],
                lexical=profile,
            )
        )
    return CampaignMatcher(centroids, threshold=threshold)
