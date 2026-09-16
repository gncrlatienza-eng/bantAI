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
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Optional, Tuple

from .checksum import sha256_file

VERSION_FILENAME = "version.json"

#: Files whose contents decide what a checkpoint actually predicts. The
#: weights are the obvious one, but a tokenizer or a label-mapping change
#: silently alters predictions just as completely while leaving the weights
#: byte-identical -- so a weights-only digest reports "unchanged" for a
#: checkpoint that no longer behaves the same (Reymark's audit, item 14).
#: Missing entries are simply not hashed: a candidate that inherits its
#: tokenizer from the base model has fewer files, which is a fact about the
#: checkpoint rather than an error.
ARTIFACT_FILENAMES = (
    "model.safetensors",
    "config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "special_tokens_map.json",
    "sentencepiece.bpe.model",
)


@dataclass(frozen=True)
class IntegrityResult:
    """Outcome of :func:`verify_version`.

    ``unverifiable`` is kept distinct from ``ok`` on purpose: "nothing was
    recorded to check against" and "everything checked out" are the same
    boolean and very different facts, and collapsing them is how a missing
    guarantee starts reading like a passing one.
    """

    status: str  # "ok" | "mismatch" | "unverifiable"
    changed: Tuple[str, ...] = ()
    missing: Tuple[str, ...] = ()
    checked: Tuple[str, ...] = ()
    detail: str = ""

    def __bool__(self) -> bool:
        return self.status == "ok"


def write_version(model_dir: str, version_tag: str, weights_filename: str = "model.safetensors") -> None:
    """Write ``version.json`` into ``model_dir``.

    Hashes the weights *and* the tokenizer/config files that travel with them
    (streamed -- see :mod:`retraining.checksum`), so a later check can tell
    whether the checkpoint on disk is still the one this tag was written for.
    Absent files just go unrecorded -- this file records identity, and a
    missing hash is a fact about the checkpoint, not a reason to stop.

    ``sha256`` stays in the payload alongside the newer ``artifacts`` map: it
    is the weights digest, it is what every ``version.json`` written before
    2026-09-16 contains, and the Colab notebook compares against it by name.
    """
    artifacts = {
        name: sha256_file(os.path.join(model_dir, name))
        for name in ARTIFACT_FILENAMES
        if os.path.isfile(os.path.join(model_dir, name))
    }
    weights = os.path.join(model_dir, weights_filename)
    payload = {
        "version_tag": version_tag,
        "sha256": artifacts.get(weights_filename) or (sha256_file(weights) if os.path.isfile(weights) else None),
        "artifacts": artifacts,
        "written_at": datetime.now(timezone.utc).isoformat(),
    }
    with open(os.path.join(model_dir, VERSION_FILENAME), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, sort_keys=True)


def verify_version(model_dir: str) -> IntegrityResult:
    """Re-hash the checkpoint and compare against what ``version.json`` recorded.

    Recording a digest that nothing ever re-checks buys nothing: swapped or
    half-copied weights keep reporting the version tag they arrived with, and
    every downstream number is then attributed to a checkpoint that is not the
    one that produced it (Reymark's audit, item 13).

    Returns rather than raises, and callers decide what a mismatch is worth --
    the serving path logs loudly and keeps classifying (a wrong-but-working
    model still beats no model on a user's phone), while an evaluation script
    refuses to publish numbers it cannot attribute.
    """
    path = os.path.join(model_dir, VERSION_FILENAME)
    if not os.path.isfile(path):
        return IntegrityResult("unverifiable", detail=f"no {VERSION_FILENAME} in {model_dir}")
    try:
        with open(path, encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        return IntegrityResult("unverifiable", detail=f"{VERSION_FILENAME} is unreadable: {exc}")

    recorded = dict(payload.get("artifacts") or {})
    # Pre-2026-09-16 files carry only the weights digest under "sha256".
    if not recorded and payload.get("sha256"):
        recorded = {"model.safetensors": payload["sha256"]}
    if not recorded:
        return IntegrityResult("unverifiable", detail=f"{VERSION_FILENAME} records no digests to check against")

    changed, missing, checked = [], [], []
    for name, expected in sorted(recorded.items()):
        candidate = os.path.join(model_dir, name)
        if not os.path.isfile(candidate):
            missing.append(name)
        elif sha256_file(candidate) != expected:
            changed.append(name)
        else:
            checked.append(name)

    if changed or missing:
        parts = []
        if changed:
            parts.append(f"changed since it was recorded: {', '.join(changed)}")
        if missing:
            parts.append(f"recorded but now absent: {', '.join(missing)}")
        return IntegrityResult(
            "mismatch",
            changed=tuple(changed),
            missing=tuple(missing),
            checked=tuple(checked),
            detail="; ".join(parts),
        )
    return IntegrityResult("ok", checked=tuple(checked), detail=f"{len(checked)} file(s) match")


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
