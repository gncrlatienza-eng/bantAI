"""Offline HDBSCAN campaign re-clustering (Sprint 3, WBS 3.3.5).

Implements the manuscript's slow path (Stage 5b): embeddings that matched no
active campaign centroid get buffered, and periodically HDBSCAN re-clusters
them with ``min_cluster_size = 5`` to discover campaigns that did not exist
before.

HDBSCAN (not plain DBSCAN or k-means) because it does not require choosing the
number of clusters up front -- the manuscript's stated reason: it can "organize
related SMS messages into campaign clusters without requiring a fixed number of
groups." It also labels genuine one-offs as noise (-1) rather than forcing
every message into some cluster, which matters here: most Ham is legitimately
not part of any campaign.

Uses ``sklearn.cluster.HDBSCAN`` (scikit-learn >= 1.3) rather than the separate
``hdbscan`` PyPI package -- same algorithm, one less dependency, and sklearn is
already required for the train/val split.

Run:  cd ai && python scripts/embed_dataset.py      # once, produces embeddings
      cd ai && python scripts/cluster_campaigns.py  # fast, re-runnable
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from typing import List

sys.path.insert(0, ".")

import numpy as np

from service.campaign import DEFAULT_SIMILARITY_THRESHOLD, compute_centroid

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.normpath(os.path.join(HERE, ".."))
EMBEDDINGS = os.path.join(AI, "datasets", "processed", "embeddings.npz")
OUT_DIR = os.path.join(AI, "datasets", "processed")
SNAPSHOT_DIR = os.path.join(OUT_DIR, "campaign_snapshots")

# Manuscript-specified (Stage 5b).
DEFAULT_MIN_CLUSTER_SIZE = 5

_URL_RE = None


def _safe(value) -> str:
    """Make text printable on a cp1252 console.

    Real SMS carries peso signs, emoji and Thai script; Windows' default
    console encoding cannot represent them and raises UnicodeEncodeError
    mid-print. Affects display only -- the JSON output is written UTF-8 and
    keeps full fidelity.
    """
    text = str(value)
    encoding = sys.stdout.encoding or "utf-8"
    return text.encode(encoding, errors="replace").decode(encoding, errors="replace")


def _extract_domains(text: str) -> List[str]:
    """Domains appearing in a message, for the cluster's urlDomains list.

    The backend uses these for link suppression (``getActiveDomains()``), so a
    discovered campaign needs to report which domains it blasts.
    """
    import re
    from urllib.parse import urlparse

    global _URL_RE
    if _URL_RE is None:
        _URL_RE = re.compile(r"(?:https?://\S+|\bwww\.\S+)", re.I)

    out = []
    for url in _URL_RE.findall(text or ""):
        host = urlparse(url if "://" in url else f"//{url}").hostname or ""
        host = host.lower()
        if host.startswith("www."):
            host = host[4:]
        if host:
            out.append(host)
    return out


def cluster_embeddings(embeddings, min_cluster_size: int = DEFAULT_MIN_CLUSTER_SIZE):
    """Run HDBSCAN. Returns sklearn-convention labels (-1 = noise).

    NOTE -- HDBSCAN is *density-based*, so it finds clusters by contrast
    against surrounding data. Handed a single homogeneous group and nothing
    else, it correctly returns all-noise: with no background there is nothing
    to separate a cluster from. In practice this means the offline buffer must
    hold a *mix* of message types for campaigns to emerge; re-clustering a
    buffer that happens to contain one campaign and nothing else will find
    nothing. Verified empirically 2026-07-30 (see tests/test_clustering.py).
    """
    from sklearn.cluster import HDBSCAN

    # metric="euclidean" on L2-normalized vectors is monotonically equivalent
    # to cosine distance (||a-b||^2 = 2 - 2*cos), so this clusters by the same
    # notion of similarity the 0.85 cosine threshold uses at match time --
    # important, since the two paths must agree about what "similar" means.
    # copy=True: sklearn 1.10 changes this default, and leaving it implicit
    # lets HDBSCAN mutate the caller's array in place.
    model = HDBSCAN(min_cluster_size=min_cluster_size, metric="euclidean", copy=True)
    return model.fit_predict(embeddings)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--min-cluster-size", type=int, default=DEFAULT_MIN_CLUSTER_SIZE,
        help=f"HDBSCAN min_cluster_size (manuscript default: {DEFAULT_MIN_CLUSTER_SIZE})",
    )
    parser.add_argument(
        "--labels", default="Spam,Scam",
        help="Comma-separated labels to cluster, or 'all'. Campaigns are "
             "coordinated blasts, so Ham is excluded by default.",
    )
    args = parser.parse_args()

    if not os.path.isfile(EMBEDDINGS):
        raise SystemExit(
            f"No embeddings at {EMBEDDINGS}. Run scripts/embed_dataset.py first."
        )

    data = np.load(EMBEDDINGS, allow_pickle=True)
    embeddings = data["embeddings"]
    labels = data["labels"]
    senders = data["senders"]
    texts = data["texts"]

    if args.labels.lower() == "all":
        mask = np.ones(len(labels), dtype=bool)
    else:
        wanted = {s.strip() for s in args.labels.split(",")}
        mask = np.array([l in wanted for l in labels])

    emb = embeddings[mask]
    sub_labels = labels[mask]
    sub_senders = senders[mask]
    sub_texts = texts[mask]

    print("=" * 72)
    print(f"HDBSCAN campaign clustering  (min_cluster_size={args.min_cluster_size})")
    print(f"Population: {args.labels}  ->  {len(emb)} of {len(labels)} messages")
    print("=" * 72)

    cluster_ids = cluster_embeddings(emb, args.min_cluster_size)

    n_clusters = len({c for c in cluster_ids if c != -1})
    n_noise = int((cluster_ids == -1).sum())
    clustered = len(cluster_ids) - n_noise

    print(f"\nClusters found : {n_clusters}")
    print(f"Messages grouped: {clustered} ({100*clustered/len(emb):.1f}%)")
    print(f"Noise (one-offs): {n_noise} ({100*n_noise/len(emb):.1f}%)")

    sizes = Counter(int(c) for c in cluster_ids if c != -1)
    if sizes:
        biggest = sizes.most_common(1)[0][1]
        print(f"Largest cluster : {biggest} messages "
              f"({100*biggest/len(emb):.1f}% of population)")
        print(f"Median size     : {int(np.median(list(sizes.values())))}")

    # --- health checks against the two failure modes worth catching early ---
    print("\n" + "-" * 72)
    print("Sanity checks")
    print("-" * 72)
    if n_clusters == 0:
        print("  FAIL  No clusters at all -- min_cluster_size likely too high.")
    elif sizes and biggest > 0.5 * len(emb):
        print(f"  WARN  One cluster holds {100*biggest/len(emb):.0f}% of messages "
              f"-- clustering may be collapsing distinct campaigns together.")
    elif n_clusters > len(emb) / 10:
        print(f"  WARN  {n_clusters} clusters for {len(emb)} messages -- "
              f"very fragmented, campaigns may be splitting apart.")
    else:
        print("  OK    Cluster count and sizes look reasonable "
              "(no giant blob, not fragmented).")

    # --- per-cluster detail ------------------------------------------------
    print("\n" + "-" * 72)
    print("Top clusters")
    print("-" * 72)
    report = []
    for cid, size in sizes.most_common():
        idxs = np.where(cluster_ids == cid)[0]
        label_mix = Counter(sub_labels[idxs])
        domains = Counter()
        for t in sub_texts[idxs]:
            domains.update(_extract_domains(str(t)))
        uniq_senders = len(set(sub_senders[idxs]))
        centroid = compute_centroid(emb[idxs])

        entry = {
            "cluster_id": int(cid),
            "size": int(size),
            "labels": dict(label_mix),
            "unique_senders": uniq_senders,
            "top_domains": [d for d, _ in domains.most_common(8)],
            "sample": str(sub_texts[idxs[0]])[:160],
            "centroid": [round(float(x), 6) for x in centroid],
        }
        report.append(entry)

    # Archive the outgoing snapshot BEFORE overwriting it. This file is the
    # only record of "what clustering looked like last time" -- without it,
    # scripts/track_campaign_evolution.py (WBS 4.3.8) would have nothing to
    # diff the new run against. Best-effort: a snapshot-archiving failure
    # must never block writing the actual clustering result below.
    out_path = os.path.join(OUT_DIR, "campaign_clusters.json")
    if os.path.isfile(out_path):
        try:
            import shutil
            from datetime import datetime, timezone

            os.makedirs(SNAPSHOT_DIR, exist_ok=True)
            stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
            shutil.copy2(out_path, os.path.join(SNAPSHOT_DIR, f"campaign_clusters_{stamp}.json"))
        except OSError as exc:
            print(f"  WARN  Could not archive previous snapshot: {exc}")

    # Persist BEFORE printing. The centroids are the actual deliverable and
    # cost a 20-minute embedding pass to produce; a console-display problem
    # must never be able to lose them (it did, once -- see below).
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(
            {
                "min_cluster_size": args.min_cluster_size,
                "population": args.labels,
                "match_threshold": DEFAULT_SIMILARITY_THRESHOLD,
                "n_clusters": n_clusters,
                "n_noise": n_noise,
                "n_messages": int(len(emb)),
                "clusters": report,
            },
            f,
            indent=2,
        )

    for entry in report[:15]:
        print(f"\n  Cluster {entry['cluster_id']}  ({entry['size']} msgs, "
              f"{entry['unique_senders']} senders)  {_safe(entry['labels'])}")
        if entry["top_domains"]:
            print(f"    domains: {_safe(', '.join(entry['top_domains'][:5]))}")
        sample = entry["sample"].replace("\n", " ").replace("\r", "")
        print(f"    sample : {_safe(sample[:120])}")

    print(f"\nWrote {os.path.relpath(out_path, AI)} "
          f"({n_clusters} clusters with centroids)")
    print("=" * 72)


if __name__ == "__main__":
    main()
