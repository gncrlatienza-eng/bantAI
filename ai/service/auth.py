"""Inbound API-key check for the ML service (Reymark's audit, item 7).

Every route here does real work on request: a forward pass through a
250M-parameter model, a TF-IDF summarisation, a write to the retrain queue.
Until now nothing authenticated the caller, so anything that could reach the
port could spend that work.

Set ``BANTAI_AI_SERVICE_API_KEY`` and callers must send the same value as
``x-api-key``. The key is required everywhere except an explicit local
opt-out: ``BANTAI_AI_ENVIRONMENT`` of local or test **and**
``BANTAI_AI_ALLOW_UNAUTHENTICATED_DEV=true`` (audit 2026-09-30, finding 1).
Without that opt-out the service refuses to start (:func:`enforce_inbound_auth_policy`,
called from ``main.py``'s lifespan) and, as a second line of defence, every
gated request fails closed with 503 rather than running unauthenticated.

Mirrors the backend's own ``ApiKeyGuard`` (``x-api-key`` against
``INTERNAL_API_KEY``) so the two sides of the fence use one convention. The
key is compared with :func:`hmac.compare_digest`, not ``==``: string equality
returns as soon as two characters differ, which leaks the length of the
matching prefix to anyone who can time the response.
"""

from __future__ import annotations

import hmac
import logging
from typing import Optional

from fastapi import Header, HTTPException, status

from .config import settings

logger = logging.getLogger(__name__)

#: Environments where running without a key may be explicitly allowed.
LOCAL_ENVIRONMENTS = frozenset({"local", "test"})

#: Shortest key accepted outside local environments. Matches the length of a
#: ``openssl rand -hex 16`` secret; anything shorter is guessable in practice.
MIN_PRODUCTION_KEY_LENGTH = 32


def _environment() -> str:
    return settings.environment.strip().lower()


def is_local_environment() -> bool:
    return _environment() in LOCAL_ENVIRONMENTS


def unauthenticated_allowed() -> bool:
    """True only for an explicit, local opt-out from inbound authentication."""
    return is_local_environment() and settings.allow_unauthenticated_dev


def enforce_inbound_auth_policy() -> None:
    """Refuse to start when inbound authentication is missing or too weak.

    Raises :class:`RuntimeError` so uvicorn exits during startup instead of
    serving /classify, /summarize and /retrain to any caller on the network.
    """
    key = settings.service_api_key.strip()
    if key:
        if not is_local_environment() and len(key) < MIN_PRODUCTION_KEY_LENGTH:
            raise RuntimeError(
                f"BANTAI_AI_SERVICE_API_KEY must be at least {MIN_PRODUCTION_KEY_LENGTH} "
                f"characters when BANTAI_AI_ENVIRONMENT={_environment() or '(empty)'}."
            )
        return
    if unauthenticated_allowed():
        logger.warning(
            "No inbound authentication: BANTAI_AI_SERVICE_API_KEY is unset and "
            "BANTAI_AI_ALLOW_UNAUTHENTICATED_DEV=true, so /classify, /summarize and "
            "/retrain accept any caller that can reach this port. Bind to a trusted "
            "local interface only."
        )
        return
    raise RuntimeError(
        "BANTAI_AI_SERVICE_API_KEY is required (BANTAI_AI_ENVIRONMENT="
        f"{_environment() or '(empty)'}). Set it to the backend's AI_SERVICE_API_KEY, "
        "or, for local development only, set BANTAI_AI_ENVIRONMENT=local and "
        "BANTAI_AI_ALLOW_UNAUTHENTICATED_DEV=true."
    )


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency: 401 unless the caller presents the configured key.

    With no key configured, only the explicit local opt-out lets a request
    through; anything else fails closed with 503.
    """
    expected = settings.service_api_key
    if not expected.strip():
        if unauthenticated_allowed():
            return
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Inbound authentication is not configured.",
        )
    if not x_api_key or not hmac.compare_digest(x_api_key.encode(), expected.encode()):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
