"""The queue ``POST /retrain`` writes to (Sprint 4, WBS 4.4.3).

The backend's hourly cron (``backend/src/retraining/retraining.service.ts``)
posts here when a trigger condition fires. This service has no GPU and
training runs on Colab, so the endpoint cannot train anything -- it can only
record that a retrain was asked for, honestly, and let a human drain the
queue with ``scripts/retrain.py``.

Before this module existed the backend's call had nowhere to land: the
service registered no ``/retrain`` route, the call 404d, and
``retraining.service.ts`` caught it as a warning -- *"AI service may not have
the /retrain endpoint yet"*. The hourly trigger has never once been
observable from either side. This makes it observable, not automatic.

Append-only JSONL rather than a database: there is no database on this side
of the fence (``service/`` talks to the backend, it does not have one of its
own), and a queue a human reads with ``GET /retrain/jobs`` and drains by hand
does not need transactions.

**Deduping matters.** The cron's trigger conditions stay true until a model
is actually promoted -- nothing here changes that state -- so an undeduped
queue grows one row per hour, forever, from the first day this ships. A
repeat of the same trigger while a job for it is still ``queued`` returns the
existing job instead of writing a new one.
"""

from __future__ import annotations

import json
import os
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import List


@dataclass(frozen=True)
class RetrainJob:
    job_id: str
    trigger: str
    status: str  # "queued" is the only status written here; a human resolves
    #             the job out-of-band and the row is not updated in place --
    #             see the module docstring on why this stays append-only.
    requested_at: str


def _read_jobs(path: str) -> List[RetrainJob]:
    if not os.path.isfile(path):
        return []
    jobs: List[RetrainJob] = []
    with open(path, encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if line:
                jobs.append(RetrainJob(**json.loads(line)))
    return jobs


def _append_job(path: str, job: RetrainJob) -> None:
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "a", encoding="utf-8") as handle:
        handle.write(json.dumps(asdict(job)) + "\n")


def enqueue(path: str, trigger: str) -> RetrainJob:
    """Record a retrain request, or return the already-queued job for it.

    Dedupe key is ``(trigger, status == "queued")`` rather than just
    ``trigger``: once a human has drained a job (status no longer
    ``queued``), a fresh trigger of the same kind is a new, legitimate
    request and should queue again.
    """
    for job in _read_jobs(path):
        if job.trigger == trigger and job.status == "queued":
            return job
    job = RetrainJob(
        job_id=str(uuid.uuid4()),
        trigger=trigger,
        status="queued",
        requested_at=datetime.now(timezone.utc).isoformat(),
    )
    _append_job(path, job)
    return job


def list_jobs(path: str) -> List[RetrainJob]:
    return _read_jobs(path)
