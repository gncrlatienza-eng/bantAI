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

from service.retrain_queue import _FileLock, enqueue, list_jobs


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
