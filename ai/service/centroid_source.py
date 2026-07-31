"""Loading campaign centroids into the live matcher (Sprint 3, WBS 3.3.4).

``CampaignMatcher`` can compare a message against known campaigns, but
something has to *give* it those campaigns first. Without this module the
service boots with an empty matcher and reports "no campaign" for every
message forever -- the matching logic is correct but never has anything to
match against.

Two sources, in priority order:

1. **Backend** (``GET /campaigns``) -- the production path. Currently
   **disabled by default**, see the blocker below.
2. **Local file** (``datasets/processed/campaign_clusters.json``, produced by
   ``scripts/cluster_campaigns.py``) -- works today with no backend and no
   database, which is why it is the default.

----------------------------------------------------------------------------
BLOCKER for the backend path (Track A / Reymark) -- 2026-07-30
----------------------------------------------------------------------------
``backend/src/campaigns/campaigns.service.ts:findAll()`` uses an explicit
``select`` that omits ``centroid``:

    select: { id, label, urlDomains, isActive, messageCount, createdAt, updatedAt }

The centroid is the one field this module actually needs -- it is the vector
the cosine comparison runs against. ``CampaignCluster.centroid`` already
exists in the Prisma schema and ``create()`` already accepts it; only the read
path drops it.

Fix is one line -- add ``centroid: true`` to that select. Worth noting the
field is large (768 floats per cluster), so if ``GET /campaigns`` is also what
the mobile app and dashboard call, better to add a separate internal route
(e.g. ``GET /campaigns/centroids``) than to fatten the list every client
already fetches.

Once that lands, set ``BANTAI_AI_CENTROID_SOURCE=backend`` and
``BANTAI_AI_BACKEND_URL=...`` -- the code below is written and tested, just
switched off.
"""

from __future__ import annotations

import json
import os
from typing import List, Optional

from .campaign import CampaignCentroid

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
            )
        )
    return out


def load_from_backend(
    base_url: str, timeout: float = 5.0
) -> List[CampaignCentroid]:
    """Fetch active campaign centroids from the NestJS backend.

    Written and tested, but not reachable until the backend returns the
    ``centroid`` field -- see the module docstring. Clusters that arrive
    without a centroid are skipped rather than crashing the service, so the
    day the backend starts sending them this simply begins working.
    """
    import urllib.request

    url = base_url.rstrip("/") + "/campaigns"
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
