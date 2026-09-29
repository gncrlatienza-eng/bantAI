"""BantAI ML inference service (FastAPI).

Run locally from the ``ai/`` directory:

    uvicorn service.main:app --reload --port 8001

Interactive docs are served at ``/docs``.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI

# Absolute, not relative: these live in the sibling `retraining` package, not
# under `service`. Reading the backend's `/models/active` from here is the
# one place `service/` depends on `retraining/` -- read-only, plain stdlib,
# no pydantic crossing the boundary. See `registry.py`'s module docstring.
from retraining.registry import ModelRegistry, ModelRegistryError
from retraining.version_file import IntegrityResult, read_version, verify_version

from .auth import require_api_key
from .campaign import CampaignMatcher
from .campaign_space import CampaignSpace, labels_of, resolve_space
from .centroid_source import load_centroids
from .config import settings
from .routers import classify, health, retrain, summarize

logger = logging.getLogger(__name__)


def warm_up_model() -> None:
    """Load the model and run one prediction before the service takes traffic.

    The classifier loads lazily, so without this the first /classify after
    every restart pays the full load: measured 12.2 s on 2026-09-21, against
    the backend's 3.5 s timeout -- the first real SMS after a restart would
    always fall back to the phone's keyword check. Non-fatal, like the other
    startup steps: with no model installed the service still starts and
    /classify keeps answering 503.
    """
    if not classify.classifier._has_weights():
        logger.warning("No model installed; skipping warm-up. /classify will answer 503.")
        return
    try:
        classify.classifier.classify_full("warm-up")
    except Exception:  # noqa: BLE001 -- a failed warm-up must not stop the service
        logger.exception("Model warm-up failed; the first /classify will retry the load.")


def load_campaign_centroids(served_model_version: str | None, model_integrity: IntegrityResult) -> None:
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
        backend_api_key=settings.campaigns_api_key,
    )

    # Campaign centroids are model-space artifacts. Classification may remain
    # available when model provenance is incomplete, but campaign matching must
    # not: applying centroids or a campaign transform to unknown/tampered
    # weights can produce confident matches to the wrong campaign.
    if centroids and (not served_model_version or model_integrity.status != "ok"):
        reason = (
            "the served model has no version identity"
            if not served_model_version
            else f"checkpoint integrity is {model_integrity.status}: {model_integrity.detail}"
        )
        logger.error(
            "CAMPAIGN MODEL IDENTITY MISMATCH: %s. Campaign matching is DISABLED -- classification remains available.",
            reason,
        )
        classify.matcher = CampaignMatcher([])
        return

    # Item 19: centroids may live in a transformed space (their labels say
    # which). Comparing a raw embedding against transformed centroids -- or
    # against a space fitted on a different model -- produces confident
    # nonsense, so any mismatch switches matching off rather than running it.
    space = _load_campaign_space() if centroids else None
    enabled, space, reason = resolve_space(
        labels_of(centroids),
        space,
        served_model_version,
        centroid_vectors=[c.centroid for c in centroids],
    )
    if not enabled:
        logger.error(
            "CAMPAIGN SPACE MISMATCH: %s. Campaign matching is DISABLED -- every "
            "message will report no campaign until the centroids and %s agree.",
            reason,
            settings.campaign_space_file,
        )
        classify.matcher = CampaignMatcher([])
        return
    classify.matcher = CampaignMatcher(centroids, threshold=settings.campaign_threshold, space=space)

    if centroids:
        logger.info(
            "Loaded %d campaign centroids from %s (%s)",
            len(centroids),
            settings.centroid_source,
            reason,
        )
    else:
        # Logged loudly: an unnoticed zero looks identical to "no campaigns
        # exist yet", and silently degrading to that is exactly the bug this
        # startup hook exists to prevent.
        hint = (
            "BANTAI_AI_CAMPAIGNS_API_KEY is unset -- /campaigns/centroids is "
            "ApiKeyGuard-protected and answers 401 without it"
            if settings.centroid_source == "backend" and not settings.campaigns_api_key
            else "Run scripts/cluster_campaigns.py, or check BANTAI_AI_CENTROID_SOURCE"
        )
        logger.warning(
            "No campaign centroids loaded (source=%s). Campaign matching is "
            "inactive -- every message will report no campaign. %s.",
            settings.centroid_source,
            hint,
        )


def _load_campaign_space():
    """The campaign space file, or None when absent or unreadable (logged)."""
    try:
        return CampaignSpace.load(settings.campaign_space_file)
    except FileNotFoundError:
        return None
    except (OSError, ValueError, KeyError, TypeError) as exc:
        logger.error("Could not read campaign space %s: %s", settings.campaign_space_file, exc)
        return None


def check_served_version(served: str | None, integrity: IntegrityResult) -> None:
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
    # Does the checkpoint on disk still hash to what version.json recorded?
    # Logged, never fatal: a model whose files changed under it is still a
    # working classifier on a user's phone, and refusing to serve would turn a
    # bookkeeping problem into an outage. But it must be visible, or every
    # number this service produces is attributed to a checkpoint that may not
    # be the one that produced it (Reymark's audit, item 13).
    if integrity.status == "mismatch":
        logger.error(
            "CHECKPOINT INTEGRITY: %s no longer matches the digests recorded for %s -- %s. "
            "The served model is not the one this version tag was written for.",
            settings.model_dir,
            served or "(untracked)",
            integrity.detail,
        )
    elif integrity.status == "unverifiable":
        logger.info("Checkpoint integrity not verifiable: %s.", integrity.detail)

    if not settings.version_check_enabled:
        return
    if not settings.models_api_key:
        logger.info("Version check skipped: BANTAI_AI_MODELS_API_KEY is unset.")
        return

    try:
        registry = ModelRegistry(settings.backend_url, settings.models_api_key)
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
    if not settings.service_api_key:
        logger.warning(
            "No inbound authentication: BANTAI_AI_SERVICE_API_KEY is unset, so "
            "/classify, /summarize and /retrain accept any caller that can "
            "reach this port. Fine on a laptop; set it before exposing this "
            "service beyond the backend."
        )
    served = read_version(settings.model_dir)
    integrity = verify_version(settings.model_dir)
    check_served_version(served, integrity)
    load_campaign_centroids(served, integrity)
    warm_up_model()
    yield


app = FastAPI(
    title="BantAI ML Service",
    version="0.1.0",
    description="SMS smishing classification pipeline (XLM-RoBERTa).",
    lifespan=lifespan,
)

# /health and / stay open: a health check that needs a secret is useless to
# whatever is deciding whether this process is alive. Everything else does
# real work per request and is gated -- see service/auth.py.
app.include_router(health.router)
app.include_router(classify.router, dependencies=[Depends(require_api_key)])
app.include_router(summarize.router, dependencies=[Depends(require_api_key)])
app.include_router(retrain.router, dependencies=[Depends(require_api_key)])


@app.get("/", tags=["health"])
def root() -> dict:
    return {"service": "bantai-ml", "version": app.version, "docs": "/docs"}
