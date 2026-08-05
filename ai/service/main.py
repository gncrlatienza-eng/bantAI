"""BantAI ML inference service (FastAPI).

Run locally from the ``ai/`` directory:

    uvicorn service.main:app --reload --port 8001

Interactive docs are served at ``/docs``.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

from .campaign import CampaignMatcher
from .centroid_source import load_centroids
from .config import settings
from .routers import classify, health, summarize

logger = logging.getLogger(__name__)


def load_campaign_centroids() -> None:
    """Populate the campaign matcher before serving traffic.

    Without this the matcher stays empty and every message reports "no
    campaign" regardless of how many campaigns have actually been discovered
    -- the matching logic works, but has nothing to match against.

    Failure is non-fatal by design: campaign intelligence is an enhancement on
    top of classification, so a missing or unreadable centroid source must not
    stop the service from classifying messages.
    """
    centroids = load_centroids(
        source=settings.centroid_source,
        cluster_file=settings.cluster_file,
        backend_url=settings.backend_url,
    )
    classify.matcher = CampaignMatcher(
        centroids, threshold=settings.campaign_threshold
    )

    if centroids:
        logger.info(
            "Loaded %d campaign centroids from %s",
            len(centroids),
            settings.centroid_source,
        )
    else:
        # Logged loudly: an unnoticed zero looks identical to "no campaigns
        # exist yet", and silently degrading to that is exactly the bug this
        # startup hook exists to prevent.
        logger.warning(
            "No campaign centroids loaded (source=%s). Campaign matching is "
            "inactive -- every message will report no campaign. Run "
            "scripts/cluster_campaigns.py, or check BANTAI_AI_CENTROID_SOURCE.",
            settings.centroid_source,
        )


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Load campaign centroids once, before the service accepts traffic."""
    load_campaign_centroids()
    yield


app = FastAPI(
    title="BantAI ML Service",
    version="0.1.0",
    description="SMS smishing classification pipeline (XLM-RoBERTa).",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(classify.router)
app.include_router(summarize.router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {"service": "bantai-ml", "version": app.version, "docs": "/docs"}
