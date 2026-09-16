"""Inbound API-key check for the ML service (Reymark's audit, item 7).

Every route here does real work on request: a forward pass through a
250M-parameter model, a TF-IDF summarisation, a write to the retrain queue.
Until now nothing authenticated the caller, so anything that could reach the
port could spend that work. On a laptop only the local backend can, which is
why this is opt-in rather than mandatory -- but "only the backend can reach
it" is a property of the deployment, not of the code, and Sprint 6 changes
the deployment.

Set ``BANTAI_AI_SERVICE_API_KEY`` and callers must send the same value as
``x-api-key``. Leave it unset and the service behaves exactly as before, with
a warning logged at startup (``main.py``) so an unprotected deployment is
visible rather than silent.

Mirrors the backend's own ``ApiKeyGuard`` (``x-api-key`` against
``INTERNAL_API_KEY``) so the two sides of the fence use one convention. The
key is compared with :func:`hmac.compare_digest`, not ``==``: string equality
returns as soon as two characters differ, which leaks the length of the
matching prefix to anyone who can time the response.
"""

from __future__ import annotations

import hmac
from typing import Optional

from fastapi import Header, HTTPException, status

from .config import settings


def require_api_key(x_api_key: Optional[str] = Header(default=None)) -> None:
    """FastAPI dependency: 401 unless the caller presents the configured key.

    A no-op when ``service_api_key`` is empty, which is the documented local
    default.
    """
    expected = settings.service_api_key
    if not expected:
        return
    if not x_api_key or not hmac.compare_digest(x_api_key, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API key.",
        )
