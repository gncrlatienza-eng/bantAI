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
from pathlib import Path
from typing import Dict, Mapping, Optional, Tuple

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


#: Excluded from :func:`bundle_digest`: it is written after the artifacts and
#: records their digests, so it cannot be part of what it describes. Literal
#: rather than imported from ``version_file`` to avoid a circular import.
_VERSION_FILENAME = "version.json"


def hash_bundle(model_dir: str) -> Dict[str, str]:
    """SHA-256 of every regular file under ``model_dir``, by POSIX relative path.

    The same file set the service's readiness gate verifies against the
    external approval manifest (``service/readiness.py:_model_files``), so a
    digest registered from a candidate directory and one reported by the
    serving host describe the same bytes.
    """
    root = Path(model_dir)
    return {
        path.relative_to(root).as_posix(): sha256_file(str(path))
        for path in sorted(root.rglob("*"))
        if path.is_file() and not path.is_symlink()
    }


def bundle_digest(artifacts: Mapping[str, str]) -> str:
    """Canonical digest of a model bundle (audit 2026-09-30, finding 2).

    SHA-256 over ``path\tsha256\n`` lines in code-point order, excluding
    ``version.json``. Mirrors ``backend/src/models/model-evidence.ts``
    ``bundleDigest``: the backend derives it from a candidate's registered
    artifacts, the service reports it from the files it verified at startup,
    and deployment confirmation compares the two.
    """
    lines = "".join(
        f"{name}\t{digest.lower()}\n" for name, digest in sorted(artifacts.items()) if name != _VERSION_FILENAME
    )
    return hashlib.sha256(lines.encode("utf-8")).hexdigest()
