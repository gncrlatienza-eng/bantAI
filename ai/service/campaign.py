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
#     0.85               100.0%            54.5%   <- manuscript
#     0.99               100.0%            30.5%
#     0.999               93.8%             2.6%   <- selected
#     0.9995              87.9%             0.5%
#
# 0.999 is the knee: stricter costs 6pp of real campaign members to save 2pp of
# false attachments. At 0.85 the feature was attaching a majority of unrelated
# messages to campaigns, which is worse than not grouping at all -- a user told
# "this is part of a known campaign" learns nothing if it is a coin flip.
#
# ⚠️ The margin is narrow by construction: members sit at ~0.9998 and the
# threshold at 0.999. That is a property of reusing a classifier embedding for
# similarity, not of this particular number, and it is the strongest argument
# for giving campaign matching its own representation. See PIPELINE.md
# "Stage 5b -- measured limits" and scripts/compare_campaign_embeddings.py.
DEFAULT_SIMILARITY_THRESHOLD = 0.999


def cosine_similarity(a, b) -> float:
    """Cosine similarity between two vectors.

    ``service.embeddings`` L2-normalizes everything it produces, so for those
    vectors this is just a dot product. The explicit norm division is kept so
    the function stays correct if handed un-normalized input (e.g. a centroid
    someone averaged without re-normalizing).
    """
    import numpy as np

    a = np.asarray(a, dtype="float32")
    b = np.asarray(b, dtype="float32")
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
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


@dataclass
class MatchResult:
    """Outcome of matching one message against the active centroids."""

    cluster_id: Optional[str]
    similarity: float
    matched: bool
    #: True when nothing cleared the threshold, so the embedding should be
    #: buffered for the next offline HDBSCAN pass (manuscript Stage 5b).
    should_buffer: bool

    def to_dict(self) -> dict:
        return {
            "cluster_id": self.cluster_id,
            "similarity": round(self.similarity, 4),
            "matched": self.matched,
            "should_buffer": self.should_buffer,
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

    def match(self, embedding) -> MatchResult:
        """Find the best-matching active campaign for one embedding.

        With no active clusters yet (cold start), everything buffers -- which
        is correct: campaigns can only be discovered by the offline pass once
        enough unmatched messages accumulate.
        """
        if not self._centroids:
            return MatchResult(
                cluster_id=None, similarity=0.0, matched=False, should_buffer=True
            )

        # Seeded below -1 (cosine's floor) rather than at 0, so a genuinely
        # negative best similarity is reported honestly instead of being
        # rounded up to 0.0 -- the reported number is used for threshold
        # tuning, so it has to be the real one.
        best_id: Optional[str] = None
        best_sim = -2.0

        for centroid in self._centroids:
            sim = cosine_similarity(embedding, centroid.centroid)
            if sim > best_sim:
                best_sim, best_id = sim, centroid.cluster_id

        matched = best_sim >= self.threshold
        return MatchResult(
            cluster_id=best_id if matched else None,
            similarity=best_sim,
            matched=matched,
            should_buffer=not matched,
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
) -> CampaignMatcher:
    """Build a matcher from an HDBSCAN result.

    ``cluster_labels`` follows sklearn's convention where ``-1`` means noise
    (not part of any cluster) -- those are skipped, since noise points are by
    definition not a campaign.
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
        centroids.append(
            CampaignCentroid(
                cluster_id=str(cid),
                centroid=compute_centroid(arr[idxs]),
            )
        )
    return CampaignMatcher(centroids, threshold=threshold)
