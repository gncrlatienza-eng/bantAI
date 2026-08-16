"""Loading campaign centroids into the live matcher (Sprint 3, WBS 3.3.4).

``CampaignMatcher`` can compare a message against known campaigns, but
something has to *give* it those campaigns first. Without this module the
service boots with an empty matcher and reports "no campaign" for every
message forever -- the matching logic is correct but never has anything to
match against.

Two sources, in priority order:

1. **Backend** (``GET /campaigns/centroids``) -- the production path, and now
   the default. Resolved 2026-07-31 (Reymark, commit ``5dd8e30``): a
   dedicated internal route was added rather than widening the general
   ``GET /campaigns`` list -- it returns just ``{id, centroid}`` per active
   cluster, since a centroid is 768 floats and every mobile/dashboard client
   also calls the general list.
2. **Local file** (``datasets/processed/campaign_clusters.json``, produced by
   ``scripts/cluster_campaigns.py``) -- the no-backend, no-database bootstrap
   path. Still available via ``BANTAI_AI_CENTROID_SOURCE=file`` for local dev
   without a running backend.
"""

from __future__ import annotations

import json
import os
from typing import List, Optional

from .campaign import CampaignCentroid
from .lexical import LexicalProfile

#: Where cluster_campaigns.py writes its results.
DEFAULT_CLUSTER_FILE = os.path.join("datasets", "processed", "campaign_clusters.json")


def load_from_file(path: str = DEFAULT_CLUSTER_FILE) -> List[CampaignCentroid]:
    """Read centroids from a ``cluster_campaigns.py`` run.

    Returns an empty list when the file is missing rather than raising -- a
    service with no campaigns yet is a valid cold-start state, not an error.
    """
    if not os.path.isfile(path):
        return []

    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    out: List[CampaignCentroid] = []
    for cluster in data.get("clusters", []):
        centroid = cluster.get("centroid")
        if not centroid:
            continue
        out.append(
            CampaignCentroid(
                cluster_id=str(cluster["cluster_id"]),
                centroid=centroid,
                label=cluster.get("label"),
                url_domains=list(cluster.get("top_domains", [])),
                # ``from_dict`` returns None for clusters written before WBS
                # 5.3.6, which is the correct degradation: those campaigns
                # match on the embedding alone, exactly as they did before.
                lexical=LexicalProfile.from_dict(cluster.get("lexical")),
            )
        )
    return out


def load_from_backend(base_url: str, timeout: float = 5.0) -> List[CampaignCentroid]:
    """Fetch active campaign centroids from the NestJS backend.

    Hits the dedicated ``/campaigns/centroids`` route (not the general
    ``/campaigns`` list, which omits the centroid field). Clusters that
    arrive without a centroid are skipped rather than crashing the service.

    ⚠️ The ``lexical`` field is read here but the backend does not store it
    yet -- ``CampaignCluster`` has no such column (see
    ``backend/database/prisma/schema.prisma``). Until that migration lands,
    the backend path silently yields embedding-only campaigns while the file
    path gets the hybrid tiers. Reading the field now means no second AI-side
    change is needed once the column exists.
    """
    import urllib.request

    url = base_url.rstrip("/") + "/campaigns/centroids"
    with urllib.request.urlopen(url, timeout=timeout) as resp:  # noqa: S310
        payload = json.loads(resp.read().decode("utf-8"))

    out: List[CampaignCentroid] = []
    for cluster in payload:
        centroid = cluster.get("centroid")
        if not centroid:
            continue
        out.append(
            CampaignCentroid(
                cluster_id=str(cluster["id"]),
                centroid=centroid,
                label=cluster.get("label"),
                url_domains=list(cluster.get("urlDomains", [])),
                lexical=LexicalProfile.from_dict(cluster.get("lexical")),
            )
        )
    return out


def load_centroids(
    source: str,
    cluster_file: str = DEFAULT_CLUSTER_FILE,
    backend_url: Optional[str] = None,
) -> List[CampaignCentroid]:
    """Load centroids from the configured source.

    Never raises: campaign matching is an enhancement, so a failure here must
    degrade to "no campaigns known" rather than take down classification. The
    caller logs how many were loaded so an unnoticed zero is still visible.
    """
    try:
        if source == "backend" and backend_url:
            return load_from_backend(backend_url)
        if source == "none":
            return []
        return load_from_file(cluster_file)
    except Exception:  # noqa: BLE001 -- see docstring
        return []
