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

**The dedup check is locked, not just sequential.** ``enqueue`` reads the
file, decides whether a matching job already exists, and only then appends --
three separate steps. Without a lock around them, two ``POST /retrain`` calls
landing close enough together (FastAPI runs a sync ``def`` route in a thread
pool, so this really can happen within one process, not just across
multiple) could each see "no queued job yet" and both append, producing a
duplicate the dedup logic exists specifically to prevent. See :class:`_FileLock`.
"""

from __future__ import annotations

import json
import os
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import List


class _FileLock:
    """A tiny cross-platform advisory lock, scoped to one file path.

    Built for ``enqueue``'s small critical section rather than as a general
    utility -- ``fcntl`` is POSIX-only and ``msvcrt`` is Windows-only, so
    using either would need a platform branch and this project runs on both
    (see the Windows dev environment this was fixed on). ``os.O_CREAT |
    os.O_EXCL`` is atomic on both, needs no third-party dependency, and is
    exactly the same "exclusive create" trick ``open(..., 'x')`` uses under
    the hood.
    """

    def __init__(
        self,
        path: str,
        timeout: float = 5.0,
        poll_interval: float = 0.02,
        stale_after: float = 30.0,
    ) -> None:
        self._lock_path = path + ".lock"
        self._timeout = timeout
        self._poll_interval = poll_interval
        #: How old an existing lock file must be before it's treated as
        #: abandoned rather than genuinely held. ``enqueue``'s critical
        #: section is a few milliseconds of file I/O, so anything holding
        #: the lock this long is not a slow caller -- it's a process that
        #: crashed mid-enqueue. Deliberately much larger than ``timeout``:
        #: without this, a stale lock would make *every* future call pay the
        #: full acquire timeout forever instead of self-healing once.
        self._stale_after = stale_after
        self._fd: "int | None" = None

    def __enter__(self) -> "_FileLock":
        deadline = time.monotonic() + self._timeout
        while True:
            try:
                self._fd = os.open(self._lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
                return self
            # Windows can raise PermissionError instead of FileExistsError
            # for O_CREAT|O_EXCL against a path another thread is deleting or
            # creating at nearly the same instant (NTFS's create/delete
            # semantics have no atomic-unlink guarantee the way POSIX does) --
            # confirmed by a real flaky failure under this module's own
            # 16-thread concurrency test on this exact Windows dev machine.
            # Treated identically to "someone else holds it": retry, don't
            # let a filesystem-specific exception type escape as a crash.
            except (FileExistsError, PermissionError):
                self._clear_if_stale()
                if time.monotonic() >= deadline:
                    # Fails open rather than deadlocking a retrain trigger
                    # forever on a lock that is held but not yet stale -- a
                    # rare duplicate job is a human's minor annoyance to
                    # clean up; a cron trigger that silently stops working
                    # is worse.
                    return self
                time.sleep(self._poll_interval)

    def _clear_if_stale(self) -> None:
        try:
            age = time.time() - os.path.getmtime(self._lock_path)
        except OSError:
            return  # removed by whoever held it, or a benign race -- retry the create
        if age > self._stale_after:
            try:
                os.remove(self._lock_path)
            except OSError:
                pass  # someone else already cleared it -- also fine, retry the create

    def __exit__(self, *exc_info: object) -> None:
        if self._fd is not None:
            os.close(self._fd)
            self._fd = None
            try:
                os.remove(self._lock_path)
            except OSError:
                pass


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

    The read-check-write sequence below runs under :class:`_FileLock` so two
    overlapping calls for the same trigger cannot both see "not queued yet"
    and both append -- see the module docstring for why that is a real
    possibility, not a theoretical one.
    """
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)

    with _FileLock(path):
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
