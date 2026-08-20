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
"""

from __future__ import annotations

from fastapi import APIRouter

from ..config import settings
from ..retrain_queue import enqueue, list_jobs
from ..schemas import RetrainJobList, RetrainJobResponse, RetrainRequest

router = APIRouter(tags=["retraining"])


@router.post("/retrain", response_model=RetrainJobResponse, status_code=202)
def retrain(req: RetrainRequest) -> RetrainJobResponse:
    job = enqueue(settings.retrain_queue_path, req.trigger)
    return RetrainJobResponse(**job.__dict__)


@router.get("/retrain/jobs", response_model=RetrainJobList)
def retrain_jobs() -> RetrainJobList:
    return RetrainJobList(jobs=[RetrainJobResponse(**j.__dict__) for j in list_jobs(settings.retrain_queue_path)])
