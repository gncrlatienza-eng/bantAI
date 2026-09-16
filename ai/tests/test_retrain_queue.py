"""Unit tests for the retrain-request queue's locking (WBS 4.4.3 follow-up).

``test_round_trip.py`` already covers ``enqueue``'s sequential dedup
behaviour (call it twice, get the same job back). This file covers the
property that only shows up under real concurrency: FastAPI runs a sync
``def`` route (``POST /retrain``) in a thread pool, so two overlapping
requests for the same trigger really can race inside one process, not just
across separate ones. Without a lock around the read-check-write sequence,
both could see "no queued job yet" and both append -- exactly the duplicate
the dedup logic exists to prevent.
"""

from __future__ import annotations

import os
import threading
import time

import pytest

from service.retrain_queue import (
    COMPLETED,
    MAX_QUEUED_JOBS,
    QUEUED,
    QueueFullError,
    _FileLock,
    complete,
    complete_all_queued,
    enqueue,
    list_jobs,
)


def test_concurrent_enqueue_of_the_same_trigger_produces_one_job(tmp_path):
    path = str(tmp_path / "queue.jsonl")
    n_threads = 16
    results: list = [None] * n_threads
    barrier = threading.Barrier(n_threads)

    def worker(i: int) -> None:
        barrier.wait()  # line every thread up so they hit enqueue() together
        results[i] = enqueue(path, "validated_report_count")

    threads = [threading.Thread(target=worker, args=(i,)) for i in range(n_threads)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    jobs = list_jobs(path)
    matching = [j for j in jobs if j.trigger == "validated_report_count" and j.status == "queued"]
    assert len(matching) == 1, f"expected exactly one queued job, got {len(matching)}: {matching}"
    # Every thread must have been handed back the same job, not a mix of the
    # real one and duplicates it never saw.
    assert all(r is not None and r.job_id == matching[0].job_id for r in results)


def test_concurrent_enqueue_of_different_triggers_each_get_their_own_job(tmp_path):
    path = str(tmp_path / "queue.jsonl")
    triggers = ["validated_report_count", "f1_drop", "page_hinkley"] * 5
    results: list = [None] * len(triggers)
    barrier = threading.Barrier(len(triggers))

    def worker(i: int, trigger: str) -> None:
        barrier.wait()
        results[i] = enqueue(path, trigger)

    threads = [threading.Thread(target=worker, args=(i, t)) for i, t in enumerate(triggers)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()

    jobs = list_jobs(path)
    queued = {j.trigger: j for j in jobs if j.status == "queued"}
    assert set(queued) == {"validated_report_count", "f1_drop", "page_hinkley"}


def test_lock_is_released_after_use(tmp_path):
    """A lock that outlives its critical section would deadlock every
    enqueue() call after the first -- confirm the .lock file is cleaned up."""
    path = str(tmp_path / "queue.jsonl")
    enqueue(path, "validated_report_count")
    assert not os.path.isfile(path + ".lock")


def test_lock_fails_open_rather_than_hanging_forever_when_genuinely_held(tmp_path):
    """A lock genuinely held (not stale) for longer than the acquire timeout
    must not hang the caller forever -- enqueue() proceeds without it rather
    than blocking a retrain trigger indefinitely. ``stale_after`` is set high
    enough that the staleness self-heal (tested below) never kicks in here,
    isolating this from that behaviour."""
    path = str(tmp_path / "queue.jsonl")
    stale_lock = path + ".lock"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    held_fd = os.open(stale_lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
    try:
        with _FileLock(path, timeout=0.05, poll_interval=0.01, stale_after=999) as lock:
            assert lock._fd is None  # gave up and proceeded rather than raising or hanging
    finally:
        os.close(held_fd)
        os.remove(stale_lock)


def test_stale_lock_self_heals_instead_of_blocking_every_future_call(tmp_path):
    """A lock file abandoned by a crashed process must not make every
    subsequent enqueue() pay the full acquire timeout forever -- once it's
    older than ``stale_after``, the next caller clears it and proceeds."""
    path = str(tmp_path / "queue.jsonl")
    stale_lock = path + ".lock"
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(stale_lock, "w").close()  # simulate a lock left behind by a crash
    time.sleep(0.05)  # let it actually age past stale_after below

    with _FileLock(path, timeout=1.0, poll_interval=0.01, stale_after=0.03) as lock:
        assert lock._fd is not None  # self-healed: acquired for real, not fail-open
    assert not os.path.isfile(stale_lock)  # released cleanly afterward too


# --- job lifecycle (Reymark's audit, items 4-6, 10) --------------------------
def test_completing_a_job_lets_the_same_trigger_queue_again(tmp_path):
    """The dedupe is only safe because a job can leave ``queued``.

    While ``queued`` was the only status this module could write, the first
    job for a trigger stayed queued forever and every later trigger was handed
    that stale job -- so a genuinely new request scheduled no new work.
    """
    path = str(tmp_path / "queue.jsonl")
    first = enqueue(path, "f1_drop")
    assert enqueue(path, "f1_drop").job_id == first.job_id  # deduped while queued

    done = complete(path, first.job_id)
    assert done.status == COMPLETED
    assert done.completed_at is not None

    second = enqueue(path, "f1_drop")
    assert second.job_id != first.job_id
    assert second.status == QUEUED


def test_list_jobs_folds_each_job_to_its_latest_status(tmp_path):
    """The file is append-only, so a completed job has two rows in it."""
    path = str(tmp_path / "queue.jsonl")
    job = enqueue(path, "page_hinkley")
    complete(path, job.job_id)

    jobs = list_jobs(path)
    assert len(jobs) == 1
    assert jobs[0].job_id == job.job_id
    assert jobs[0].status == COMPLETED


def test_completing_an_unknown_or_finished_job_returns_none(tmp_path):
    path = str(tmp_path / "queue.jsonl")
    job = enqueue(path, "f1_drop")
    complete(path, job.job_id)
    assert complete(path, job.job_id) is None  # already done
    assert complete(path, "no-such-id") is None


def test_complete_all_queued_drains_everything_outstanding(tmp_path):
    """One retrain answers every trigger outstanding at the time."""
    path = str(tmp_path / "queue.jsonl")
    for trigger in ("f1_drop", "page_hinkley", "validated_report_count"):
        enqueue(path, trigger)

    drained = complete_all_queued(path)

    assert len(drained) == 3
    assert not [j for j in list_jobs(path) if j.status == QUEUED]
    assert complete_all_queued(path) == []  # nothing left to drain


def test_queue_refuses_new_work_once_the_backlog_is_unbounded(tmp_path):
    """A trigger string the backend picks freely is one unique value per
    request away from an unbounded file, and every read parses all of it."""
    path = str(tmp_path / "queue.jsonl")
    for i in range(MAX_QUEUED_JOBS):
        enqueue(path, f"trigger-{i}")

    with pytest.raises(QueueFullError):
        enqueue(path, "one-too-many")

    # Draining makes room again -- the cap is backlog, not a lifetime total.
    complete_all_queued(path)
    assert enqueue(path, "one-too-many").status == QUEUED
