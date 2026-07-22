"""BantAI ML inference service (FastAPI).

Run locally from the ``ai/`` directory:

    uvicorn service.main:app --reload --port 8001

Interactive docs are served at ``/docs``.
"""

from __future__ import annotations

from fastapi import FastAPI

from .routers import classify, health

app = FastAPI(
    title="BantAI ML Service",
    version="0.1.0",
    description="SMS smishing classification pipeline (XLM-RoBERTa).",
)

app.include_router(health.router)
app.include_router(classify.router)


@app.get("/", tags=["health"])
def root() -> dict:
    return {"service": "bantai-ml", "version": app.version, "docs": "/docs"}
