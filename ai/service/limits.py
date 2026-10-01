"""Request-size and concurrency limits for expensive AI routes."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse


class WorkLimitMiddleware(BaseHTTPMiddleware):
    """Reject oversized or excess work before model/tokenizer allocation."""

    _WORK_PREFIXES = ("/classify", "/summarize", "/retrain")

    def __init__(self, app, *, max_body_bytes: int, max_concurrent: int):
        super().__init__(app)
        self.max_body_bytes = max(1, max_body_bytes)
        self.max_concurrent = max(1, max_concurrent)
        self._active = 0
        self._lock = asyncio.Lock()

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        if request.method not in {"POST", "PUT", "PATCH"} or not request.url.path.startswith(self._WORK_PREFIXES):
            return await call_next(request)

        raw_length = request.headers.get("content-length")
        if raw_length:
            try:
                declared_length = int(raw_length)
                if declared_length < 0:
                    raise ValueError("negative Content-Length")
            except ValueError:
                return JSONResponse(
                    status_code=400,
                    content={"detail": "Invalid Content-Length header."},
                )
            if declared_length > self.max_body_bytes:
                return self._too_large()

        # Content-Length is only a cheap early rejection. Count the bytes we
        # actually receive as well: a proxy or client can supply a false size,
        # and a chunked or bodyless POST (``/retrain/jobs/{id}/complete``) has
        # none. Buffering stops at the cap, so neither case is unbounded.
        chunks: list[bytes] = []
        actual_length = 0
        async for chunk in request.stream():
            actual_length += len(chunk)
            if actual_length > self.max_body_bytes:
                return self._too_large()
            chunks.append(chunk)
        request._body = b"".join(chunks)

        async with self._lock:
            if self._active >= self.max_concurrent:
                return JSONResponse(
                    status_code=503,
                    headers={"Retry-After": "1"},
                    content={"detail": "AI service is at its concurrency limit."},
                )
            self._active += 1
        try:
            return await call_next(request)
        finally:
            async with self._lock:
                self._active -= 1

    @staticmethod
    def _too_large() -> JSONResponse:
        return JSONResponse(
            status_code=413,
            content={"detail": "Request body is too large."},
        )
