"""Calibrate the campaign match threshold against real data (Sprint 5, WBS 5.3.6).

The manuscript sets the Stage 5b fast-path threshold at **0.85**: a message
joins an active campaign if its cosine similarity to that campaign's centroid
reaches 0.85. Measurement shows that value does not discriminate on this
embedding space -- two *unrelated* Scam messages already average 0.84, because
the shared embedding is a classifier's and encodes class, not campaign
(see ``scripts/compare_campaign_embeddings.py``).

This script picks a replacement empirically, under the real operating
condition: **message vs. centroid**, not message vs. message. That distinction
matters. A centroid is the mean of its members, so members sit closer to it
than to each other, and a threshold calibrated on pairwise similarity would be
set too low for centroid matching.

## Ground truth

The dataset has no campaign labels, so campaigns are approximated lexically:
messages whose masked text overlaps heavily by character trigram
(Jaccard >= ``GROUP_JACCARD``) are treated as one campaign. Campaigns are
templated blasts and the preprocessing already masks the mutable parts (links,
amounts), so same-campaign messages really are near-identical after masking.

**⚠️ Bias.** Groups are defined lexically, so this rewards any method that
tracks wording. It is used here only to *locate* campaigns -- the threshold is
then measured on the embedding under test, so the bias affects which messages
are grouped, not how the embedding scores them.

## Protocol

For each discovered campaign with at least ``MIN_GROUP`` members:

1. Split members in half. One half builds the centroid, exactly as
   ``service/campaign.py`` does.
2. **Positives** = held-out members scored against that centroid. These are
   messages the live matcher *should* attach.
3. **Negatives** = random messages from outside the group, scored against the
   same centroid. These it *must* reject.

Sweeping the threshold over both gives recall (campaign members correctly
attached) against false-match rate (strangers wrongly attached).

Run:  cd ai && python scripts/calibrate_match_threshold.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Dict, List, Sequence, Tuple

sys.path.insert(0, ".")

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.normpath(os.path.join(HERE, ".."))
EMBEDDINGS = os.path.join(AI, "datasets", "processed", "embeddings.npz")
REPORT_PATH = os.path.join(AI, "evaluation", "match_threshold_calibration.json")

#: Trigram-Jaccard at which two masked messages count as one campaign.
GROUP_JACCARD = 0.75

#: Smallest campaign usable here -- needs enough members to both build a
#: centroid and hold some out to score against it.
MIN_GROUP = 4

#: Random non-members scored against each centroid.
NEGATIVES_PER_GROUP = 200


def trigrams(text: str) -> set:
    text = f"  {text.lower()}  "
    return {text[i : i + 3] for i in range(len(text) - 2)}


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def find_campaign_groups(masked: Sequence[str]) -> List[List[int]]:
    """Group messages into approximate campaigns by lexical near-duplication.

    Union-find over pairs that clear ``GROUP_JACCARD``, with trigram blocking
    so this stays far below an all-pairs scan.
    """
    grams = [trigrams(t) for t in masked]

    parent = list(range(len(masked)))

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    buckets: Dict[str, List[int]] = {}
    for idx, gset in enumerate(grams):
        for gram in sorted(gset)[:12]:
            buckets.setdefault(gram, []).append(idx)

    for members in buckets.values():
        # Very large buckets are common trigrams (" th", "he "), not campaign
        # evidence; comparing them all is expensive and uninformative.
        if len(members) < 2 or len(members) > 300:
            continue
        for i in range(len(members)):
            for j in range(i + 1, len(members)):
                a, b = members[i], members[j]
                if find(a) != find(b) and jaccard(grams[a], grams[b]) >= GROUP_JACCARD:
                    union(a, b)

    groups: Dict[int, List[int]] = {}
    for idx in range(len(masked)):
        groups.setdefault(find(idx), []).append(idx)
    return [g for g in groups.values() if len(g) >= MIN_GROUP]


def collect_scores(vectors, groups: List[List[int]], seed: int = 0) -> Tuple[np.ndarray, np.ndarray]:
    """Score held-out members and random strangers against each centroid."""
    rng = np.random.default_rng(seed)
    n = len(vectors)
    positives: List[float] = []
    negatives: List[float] = []

    for group in groups:
        members = list(group)
        rng.shuffle(members)
        half = max(2, len(members) // 2)
        centroid_members, held_out = members[:half], members[half:]
        if not held_out:
            continue

        centroid = vectors[centroid_members].mean(axis=0)
        norm = np.linalg.norm(centroid)
        if not norm:
            continue
        centroid = centroid / norm

        positives.extend(float(s) for s in vectors[held_out] @ centroid)

        in_group = set(group)
        picked = 0
        while picked < NEGATIVES_PER_GROUP:
            idx = int(rng.integers(n))
            if idx in in_group:
                continue
            negatives.append(float(vectors[idx] @ centroid))
            picked += 1

    return np.array(positives), np.array(negatives)


def sweep(positives: np.ndarray, negatives: np.ndarray) -> List[dict]:
    grid = [0.85, 0.90, 0.95, 0.97, 0.98, 0.99, 0.995, 0.997, 0.998, 0.999, 0.9995, 0.9999]
    return [
        {
            "threshold": t,
            "recall": round(float((positives >= t).mean()), 4),
            "false_match_rate": round(float((negatives >= t).mean()), 4),
        }
        for t in grid
    ]


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", type=int, default=4000)
    args = parser.parse_args(argv)

    from preprocessing import preprocess
    from scripts.cluster_campaigns import dedupe_by_masked_text

    data = np.load(EMBEDDINGS, allow_pickle=True)
    mask = np.array([lab in {"Spam", "Scam"} for lab in data["labels"]])
    texts, vectors = data["texts"][mask], data["embeddings"][mask]

    keep = dedupe_by_masked_text(texts)
    texts, vectors = texts[keep], vectors[keep]

    rng = np.random.default_rng(0)
    if args.sample and args.sample < len(texts):
        pick = rng.choice(len(texts), args.sample, replace=False)
        texts, vectors = texts[pick], vectors[pick]

    vectors = np.asarray(vectors, dtype="float32")
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    vectors = vectors / norms

    masked = [preprocess(str(t)) for t in texts]
    groups = find_campaign_groups(masked)
    positives, negatives = collect_scores(vectors, groups)

    print("=" * 74)
    print("Campaign match threshold calibration (WBS 5.3.6)")
    print(f"Messages: {len(masked)}   approximate campaigns: {len(groups)}")
    print(f"Held-out members scored: {len(positives)}   strangers scored: {len(negatives)}")
    print("=" * 74)
    print(f"Member-to-centroid similarity  : mean {positives.mean():.4f}  p10 {np.percentile(positives, 10):.4f}")
    print(f"Stranger-to-centroid similarity: mean {negatives.mean():.4f}  p90 {np.percentile(negatives, 90):.4f}")
    print()
    print(f"{'threshold':>10} {'recall':>9} {'false-match':>13}")
    rows = sweep(positives, negatives)
    for row in rows:
        flag = "   <- manuscript" if row["threshold"] == 0.85 else ""
        print(f"{row['threshold']:>10} {100 * row['recall']:>8.1f}% {100 * row['false_match_rate']:>12.1f}%{flag}")

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "n_messages": len(masked),
                "n_groups": len(groups),
                "group_jaccard": GROUP_JACCARD,
                "member_centroid_mean": round(float(positives.mean()), 4),
                "stranger_centroid_mean": round(float(negatives.mean()), 4),
                "sweep": rows,
            },
            handle,
            indent=2,
        )
    print(f"\nWrote {os.path.relpath(REPORT_PATH, AI)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
