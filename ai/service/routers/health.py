"""Health / readiness endpoint."""

from __future__ import annotations

from fastapi import APIRouter

from ..classifier import classifier
from ..schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness probe; ``model_ready`` reports whether weights are available."""
    return HealthResponse(model_ready=bool(classifier and classifier.is_ready()))
