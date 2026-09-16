"""Streamed SHA-256 for model checkpoints (Sprint 4, WBS 4.4.3).

One function, pulled out of ``colab/BantAI_Retrain_Colab.ipynb``'s baseline
verification cell (commit ``608a1d1``) so the round trip's ``version.json``
(:mod:`retraining.pipeline`) and the notebook's baseline check compute a
digest the same way -- streamed, not ``hashlib.sha256(open(path).read())``,
because ``model.safetensors`` is over a gigabyte and reading it whole would
be the difference between this running on a laptop and not.
"""

from __future__ import annotations

import hashlib
import json
import os
from typing import Optional, Tuple

#: 4 MiB chunks. Large enough that the read-call overhead is negligible,
#: small enough not to notice on a machine with modest RAM.
_CHUNK_SIZE = 1 << 22


def sha256_file(path: str) -> str:
    """Hex SHA-256 digest of the file at ``path``, read in fixed-size chunks."""
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(_CHUNK_SIZE), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_against_manifest(
    data_path: str,
    manifest_path: str,
    digest_key: str,
) -> Tuple[str, str, Optional[str]]:
    """Check a data file against the digest its manifest recorded.

    ``(status, detail, actual_digest)`` where status is ``"ok"``,
    ``"mismatch"`` or ``"unverifiable"``. Separate from
    :func:`version_file.verify_version` because the thing being protected is
    different: that one guards *what predicts*, this one guards *what it is
    graded on*. An evaluation set that changed after it was frozen produces
    scores that look like every other score and mean something else
    (Reymark's audit, item 15).
    """
    if not os.path.isfile(data_path):
        return "unverifiable", f"{data_path} does not exist", None
    if not os.path.isfile(manifest_path):
        return "unverifiable", f"no manifest at {manifest_path}", None
    try:
        with open(manifest_path, encoding="utf-8") as handle:
            recorded = json.load(handle).get(digest_key)
    except (OSError, json.JSONDecodeError) as exc:
        return "unverifiable", f"{manifest_path} is unreadable: {exc}", None
    if not recorded:
        return "unverifiable", f"{manifest_path} records no {digest_key}", None

    actual = sha256_file(data_path)
    if actual != recorded:
        return (
            "mismatch",
            f"{data_path} does not match the digest recorded in {manifest_path} "
            f"(recorded {recorded[:12]}..., found {actual[:12]}...)",
            actual,
        )
    return "ok", f"{data_path} matches {manifest_path}", actual
