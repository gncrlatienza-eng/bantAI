"""Health / readiness endpoint."""

from __future__ import annotations

from fastapi import APIRouter

# Absolute import -- see main.py's comment on the same dependency.
from retraining.version_file import read_version

from ..classifier import classifier
from ..config import settings
from ..schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    """Liveness probe; ``model_ready`` reports whether weights are available.

    ``version_tag`` is read fresh on every call rather than cached at
    startup -- it is a few bytes of JSON, and a stale cache would say
    nothing wrong on a redeploy that swapped ``settings.model_dir`` without
    a full process restart.
    """
    return HealthResponse(
        model_ready=bool(classifier and classifier.is_ready()),
        version_tag=read_version(settings.model_dir),
    )
