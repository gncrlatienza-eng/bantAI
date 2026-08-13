"""Does re-centering the embedding widen the campaign margin? (Sprint 5, WBS 5.3.6)

The Stage 5b problem in one line: cosine similarity measures the *angle* between
two vectors as seen from the origin, and the origin is nowhere near the data.
The classifier pushes every Scam message far along one shared "this is a scam"
direction, so from the origin all of them point essentially the same way --
unrelated Scam pairs sit at ~0.90 and the usable window above the strangers is
~0.0008 wide.

Re-centering moves the vantage point into the middle of the cloud: subtract the
population mean, then re-normalize. The shared component cancels and only what
distinguishes messages remains. Two variants are measured:

* ``centered``  -- subtract the mean.
* ``abtt-k``    -- subtract the mean, then also remove the top *k* principal
  directions ("all-but-the-top"). The mean is the single largest shared
  component but rarely the only one; a couple of dominant directions usually
  carry "scaminess", register, and message length rather than campaign identity.

**Nothing here touches the model or classification.** This is a transform
applied to the cached embedding *after* the forward pass, on the copy used for
campaign comparison only.

## Why the ground truth is lexical here, deliberately

``calibrate_hybrid_match.py`` argues that lexical grouping is the *wrong*
referee for a lexical signal, because it is circular. The reverse holds here:
this script compares two *embedding* representations, and a lexical grouping is
independent of both, so it cannot favour either. Grouping by the raw embedding
(the hdbscan option there) would rig the result toward leaving things alone,
since those groups are by construction the ones the raw embedding already
agrees with.

## Comparing fairly across representations

Recall at a *fixed threshold* is meaningless here -- the representations live on
different scales, and 0.999 means nothing after centering. So every variant is
compared at a **matched false-match rate**: the threshold is placed wherever it
admits the same share of strangers as today's operating point, and we ask how
many real members clear it. The other reported number is **usable margin**, the
distance between that threshold and the 10th-percentile member -- the width of
the window a threshold has to be placed inside, which is the quantity that made
0.999 fragile in the first place.

Run:  cd ai && python scripts/compare_embedding_centering.py
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import List

sys.path.insert(0, ".")

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.normpath(os.path.join(HERE, ".."))
EMBEDDINGS = os.path.join(AI, "datasets", "processed", "embeddings.npz")
REPORT_PATH = os.path.join(AI, "evaluation", "embedding_centering.json")

#: Operating points to compare at, as share of strangers admitted. 0.026 is
#: today's measured false-match rate at the 0.999 threshold.
TARGET_FMRS = [0.026, 0.010]


def normalize(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms


def transform(vectors: np.ndarray, variant: str) -> np.ndarray:
    """Apply a re-centering variant and re-normalize."""
    if variant == "raw":
        return normalize(vectors.copy())

    centered = vectors - vectors.mean(axis=0, keepdims=True)
    if variant == "centered":
        return normalize(centered)

    k = int(variant.split("-")[1])
    # Remove the top-k principal directions of the centered cloud. SVD on the
    # centered matrix gives those directions as the leading right-singular
    # vectors; projecting them out is the "all-but-the-top" correction.
    _, _, vt = np.linalg.svd(centered, full_matrices=False)
    top = vt[:k]
    return normalize(centered - (centered @ top.T) @ top)


def evaluate(vectors: np.ndarray, groups: List[List[int]], seed: int = 0) -> dict:
    """Score held-out members and strangers, then summarize separation.

    Protocol is identical to calibrate_match_threshold.py so the ``raw`` row
    reproduces the already-published numbers and acts as a control.
    """
    from scripts.calibrate_match_threshold import collect_scores

    positives, negatives = collect_scores(vectors, groups, seed=seed)

    out = {
        "member_mean": round(float(positives.mean()), 4),
        "stranger_mean": round(float(negatives.mean()), 4),
        "member_p10": round(float(np.percentile(positives, 10)), 4),
        "stranger_p90": round(float(np.percentile(negatives, 90)), 4),
        "operating_points": [],
    }
    for fmr in TARGET_FMRS:
        threshold = float(np.percentile(negatives, 100.0 * (1.0 - fmr)))
        recall = float((positives >= threshold).mean())
        out["operating_points"].append(
            {
                "false_match_rate": fmr,
                "threshold": round(threshold, 6),
                "recall": round(recall, 4),
                # How much room a threshold has between "admits this many
                # strangers" and "still keeps 90% of members". Wider is more
                # robust to the embedding shifting under retraining.
                "usable_margin": round(
                    float(np.percentile(positives, 10)) - threshold, 6
                ),
            }
        )
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", type=int, default=4000)
    args = parser.parse_args(argv)

    from preprocessing import preprocess
    from scripts.calibrate_match_threshold import find_campaign_groups
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
    groups = find_campaign_groups([preprocess(str(t)) for t in texts])

    print("=" * 78)
    print("Embedding re-centering — does it widen the campaign margin? (WBS 5.3.6)")
    print(f"Messages: {len(texts)}   approximate campaigns: {len(groups)}")
    print("Ground truth is lexical, which is independent of every variant below.")
    print("=" * 78)

    variants = ["raw", "centered", "abtt-1", "abtt-2", "abtt-3", "abtt-5"]
    results = {}

    print(f"\n{'variant':>10} {'members':>9} {'strangers':>11} {'gap':>8}")
    for variant in variants:
        results[variant] = evaluate(transform(vectors, variant), groups)
        r = results[variant]
        gap = r["member_mean"] - r["stranger_mean"]
        print(f"{variant:>10} {r['member_mean']:>9.4f} "
              f"{r['stranger_mean']:>11.4f} {gap:>8.4f}")

    for fmr in TARGET_FMRS:
        print(f"\nAt a matched false-match rate of {100*fmr:.1f}% "
              f"(threshold placed to admit that share of strangers):")
        print(f"{'variant':>10} {'recall':>9} {'threshold':>12} {'usable margin':>15}")
        for variant in variants:
            op = next(o for o in results[variant]["operating_points"]
                      if o["false_match_rate"] == fmr)
            print(f"{variant:>10} {100*op['recall']:>8.1f}% "
                  f"{op['threshold']:>12.5f} {op['usable_margin']:>15.6f}")

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "n_messages": int(len(texts)),
                "n_groups": len(groups),
                "grouping": "lexical (independent of all variants compared)",
                "variants": results,
            },
            handle,
            indent=2,
        )
    print(f"\nWrote {os.path.relpath(REPORT_PATH, AI)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
