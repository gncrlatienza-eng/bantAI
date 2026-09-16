"""Retrain trigger endpoint (Sprint 4, WBS 4.4.3).

The backend's hourly cron (``retraining.service.ts``) POSTs here when one of
its three trigger conditions fires. This service has no GPU -- training runs
on Colab -- so ``POST /retrain`` does not train anything. It accepts the
request, records it, and returns immediately. See ``service/retrain_queue.py``
for why that is the honest design rather than a corner cut, and
``RETRAINING.md`` § Stage 5 for the full round trip this closes.

``GET /retrain/jobs`` exists because a queue nothing can read is exactly as
invisible as the 404 it replaces -- it is what the automated round-trip test
(``tests/test_round_trip.py``) and a human draining the queue both use to
see what is waiting.

``POST /retrain/jobs/{job_id}/complete`` closes the loop: without it "queued"
was a status nothing could ever leave, so the dedupe in ``retrain_queue``
handed the same stale job to every later trigger and no new work was ever
scheduled (Reymark's audit, items 4-6). ``scripts/retrain.py --complete-queue``
is the usual caller; this route exists so a drain on a different host than the
queue file can still record itself.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..config import settings
from ..retrain_queue import QueueFullError, complete, enqueue, list_jobs
from ..schemas import RetrainJobList, RetrainJobResponse, RetrainRequest

router = APIRouter(tags=["retraining"])


@router.post("/retrain", response_model=RetrainJobResponse, status_code=202)
def retrain(req: RetrainRequest) -> RetrainJobResponse:
    try:
        job = enqueue(settings.retrain_queue_path, req.trigger)
    except QueueFullError as exc:
        # 503, not 500: the request is valid and the caller should retry once
        # the backlog is drained. The cron re-fires hourly, so a refusal here
        # loses nothing -- the trigger condition is still true next hour.
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc
    return RetrainJobResponse(**job.__dict__)


@router.get("/retrain/jobs", response_model=RetrainJobList)
def retrain_jobs() -> RetrainJobList:
    return RetrainJobList(jobs=[RetrainJobResponse(**j.__dict__) for j in list_jobs(settings.retrain_queue_path)])


@router.post("/retrain/jobs/{job_id}/complete", response_model=RetrainJobResponse)
def complete_retrain_job(job_id: str) -> RetrainJobResponse:
    job = complete(settings.retrain_queue_path, job_id)
    if job is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No queued job {job_id!r} (unknown id, or already completed).",
        )
    return RetrainJobResponse(**job.__dict__)
