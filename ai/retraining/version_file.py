"""``version.json`` -- the file that carries a checkpoint's identity (WBS 4.4.3).

Written by :func:`retraining.pipeline.run_retraining` beside a candidate's
weights, the moment training finishes -- not on promotion, because promotion
is a manual "point the live model at ``<candidate_dir>``" (see the printed
instructions in ``scripts/retrain.py``), and a version tag that had to be
added as a *second* manual step would go missing exactly when someone is
in a hurry. Writing it here means it travels with the checkpoint for free.

Read by the FastAPI service (``service/main.py``'s startup check, and
``GET /health``) to report which version it is actually serving. One module
for both sides so the filename and shape cannot drift apart between a
writer and a reader that evolve separately. ``service/`` importing this is
fine -- plain stdlib, no ``pydantic`` dragged anywhere. The reverse
(``retraining/`` depending on ``service/``) is the direction
``scripts/retrain.py``'s ``ENV_BACKEND_URL`` comment is about avoiding.

Absent for every checkpoint promoted before this existed, including the one
currently deployed. That is today's true state; :func:`read_version` returns
``None`` for it rather than inventing a tag.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from typing import Optional

from .checksum import sha256_file

VERSION_FILENAME = "version.json"


def write_version(model_dir: str, version_tag: str, weights_filename: str = "model.safetensors") -> None:
    """Write ``version.json`` into ``model_dir``.

    Hashes the weights file if present (streamed -- see
    :mod:`retraining.checksum`), so a later ``GET /health`` can be checked
    against the digest the same way the Colab notebook verifies its baseline.
    Absent weights (e.g. a unit test's fake checkpoint directory) just means
    ``sha256: null``, not a failure -- this file records identity, and a
    missing hash is a fact about the checkpoint, not a reason to stop.
    """
    weights = os.path.join(model_dir, weights_filename)
    payload = {
        "version_tag": version_tag,
        "sha256": sha256_file(weights) if os.path.isfile(weights) else None,
        "written_at": datetime.now(timezone.utc).isoformat(),
    }
    with open(os.path.join(model_dir, VERSION_FILENAME), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)


def read_version(model_dir: str) -> Optional[str]:
    """The ``version_tag`` of the checkpoint in ``model_dir``, or ``None``.

    ``None`` covers three cases identically, and deliberately does not
    distinguish them: no ``version.json`` at all (a pre-WBS-4.4.3 deploy,
    including the one currently live), a corrupt file, or one missing the
    key. All three mean the same thing to a caller -- this service cannot
    say which version it is serving -- and a caller that only wants a
    boolean should not have to handle three failure shapes to get one.
    """
    path = os.path.join(model_dir, VERSION_FILENAME)
    if not os.path.isfile(path):
        return None
    try:
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None
    tag = payload.get("version_tag")
    return str(tag) if tag else None
