"""Health / readiness endpoint."""

from __future__ import annotations

from dataclasses import asdict

from fastapi import APIRouter, status
from fastapi.responses import JSONResponse

from ..readiness import readiness
from ..schemas import HealthResponse, ReadyResponse
from . import classify as classify_router

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness probe; readiness is the verified startup decision."""
    report = readiness.snapshot()
    return HealthResponse(
        model_ready=report.ready,
        campaign_centroids_loaded=len(classify_router.matcher.centroids),
        version_tag=report.version_tag,
        # Only a ready model's digest is meaningful to compare against.
        bundle_digest=report.bundle_digest if report.ready else None,
    )


@router.get("/ready", response_model=ReadyResponse)
def ready() -> ReadyResponse | JSONResponse:
    """Readiness fails closed until approval, integrity, load and probe pass."""
    report = readiness.snapshot()
    payload = {
        "status": "ready" if report.ready else "not_ready",
        "model_ready": report.ready,
        **asdict(report),
    }
    # ``asdict`` includes ``ready``; keep the wire contract focused on the
    # public readiness fields instead of leaking an internal duplicate.
    payload.pop("ready", None)
    if not report.ready:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content=payload,
        )
    return ReadyResponse(**payload)
