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
