"""Separating scam campaigns: the transformed space campaign matching runs in.

Adviser-approved change (deviations document, item 19), 2026-09-28.

**The problem.** Campaign matching reuses the classifier's ``[CLS]`` embedding.
A classifier is trained to make every scam look alike, so it can call them all
"Scam" -- which is exactly the wrong property for telling one scam *campaign*
from another. On Model C, HDBSCAN put 97.5% of clustered scam messages into a
single cluster, and messages inside it shared barely more wording than two
random scams. It was not a campaign; it was the embedding's "this is a scam"
region.

**The fix ("all-but-the-top").** Centre the embeddings and remove their top
``k`` principal directions -- the few directions every message shares most --
then re-normalize. What is left is what makes one message different from
another. Measured on Model C: with ``k = 2`` the single blob splits into 48
scam campaigns, the largest holding 12.8% of clustered scams (PIPELINE.md,
"Item 19"; thresholds in ``evaluation/campaign_space_calibration.json``).

**Why the matcher has to use the same space (not just the clustering).**
Clustering in the transformed space and then matching in the original one was
measured and fails: the original space cannot tell the new scam campaigns apart
(the right campaign ranked first only ~82% of the time, against ~94% when
matching also runs in the transformed space). So every incoming embedding is
passed through :meth:`CampaignSpace.apply` before matching, and the three match
tiers use thresholds calibrated *in this space* -- raw-space values like 0.999
mean nothing here.

**Why one object carries both the transform and its thresholds.** They are only
valid together, and only for the checkpoint they were fitted on. A space fitted
on one model applied to another model's embeddings would silently produce
garbage matches, so :func:`resolve_space` refuses any mismatch and campaign
matching is switched off rather than run wrong.

**How centroids declare their space.** A centroid's ``label`` carries a
``@space:<id>`` suffix (``cluster-12@space:3f9a1c2b7d10``). The backend stores
``label`` as free text, so no schema change is needed, and a centroid without
the suffix is a raw-space centroid -- which is every centroid made before this
change, so existing data keeps working exactly as before.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass, field, replace
from typing import Dict, Iterable, Optional, Sequence, Tuple

import numpy as np

#: Separator between a centroid's readable label and its space identity.
SPACE_TAG = "@space:"

#: How many shared directions to remove. Measured on Model C: 2 splits the scam
#: blob and keeps the right campaign ranked first ~94% of the time; 3 splits it
#: slightly less well (the largest scam cluster grows back to ~22%) and ranks
#: the right campaign first only ~83% of the time.
DEFAULT_K = 2

#: Format version of the saved file, so a future change can be detected.
FORMAT = 1

#: A centroid built in a space has *no* weight left on the removed directions
#: (exactly 0, up to rounding); a raw classifier centroid has a lot (measured on
#: the Model B and C cluster files: 0.11 to 0.90). Anything under this is in the
#: space. It lets the guard check the vectors themselves, not only their labels.
IN_SPACE_TOLERANCE = 1e-3


def _normalize(x: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(x, axis=-1, keepdims=True)
    norms[norms == 0.0] = 1.0
    return x / norms


@dataclass(frozen=True)
class CampaignSpace:
    """An all-but-the-top transform plus the match thresholds calibrated in it."""

    space_id: str
    k: int
    mean: np.ndarray  # (dim,)
    components: np.ndarray  # (k, dim), orthonormal rows
    model_version: Optional[str] = None
    #: None until calibrated; the service will not match without it.
    embedding_threshold: Optional[float] = None
    #: None means that tier is switched off in this space. Calibration may
    #: choose that: measured on Model C, the wording tier picked the *wrong*
    #: campaign for ~4% of members here (spam campaigns share templates across
    #: clusters), while adding no correct matches.
    hybrid_gate: Optional[float] = None
    domain_floor: Optional[float] = None
    #: Separate ``(embedding, hybrid_gate, domain_floor)`` per classifier
    #: label, overriding the three above for messages with that label. Item 19
    #: follow-up: one shared set was set by Spam -- nearly every stranger that
    #: attached was a Spam message -- which left Scam members matching their
    #: own campaign only 23% of the time. See
    #: evaluation/item19_preregistration_2026-09-28.md.
    label_thresholds: Dict[str, Tuple[float, Optional[float], Optional[float]]] = field(default_factory=dict)

    # --- construction ------------------------------------------------------
    @classmethod
    def fit(cls, embeddings, k: int = DEFAULT_K, model_version: Optional[str] = None) -> "CampaignSpace":
        """Fit on the clustering population (the same embeddings HDBSCAN sees)."""
        x = np.asarray(embeddings, dtype="float64")
        if x.ndim != 2 or len(x) <= k:
            raise ValueError(f"need a 2-D array with more than k={k} rows, got shape {x.shape}")
        if k < 1:
            raise ValueError("k must be at least 1; use no space at all for raw matching")
        mean = x.mean(axis=0)
        # SVD of the centred data: rows of vt are the principal directions,
        # strongest first.
        _, _, vt = np.linalg.svd(x - mean, full_matrices=False)
        # Fix each direction's sign so refitting on identical data is
        # bit-for-bit identical (SVD's sign choice is arbitrary).
        components = vt[:k].copy()
        for i in range(k):
            if components[i][np.argmax(np.abs(components[i]))] < 0:
                components[i] = -components[i]
        mean = mean.astype("float32")
        components = components.astype("float32")
        return cls(
            space_id=_space_id(mean, components),
            k=k,
            mean=mean,
            components=components,
            model_version=model_version,
        )

    def with_thresholds(
        self, embedding_threshold: float, hybrid_gate: Optional[float], domain_floor: Optional[float]
    ) -> "CampaignSpace":
        return replace(
            self,
            embedding_threshold=float(embedding_threshold),
            hybrid_gate=None if hybrid_gate is None else float(hybrid_gate),
            domain_floor=None if domain_floor is None else float(domain_floor),
        )

    def with_label_thresholds(
        self, label: str, embedding_threshold: float, hybrid_gate: Optional[float], domain_floor: Optional[float]
    ) -> "CampaignSpace":
        tiers = dict(self.label_thresholds)
        tiers[label] = (
            float(embedding_threshold),
            None if hybrid_gate is None else float(hybrid_gate),
            None if domain_floor is None else float(domain_floor),
        )
        return replace(self, label_thresholds=tiers)

    # --- use ---------------------------------------------------------------
    @property
    def calibrated(self) -> bool:
        return self.embedding_threshold is not None

    def tiers_for(self, label: Optional[str]) -> Tuple[float, Optional[float], Optional[float]]:
        """``(embedding, hybrid_gate, domain_floor)`` for a message with this label.

        Falls back to the shared set for a label without its own (or no label).
        """
        if label in self.label_thresholds:
            return self.label_thresholds[label]
        return self.embedding_threshold, self.hybrid_gate, self.domain_floor

    def apply(self, embeddings) -> np.ndarray:
        """Centre, remove the top-``k`` directions, re-normalize. 1-D or 2-D in, same out."""
        x = np.asarray(embeddings, dtype="float32")
        single = x.ndim == 1
        x = x.reshape(1, -1) if single else x
        centred = x - self.mean
        out = _normalize(centred - (centred @ self.components.T) @ self.components)
        return out[0] if single else out

    def holds(self, vectors) -> np.ndarray:
        """Per vector: True if it lies in this space (nothing on the removed directions)."""
        x = np.asarray(vectors, dtype="float32")
        x = x.reshape(1, -1) if x.ndim == 1 else x
        if x.shape[1] != self.components.shape[1]:
            return np.zeros(len(x), dtype=bool)
        return np.linalg.norm(_normalize(x) @ self.components.T, axis=1) < IN_SPACE_TOLERANCE

    # --- persistence -------------------------------------------------------
    def to_dict(self) -> dict:
        return {
            "format": FORMAT,
            "method": "all-but-the-top",
            "space_id": self.space_id,
            "k": self.k,
            "model_version": self.model_version,
            # null hybrid_gate / domain_floor = that tier is off.
            "thresholds": {
                "embedding": self.embedding_threshold,
                "hybrid_gate": self.hybrid_gate,
                "domain_floor": self.domain_floor,
            },
            "label_thresholds": {
                label: {"embedding": t, "hybrid_gate": g, "domain_floor": f}
                for label, (t, g, f) in sorted(self.label_thresholds.items())
            },
            "mean": [float(v) for v in self.mean],
            "components": [[float(v) for v in row] for row in self.components],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "CampaignSpace":
        if data.get("format") != FORMAT:
            raise ValueError(f"unsupported campaign space format {data.get('format')!r}")
        mean = np.asarray(data["mean"], dtype="float32")
        components = np.asarray(data["components"], dtype="float32")
        space_id = _space_id(mean, components)
        if space_id != data.get("space_id"):
            # The id is a digest of the numbers; a mismatch means the file was
            # edited or damaged, and its thresholds can't be trusted either.
            raise ValueError(f"campaign space file is inconsistent: id {data.get('space_id')!r} != {space_id!r}")
        t = data.get("thresholds") or {}
        per_label = {
            str(label): (float(v["embedding"]), v.get("hybrid_gate"), v.get("domain_floor"))
            for label, v in (data.get("label_thresholds") or {}).items()
        }
        return cls(
            space_id=space_id,
            k=int(data["k"]),
            mean=mean,
            components=components,
            model_version=data.get("model_version"),
            embedding_threshold=t.get("embedding"),
            hybrid_gate=t.get("hybrid_gate"),
            domain_floor=t.get("domain_floor"),
            label_thresholds=per_label,
        )

    def save(self, path: str) -> None:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(self.to_dict(), handle, indent=1)
            handle.write("\n")

    @classmethod
    def load(cls, path: str) -> "CampaignSpace":
        with open(path, encoding="utf-8") as handle:
            return cls.from_dict(json.load(handle))


def _space_id(mean: np.ndarray, components: np.ndarray) -> str:
    digest = hashlib.sha256()
    # Rounded before hashing so the id survives the JSON round trip exactly.
    digest.update(np.round(mean.astype("float64"), 6).tobytes())
    digest.update(np.round(components.astype("float64"), 6).tobytes())
    return digest.hexdigest()[:12]


def tag_label(label: str, space_id: Optional[str]) -> str:
    """``cluster-12`` -> ``cluster-12@space:<id>`` (unchanged when ``space_id`` is None)."""
    base = label.split(SPACE_TAG, 1)[0]
    return f"{base}{SPACE_TAG}{space_id}" if space_id else base


def space_of_label(label: Optional[str]) -> Optional[str]:
    """The space id a centroid declares, or None for a raw-space centroid."""
    if not label or SPACE_TAG not in label:
        return None
    return label.split(SPACE_TAG, 1)[1] or None


def resolve_space(
    centroid_labels: Iterable[Optional[str]],
    space: Optional[CampaignSpace],
    served_model_version: Optional[str],
    centroid_vectors=None,
) -> Tuple[bool, Optional[CampaignSpace], str]:
    """Decide how the matcher may run for this set of centroids.

    Returns ``(enabled, space_to_use, reason)``. ``enabled`` False means
    campaign matching must be switched off: running it would compare vectors
    from two different spaces and report confident nonsense.

    ``centroid_vectors``, when given with a loaded ``space``, are checked
    against what the labels claim. That catches centroids that lost their
    label on the way -- e.g. a backend that does not return ``label`` from
    ``/campaigns/centroids`` -- which the labels alone would read as raw.
    """
    labels = list(centroid_labels)
    declared = {space_of_label(label) for label in labels}
    if not declared:
        return True, None, "no centroids"
    held = None
    if space is not None and centroid_vectors is not None and len(labels):
        # One at a time: a malformed centroid of the wrong length just fails
        # the check instead of breaking the whole comparison.
        held = np.array([bool(space.holds(v)[0]) for v in centroid_vectors])
    if declared == {None}:
        # No labels to go on -- the backend path, where ``label`` is the
        # campaign's readable name. The vectors themselves say which space
        # they are in (a centroid built in a space has nothing left on the
        # removed directions), so use that.
        if held is not None and held.all():
            wanted = space.space_id
        elif held is not None and held.any():
            return (
                False,
                None,
                f"{int(held.sum())} of {len(held)} centroids are in space {space.space_id} and the rest are not "
                "-- two clustering runs are active at once (a half-finished sync?)",
            )
        elif space is None and centroid_vectors is not None and _looks_transformed(centroid_vectors):
            return (
                False,
                None,
                "centroids look like campaign-space centroids but no campaign space file is loaded "
                "(is models/campaign_space.json deployed?)",
            )
        else:
            return True, None, "raw-space centroids"
        return _check_space(space, wanted, served_model_version, "identified from the centroid vectors")
    if len(declared) > 1:
        return False, None, f"centroids declare more than one space: {sorted(str(d) for d in declared)}"
    wanted = next(iter(declared))
    if held is not None and not held.all():
        return False, None, f"{int((~held).sum())} centroids labelled space {wanted} are not in it"
    return _check_space(space, wanted, served_model_version, "from centroid labels")


#: Raw classifier centroids all point nearly the same way (the length of their
#: average unit vector is 0.955-0.963 on the Model B and C cluster files);
#: campaign-space centroids do not (0.20). Below this, a set of centroids is
#: treated as transformed even when no space file is there to confirm it.
RAW_COHERENCE_FLOOR = 0.6


def _looks_transformed(centroid_vectors) -> bool:
    try:
        x = _normalize(np.stack([np.asarray(v, dtype="float32") for v in centroid_vectors]))
    except ValueError:  # ragged -- not a set this check can judge
        return False
    return len(x) >= 2 and float(np.linalg.norm(x.mean(axis=0))) < RAW_COHERENCE_FLOOR


def _check_space(space, wanted, served_model_version, how) -> Tuple[bool, Optional[CampaignSpace], str]:
    if space is None:
        return False, None, f"centroids are in space {wanted} but no campaign space file is loaded"
    if space.space_id != wanted:
        return False, None, f"centroids are in space {wanted} but the loaded space is {space.space_id}"
    if not space.calibrated:
        return False, None, f"space {wanted} has no calibrated thresholds (run scripts/calibrate_campaign_space.py)"
    if space.model_version and served_model_version and space.model_version != served_model_version:
        return (
            False,
            None,
            f"space {wanted} was fitted on {space.model_version} but the service serves {served_model_version}",
        )
    return True, space, f"space {wanted} (k={space.k}, {how})"


def labels_of(centroids: Sequence) -> list:
    return [getattr(c, "label", None) for c in centroids]
