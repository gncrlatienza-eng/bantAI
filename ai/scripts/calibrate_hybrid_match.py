"""Calibrate the hybrid campaign-match gates (Sprint 5, WBS 5.3.6).

``scripts/calibrate_match_threshold.py`` established that the embedding-only
rule works but has almost no room in it: members sit at ~0.9998 from their
centroid, strangers at ~0.84, and the *usable* part of that gap -- the part
above where strangers start appearing -- is about 0.0008 wide. The chosen
0.999 costs 6.2% of genuine members and would move silently if Sprint 4's
retraining pipeline shifted the embedding geometry.

``service/lexical.py`` adds a second, independent signal. This script measures
the gates that combine them (``campaign.HYBRID_EMBEDDING_GATE``,
``LEXICAL_GATE``, ``DOMAIN_EMBEDDING_FLOOR``) instead of guessing them.

## The circularity problem, and what is done about it

The threshold script approximates campaigns by lexical near-duplication
(trigram Jaccard >= 0.75), because the dataset has no campaign labels. For
calibrating an *embedding* threshold that bias is tolerable -- the grouping
decides which messages are compared, the embedding still decides how they
score.

For calibrating a *lexical* gate it is fatal. Grouping messages by wording and
then measuring how well wording identifies the group is circular: the answer
is guaranteed to look excellent, and would tell us nothing.

So every number here is produced under **two independent groupings**:

* ``--groups lexical``  -- trigram near-duplication. Biased **toward** the
  lexical signal. Read it as an optimistic bound.
* ``--groups hdbscan``  -- the offline clustering pass itself, i.e. groups
  defined purely by embedding geometry, with no knowledge of wording. Biased
  **toward** the embedding signal, and if anything against the thing being
  calibrated here.

A gate is only adopted if it holds under **both**. Where they disagree, the
hdbscan run is the one to trust for the lexical gate, because it is the
grouping that cannot have been rigged in that gate's favour.

## Protocol

Identical to the threshold script, so results are comparable. Per group:

1. Split members in half. One half builds the centroid **and** the lexical
   profile -- both from the same messages, mirroring what
   ``cluster_campaigns.py`` does at write time.
2. Positives = held-out members scored against that centroid and profile.
3. Negatives = random outsiders scored against the same.

Each scored pair yields three numbers -- cosine, lexical Dice, shared-domain
-- so any combination rule can be evaluated over the same fixed sample
without rescoring.

Run:  cd ai && python scripts/calibrate_hybrid_match.py
      cd ai && python scripts/calibrate_hybrid_match.py --groups hdbscan
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from typing import List, Sequence, Tuple

sys.path.insert(0, ".")

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.normpath(os.path.join(HERE, ".."))
EMBEDDINGS = os.path.join(AI, "datasets", "processed", "embeddings.npz")
REPORT_PATH = os.path.join(AI, "evaluation", "hybrid_match_calibration.json")

#: Candidate relaxed embedding bars for the hybrid tier.
HYBRID_GATE_GRID = [0.95, 0.97, 0.98, 0.99, 0.995]

#: Candidate lexical Dice gates.
LEXICAL_GATE_GRID = [0.20, 0.30, 0.35, 0.40, 0.45, 0.50, 0.60, 0.70]

#: Candidate embedding floors for the domain tier.
DOMAIN_FLOOR_GRID = [0.80, 0.85, 0.90, 0.95]

#: Random non-members scored against each centroid. Matches the threshold
#: script so the two reports describe the same operating condition.
NEGATIVES_PER_GROUP = 200


def score_pairs(
    vectors,
    texts: Sequence[str],
    groups: List[List[int]],
    seed: int = 0,
) -> Tuple[dict, dict]:
    """Score held-out members and strangers on all three signals at once.

    Returns ``(positives, negatives)``, each a dict of parallel arrays with
    keys ``cos``, ``lex`` and ``dom``. Keeping them parallel (rather than
    scoring per candidate rule) means every rule below is evaluated on exactly
    the same sample, so differences between rules are real rather than
    sampling noise.
    """
    from service.lexical import build_profile, extract_domains, lexical_similarity, shares_domain

    rng = np.random.default_rng(seed)
    n = len(vectors)
    pos = {"cos": [], "lex": [], "dom": []}
    neg = {"cos": [], "lex": [], "dom": []}

    for group in groups:
        members = list(group)
        rng.shuffle(members)
        half = max(2, len(members) // 2)
        build, held_out = members[:half], members[half:]
        if not held_out:
            continue

        centroid = vectors[build].mean(axis=0)
        norm = np.linalg.norm(centroid)
        if not norm:
            continue
        centroid = centroid / norm

        build_texts = [str(texts[i]) for i in build]
        domains = {d for t in build_texts for d in extract_domains(t)}
        profile = build_profile(build_texts, domains=domains)

        for idx in held_out:
            body = str(texts[idx])
            pos["cos"].append(float(vectors[idx] @ centroid))
            pos["lex"].append(lexical_similarity(body, profile))
            pos["dom"].append(shares_domain(body, profile))

        in_group = set(group)
        picked = 0
        while picked < NEGATIVES_PER_GROUP:
            idx = int(rng.integers(n))
            if idx in in_group:
                continue
            body = str(texts[idx])
            neg["cos"].append(float(vectors[idx] @ centroid))
            neg["lex"].append(lexical_similarity(body, profile))
            neg["dom"].append(shares_domain(body, profile))
            picked += 1

    return (
        {k: np.array(v) for k, v in pos.items()},
        {k: np.array(v) for k, v in neg.items()},
    )


def rule_mask(scores: dict, hybrid_gate: float, lex_gate: float, domain_floor: float, threshold: float) -> np.ndarray:
    """Which pairs the three-tier rule would attach. Mirrors CampaignMatcher."""
    domain_tier = scores["dom"] & (scores["cos"] >= domain_floor)
    hybrid_tier = (scores["cos"] >= hybrid_gate) & (scores["lex"] >= lex_gate)
    embed_tier = scores["cos"] >= threshold
    return domain_tier | hybrid_tier | embed_tier


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sample", type=int, default=4000)
    parser.add_argument(
        "--groups",
        choices=["lexical", "hdbscan"],
        default="lexical",
        help="How ground-truth campaigns are approximated. See the module "
        "docstring -- run both, and trust hdbscan for the lexical gate.",
    )
    parser.add_argument("--min-cluster-size", type=int, default=5)
    args = parser.parse_args(argv)

    from preprocessing import preprocess
    from scripts.calibrate_match_threshold import MIN_GROUP, find_campaign_groups
    from scripts.cluster_campaigns import dedupe_by_masked_text
    from service.campaign import DEFAULT_SIMILARITY_THRESHOLD

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

    if args.groups == "lexical":
        groups = find_campaign_groups([preprocess(str(t)) for t in texts])
    else:
        from scripts.cluster_campaigns import cluster_embeddings

        ids = cluster_embeddings(vectors, args.min_cluster_size, None)
        buckets: dict = {}
        for i, cid in enumerate(ids):
            if int(cid) != -1:
                buckets.setdefault(int(cid), []).append(i)
        groups = [g for g in buckets.values() if len(g) >= MIN_GROUP]

    positives, negatives = score_pairs(vectors, texts, groups)
    if not len(positives["cos"]):
        print("No usable groups found -- nothing to calibrate.")
        return 1

    print("=" * 74)
    print(f"Hybrid campaign-match calibration (WBS 5.3.6)  [groups={args.groups}]")
    print(f"Messages: {len(texts)}   campaigns: {len(groups)}")
    print(f"Held-out members: {len(positives['cos'])}   strangers: {len(negatives['cos'])}")
    print("=" * 74)

    print("\nSignal separation (mean member vs. mean stranger)")
    print(f"{'signal':>12} {'members':>10} {'strangers':>11} {'gap':>8}")
    for key, name in (("cos", "embedding"), ("lex", "lexical")):
        m, s = positives[key].mean(), negatives[key].mean()
        print(f"{name:>12} {m:>10.4f} {s:>11.4f} {m - s:>8.4f}")
    print(
        f"{'domain':>12} {positives['dom'].mean():>10.4f} "
        f"{negatives['dom'].mean():>11.4f} "
        f"{positives['dom'].mean() - negatives['dom'].mean():>8.4f}"
    )

    base_recall = float((positives["cos"] >= DEFAULT_SIMILARITY_THRESHOLD).mean())
    base_fmr = float((negatives["cos"] >= DEFAULT_SIMILARITY_THRESHOLD).mean())
    print(
        f"\nEmbedding-only baseline at {DEFAULT_SIMILARITY_THRESHOLD}: "
        f"recall {100 * base_recall:.1f}%   false-match {100 * base_fmr:.1f}%"
    )

    # --- domain tier, measured alone ---------------------------------------
    print("\nDomain tier in isolation (shared domain AND cosine >= floor)")
    print(f"{'floor':>8} {'recall':>9} {'false-match':>13}")
    domain_rows = []
    for floor in DOMAIN_FLOOR_GRID:
        r = float((positives["dom"] & (positives["cos"] >= floor)).mean())
        f = float((negatives["dom"] & (negatives["cos"] >= floor)).mean())
        domain_rows.append({"floor": floor, "recall": round(r, 4), "false_match_rate": round(f, 4)})
        print(f"{floor:>8} {100 * r:>8.1f}% {100 * f:>12.1f}%")

    # --- full three-tier rule ----------------------------------------------
    print("\nFull rule: domain(floor=0.90) OR hybrid(gate,lex) OR embedding(0.999)")
    print(f"{'emb gate':>9} {'lex gate':>9} {'recall':>9} {'false-match':>13} {'vs baseline':>12}")
    rows = []
    for hg in HYBRID_GATE_GRID:
        for lg in LEXICAL_GATE_GRID:
            r = float(rule_mask(positives, hg, lg, 0.90, DEFAULT_SIMILARITY_THRESHOLD).mean())
            f = float(rule_mask(negatives, hg, lg, 0.90, DEFAULT_SIMILARITY_THRESHOLD).mean())
            rows.append({"hybrid_gate": hg, "lexical_gate": lg, "recall": round(r, 4), "false_match_rate": round(f, 4)})
            print(f"{hg:>9} {lg:>9} {100 * r:>8.1f}% {100 * f:>12.1f}% {100 * (r - base_recall):>+11.1f}pp")

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    path = REPORT_PATH.replace(".json", f"_{args.groups}.json")
    with open(path, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "grouping": args.groups,
                "n_messages": int(len(texts)),
                "n_groups": len(groups),
                "n_positives": int(len(positives["cos"])),
                "n_negatives": int(len(negatives["cos"])),
                "embedding_only_baseline": {
                    "threshold": DEFAULT_SIMILARITY_THRESHOLD,
                    "recall": round(base_recall, 4),
                    "false_match_rate": round(base_fmr, 4),
                },
                "domain_tier": domain_rows,
                "full_rule": rows,
            },
            handle,
            indent=2,
        )
    print(f"\nWrote {os.path.relpath(path, AI)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
