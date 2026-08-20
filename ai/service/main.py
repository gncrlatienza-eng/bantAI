"""BantAI ML inference service (FastAPI).

Run locally from the ``ai/`` directory:

    uvicorn service.main:app --reload --port 8001

Interactive docs are served at ``/docs``.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI

# Absolute, not relative: these live in the sibling `retraining` package, not
# under `service`. Reading the backend's `/models/active` from here is the
# one place `service/` depends on `retraining/` -- read-only, plain stdlib,
# no pydantic crossing the boundary. See `registry.py`'s module docstring.
from retraining.registry import ModelRegistry, ModelRegistryError
from retraining.version_file import read_version

from .campaign import CampaignMatcher
from .centroid_source import load_centroids
from .config import settings
from .routers import classify, health, retrain, summarize

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
        backend_api_key=settings.backend_api_key,
    )
    classify.matcher = CampaignMatcher(centroids, threshold=settings.campaign_threshold)

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
        hint = (
            "BANTAI_AI_BACKEND_API_KEY is unset -- /campaigns/centroids is "
            "ApiKeyGuard-protected and answers 401 without it"
            if settings.centroid_source == "backend" and not settings.backend_api_key
            else "Run scripts/cluster_campaigns.py, or check BANTAI_AI_CENTROID_SOURCE"
        )
        logger.warning(
            "No campaign centroids loaded (source=%s). Campaign matching is "
            "inactive -- every message will report no campaign. %s.",
            settings.centroid_source,
            hint,
        )


def check_served_version() -> None:
    """Compare what this service is actually serving against what the
    backend's ``ModelVersions`` thinks is active (WBS 4.4.3).

    Non-fatal by design, same reasoning as :func:`load_campaign_centroids`
    above: a stale or unregistered version record must not stop the service
    from classifying messages. But logged loudly, because "the served
    checkpoint silently drifted from what ModelVersions records" is exactly
    the kind of gap that looks fine right up until someone asks which model
    actually produced a given classification.

    Every checkpoint deployed before this existed -- including the one
    currently live -- has no ``version.json``, so ``served`` reads ``None``
    and this logs a one-time "not yet tracked" notice rather than a mismatch.
    """
    served = read_version(settings.model_dir)

    if not settings.version_check_enabled:
        return
    if not settings.backend_api_key:
        logger.info("Version check skipped: BANTAI_AI_BACKEND_API_KEY is unset.")
        return

    try:
        registry = ModelRegistry(settings.backend_url, settings.backend_api_key)
        active = registry.get_active()
    except ModelRegistryError as exc:
        logger.warning("Could not reach the backend to verify the served model version: %s", exc)
        return

    active_tag = (active or {}).get("versionTag")

    if served is None:
        logger.info(
            "Serving an untracked checkpoint (no version.json in %s) -- "
            "predates WBS 4.4.3, including the currently deployed model. "
            "Backend's active version: %s.",
            settings.model_dir,
            active_tag or "(none registered)",
        )
    elif active_tag is None:
        logger.info("Serving version %s; the backend has no active ModelVersion registered yet.", served)
    elif served != active_tag:
        logger.warning(
            "VERSION MISMATCH: serving %s but the backend's active ModelVersion is %s. "
            "Either this host was not restarted after the last promotion, or the backend "
            "record is stale.",
            served,
            active_tag,
        )
    else:
        logger.info("Serving version %s, matching the backend's active ModelVersion.", served)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Load campaign centroids and verify the served model version once,
    before the service accepts traffic."""
    load_campaign_centroids()
    check_served_version()
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
app.include_router(retrain.router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {"service": "bantai-ml", "version": app.version, "docs": "/docs"}
