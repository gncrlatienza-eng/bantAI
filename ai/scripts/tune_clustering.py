"""HDBSCAN parameter evaluation against real campaign data (Sprint 5, WBS 5.3.6).

Sprint 3 shipped clustering with the manuscript's ``min_cluster_size = 5`` and
took sklearn's defaults for everything else. This sweeps the parameters against
the actual Spam/Scam embeddings and reports what each setting costs and buys,
so the values in ``cluster_campaigns.py`` are answerable with numbers rather
than defended as "what the manuscript said".

Run:  cd ai && python scripts/embed_dataset.py      # once, produces embeddings
      cd ai && python scripts/tune_clustering.py

Metrics, and why these three:

**Noise rate** -- the fraction HDBSCAN refuses to assign. Some noise is
correct: genuine one-offs exist and forcing them into a campaign would be
worse. But noise is also where a too-conservative setting hides its damage,
because a discarded campaign looks exactly like an absent one.

**Label purity** -- of each cluster's messages, the share matching its majority
label. This is the check that stops noise-reduction from being gamed: any
setting can drive noise to zero by merging everything, and purity is what
catches that. Reported as a weighted mean over clustered messages.

**Cohesion** -- mean cosine similarity of members to their own centroid. The
live matcher admits a message to a campaign at 0.999 (``service/campaign.py``,
re-calibrated from the manuscript's original 0.85 -- see Stage 5b in
``PIPELINE.md``), so cohesion well above that says the offline clusters and
the online threshold agree about what "same campaign" means. If cohesion
drifted toward 0.999, the two paths would be describing different things.

Purity needs labels, so it is only computable offline against the labeled
dataset -- which is exactly what this script is for. Nothing here runs in
production.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import List, Optional, Sequence, Tuple

sys.path.insert(0, ".")

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.normpath(os.path.join(HERE, ".."))
EMBEDDINGS = os.path.join(AI, "datasets", "processed", "embeddings.npz")
REPORT_PATH = os.path.join(AI, "evaluation", "clustering_tuning.json")

#: (min_cluster_size, min_samples). ``None`` means "let sklearn default it to
#: min_cluster_size" -- the Sprint 3 behaviour, kept in the sweep so the
#: comparison always includes what is actually deployed.
DEFAULT_GRID: List[Tuple[int, Optional[int]]] = [
    (5, None),
    (5, 3),
    (5, 2),
    (5, 1),
    (4, 2),
    (3, 2),
    (3, 1),
    (10, None),
    (10, 3),
    (15, 3),
]


def purity(cluster_ids, labels) -> float:
    """Weighted mean share of each cluster's majority label. Noise excluded."""
    total = correct = 0
    for cid in {int(c) for c in cluster_ids if c != -1}:
        selected = labels[cluster_ids == cid]
        _, counts = np.unique(selected, return_counts=True)
        total += len(selected)
        correct += int(counts.max())
    return 100.0 * correct / total if total else 0.0


def cohesion(cluster_ids, embeddings) -> float:
    """Mean cosine similarity of members to their own centroid.

    Embeddings are L2-normalized upstream, so the dot product against a
    re-normalized centroid *is* the cosine.
    """
    sims: List[float] = []
    for cid in {int(c) for c in cluster_ids if c != -1}:
        members = embeddings[cluster_ids == cid]
        centroid = members.mean(axis=0)
        norm = np.linalg.norm(centroid)
        if norm:
            centroid = centroid / norm
        sims.append(float((members @ centroid).mean()))
    return float(np.mean(sims)) if sims else 0.0


def evaluate(
    embeddings,
    labels,
    min_cluster_size: int,
    min_samples: Optional[int],
) -> dict:
    """Cluster once at these settings and score the result."""
    from sklearn.cluster import HDBSCAN

    model = HDBSCAN(
        min_cluster_size=min_cluster_size,
        min_samples=min_samples,
        metric="euclidean",
        copy=True,
    )
    ids = model.fit_predict(embeddings)
    n_noise = int((ids == -1).sum())
    sizes = [int((ids == c).sum()) for c in {int(c) for c in ids if c != -1}]

    return {
        "min_cluster_size": min_cluster_size,
        # Report what sklearn will actually use, not the literal None, so the
        # deployed Sprint 3 config is not silently indistinguishable from an
        # explicit choice.
        "min_samples": min_samples if min_samples is not None else min_cluster_size,
        "min_samples_explicit": min_samples is not None,
        "n_clusters": len(sizes),
        "n_noise": n_noise,
        "noise_pct": round(100.0 * n_noise / len(ids), 2),
        "purity_pct": round(purity(ids, labels), 2),
        "cohesion": round(cohesion(ids, embeddings), 4),
        "median_cluster_size": int(np.median(sizes)) if sizes else 0,
        "largest_cluster": max(sizes) if sizes else 0,
    }


def load_population(labels_wanted: Sequence[str], dedupe: bool):
    """Load embeddings for the requested labels, optionally de-duplicated.

    De-duplication matches ``cluster_campaigns.dedupe_by_masked_text`` -- the
    sweep must score the same population the real run clusters, or its
    recommendation would not transfer.
    """
    if not os.path.isfile(EMBEDDINGS):
        raise SystemExit(f"No embeddings at {EMBEDDINGS}. Run scripts/embed_dataset.py first.")

    data = np.load(EMBEDDINGS, allow_pickle=True)
    embeddings, labels, texts = data["embeddings"], data["labels"], data["texts"]

    wanted = {s.strip() for s in labels_wanted}
    mask = np.array([lab in wanted for lab in labels])
    embeddings, labels, texts = embeddings[mask], labels[mask], texts[mask]

    n_before = len(embeddings)
    if dedupe:
        from scripts.cluster_campaigns import dedupe_by_masked_text

        keep = dedupe_by_masked_text(texts)
        embeddings, labels = embeddings[keep], labels[keep]

    return embeddings, labels, n_before


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--labels", default="Spam,Scam")
    parser.add_argument(
        "--no-dedup",
        action="store_true",
        help="Sweep against the raw population, duplicates included.",
    )
    args = parser.parse_args(argv)

    embeddings, labels, n_before = load_population(args.labels.split(","), dedupe=not args.no_dedup)

    print("=" * 78)
    print("HDBSCAN parameter sweep (WBS 5.3.6)")
    print(
        f"Population: {args.labels}  ->  {len(embeddings)} of {n_before} rows"
        f"{'' if args.no_dedup else ' after masked-text de-duplication'}"
    )
    print("=" * 78)
    print(
        f"{'mcs':>4} {'min_s':>6} {'clusters':>9} {'noise%':>8} "
        f"{'purity%':>8} {'cohesion':>9} {'median':>7} {'largest':>8}"
    )

    results = []
    for min_cluster_size, min_samples in DEFAULT_GRID:
        row = evaluate(embeddings, labels, min_cluster_size, min_samples)
        results.append(row)
        marker = "" if row["min_samples_explicit"] else "  <- sklearn default"
        print(
            f"{row['min_cluster_size']:>4} {row['min_samples']:>6} "
            f"{row['n_clusters']:>9} {row['noise_pct']:>7.1f}% "
            f"{row['purity_pct']:>7.1f}% {row['cohesion']:>9.4f} "
            f"{row['median_cluster_size']:>7} {row['largest_cluster']:>8}"
            f"{marker}"
        )

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "population": args.labels,
                "deduplicated": not args.no_dedup,
                "n_rows": int(len(embeddings)),
                "results": results,
            },
            handle,
            indent=2,
        )
    print(f"\nWrote {os.path.relpath(REPORT_PATH, AI)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
