"""Compare candidate representations for campaign grouping (Sprint 5, WBS 5.3.6).

Sprint 3 grouped campaigns using the fine-tuned classifier's final-layer
``[CLS]`` vector. Measurement showed that vector encodes *class*, not campaign:
88% of random unrelated Scam pairs score above the 0.85 match threshold,
because a classifier is trained to collapse each class toward one prototype.
This script tests replacements against the same yardstick.

## The yardstick

There are no campaign labels in the dataset, so "same campaign" has to be
approximated. Campaigns are templated blasts -- one operation sending the same
message with small mutations (a different short link, a different amount) --
and the preprocessing pipeline already masks exactly those mutable parts. So
two messages from one campaign are, after masking, *lexically near-identical*.

**Positives:** pairs whose masked text overlaps heavily by character trigram
(Jaccard >= ``POSITIVE_JACCARD``) but is not identical. Near-certainly the same
campaign.

**Negatives:** random same-class pairs. Overwhelmingly different campaigns --
the dataset has hundreds of distinct scams, so two random Scams being the same
operation is unlikely.

**⚠️ Known bias.** Positives are defined lexically, which favours the lexical
methods under test. This is therefore a *necessary-condition* test, not a
sufficient one: a representation that cannot separate obvious textual variants
from random pairs is definitively unfit, but winning here does not by itself
prove semantic quality. It is reported this way rather than hidden because the
current production representation fails even this weak bar.

## Metric

``false_match_rate`` -- the share of random pairs scoring above the threshold
that keeps 90% of positives. Low is good: it is the rate at which the live
matcher would file an unrelated message into an existing campaign.

Run:  cd ai && python scripts/compare_campaign_embeddings.py
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
REPORT_PATH = os.path.join(AI, "evaluation", "campaign_embedding_comparison.json")

#: Character-trigram Jaccard at which two masked messages are treated as the
#: same campaign. High on purpose -- a weak bar would admit merely
#: same-topic messages and inflate every method's score.
POSITIVE_JACCARD = 0.75

#: Share of true campaign variants a threshold must retain. The false-match
#: rate is then read off at that operating point, so methods are compared at
#: equal recall rather than at one arbitrary shared cutoff.
TARGET_RECALL = 0.90


def trigrams(text: str) -> set:
    text = f"  {text.lower()}  "
    return {text[i : i + 3] for i in range(len(text) - 2)}


def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def build_pairs(
    masked: Sequence[str],
    labels: Sequence[str],
    n_negatives: int = 20000,
    seed: int = 0,
) -> Tuple[List[Tuple[int, int]], List[Tuple[int, int]]]:
    """Return ``(positive_pairs, negative_pairs)`` as index pairs.

    Positives are found by blocking on shared rare trigrams rather than by
    comparing all pairs -- an all-pairs scan over ~6.7k messages is 22M
    comparisons and is not needed to collect a few thousand examples.
    """
    rng = np.random.default_rng(seed)
    grams = [trigrams(t) for t in masked]

    # Block: bucket messages by a few of their trigrams, only compare within
    # buckets. Cheap approximation -- misses some positives, which is fine
    # because this needs a representative sample, not an exhaustive census.
    buckets: Dict[str, List[int]] = {}
    for idx, gset in enumerate(grams):
        for gram in sorted(gset)[:12]:
            buckets.setdefault(gram, []).append(idx)

    positives: set = set()
    for members in buckets.values():
        if len(members) < 2 or len(members) > 400:
            continue
        for a_i in range(len(members)):
            for b_i in range(a_i + 1, len(members)):
                a, b = members[a_i], members[b_i]
                if masked[a] == masked[b]:
                    continue  # identical text is trivial for every method
                if jaccard(grams[a], grams[b]) >= POSITIVE_JACCARD:
                    positives.add((min(a, b), max(a, b)))
        if len(positives) > 6000:
            break

    negatives: List[Tuple[int, int]] = []
    labels = np.asarray(labels)
    while len(negatives) < n_negatives:
        a, b = int(rng.integers(len(masked))), int(rng.integers(len(masked)))
        if a == b or labels[a] != labels[b]:
            continue
        if jaccard(grams[a], grams[b]) >= 0.5:
            continue  # might genuinely be the same campaign; exclude
        negatives.append((a, b))

    return sorted(positives), negatives


def score_pairs(vectors, pairs: Sequence[Tuple[int, int]]) -> np.ndarray:
    """Cosine similarity for each pair. ``vectors`` must be L2-normalized.

    Handles both dense arrays and scipy sparse matrices (TF-IDF). On sparse
    matrices ``*`` means matrix multiplication, not elementwise, so the
    row-wise product has to go through ``.multiply()``.
    """
    if not pairs:
        return np.array([])
    a = np.array([p[0] for p in pairs])
    b = np.array([p[1] for p in pairs])
    left, right = vectors[a], vectors[b]
    if hasattr(left, "multiply"):
        return np.asarray(left.multiply(right).sum(axis=1)).ravel()
    return np.asarray((left * right).sum(axis=1)).ravel()


def evaluate_representation(
    name: str,
    vectors,
    positives,
    negatives,
) -> dict:
    pos = score_pairs(vectors, positives)
    neg = score_pairs(vectors, negatives)
    if pos.size == 0:
        return {"name": name, "error": "no positive pairs"}

    # Threshold that retains TARGET_RECALL of true variants.
    threshold = float(np.quantile(pos, 1.0 - TARGET_RECALL))
    false_match = float((neg >= threshold).mean())

    return {
        "name": name,
        "threshold_at_90pct_recall": round(threshold, 4),
        "false_match_rate": round(false_match, 4),
        "positive_mean": round(float(pos.mean()), 4),
        "negative_mean": round(float(neg.mean()), 4),
        "separation": round(float(pos.mean() - neg.mean()), 4),
        "n_positives": int(pos.size),
        "n_negatives": int(neg.size),
    }


def l2(matrix) -> np.ndarray:
    matrix = np.asarray(matrix, dtype="float32")
    norms = np.linalg.norm(matrix, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return matrix / norms


def tfidf_vectors(masked: Sequence[str], analyzer: str, ngram: Tuple[int, int]):
    """TF-IDF vectors. Sparse, so cosine is done via the same dot product."""
    from sklearn.feature_extraction.text import TfidfVectorizer

    vec = TfidfVectorizer(analyzer=analyzer, ngram_range=ngram, min_df=2, sublinear_tf=True)
    matrix = vec.fit_transform(masked)
    # TfidfVectorizer already L2-normalizes rows by default.
    return matrix


def hidden_layer_vectors(texts: Sequence[str], layer: int, pooling: str, batch: int = 32):
    """Mean-pooled or [CLS] hidden states from a chosen encoder layer.

    Earlier layers are worth testing because class collapse is a property of
    the *final* layers -- the ones the classification head trains hardest.
    Middle layers may retain the topical structure campaigns need, at no extra
    dependency and reusing the checkpoint already on disk.
    """
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    from service.config import settings

    tokenizer = AutoTokenizer.from_pretrained(settings.model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(settings.model_dir)
    model.eval()

    out: List[np.ndarray] = []
    with torch.no_grad():
        for start in range(0, len(texts), batch):
            chunk = list(texts[start : start + batch])
            enc = tokenizer(
                chunk, truncation=True, max_length=settings.max_length,
                padding=True, return_tensors="pt",
            )
            hidden = model(**enc, output_hidden_states=True).hidden_states[layer]
            if pooling == "cls":
                pooled = hidden[:, 0, :]
            else:
                mask = enc["attention_mask"].unsqueeze(-1).float()
                pooled = (hidden * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
            out.append(pooled.cpu().numpy())
    return l2(np.vstack(out))


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--sample", type=int, default=2500,
        help="Messages to evaluate (default: %(default)s). The full set needs "
             "a long CPU pass per layer; a sample is enough for a similarity "
             "distribution.",
    )
    parser.add_argument("--skip-layers", action="store_true",
                        help="Only evaluate the cached [CLS] and TF-IDF options.")
    args = parser.parse_args(argv)

    from preprocessing import preprocess

    data = np.load(EMBEDDINGS, allow_pickle=True)
    mask = np.array([lab in {"Spam", "Scam"} for lab in data["labels"]])
    texts = data["texts"][mask]
    labels = data["labels"][mask]
    cls_vectors = l2(data["embeddings"][mask])

    rng = np.random.default_rng(0)
    if args.sample and args.sample < len(texts):
        pick = rng.choice(len(texts), args.sample, replace=False)
        texts, labels, cls_vectors = texts[pick], labels[pick], cls_vectors[pick]

    masked = [preprocess(str(t)) for t in texts]
    positives, negatives = build_pairs(masked, labels)

    print("=" * 78)
    print("Campaign representation comparison (WBS 5.3.6)")
    print(f"Messages: {len(masked)}   positive pairs: {len(positives)}   "
          f"negative pairs: {len(negatives)}")
    print("Lower false-match rate is better (equal 90% recall of true variants)")
    print("=" * 78)
    print(f"{'representation':<34} {'thresh':>8} {'false-match':>12} "
          f"{'pos':>7} {'neg':>7} {'sep':>7}")

    results = []

    def report(name, vectors):
        row = evaluate_representation(name, vectors, positives, negatives)
        results.append(row)
        if "error" in row:
            print(f"{name:<34} {row['error']}")
            return
        print(f"{name:<34} {row['threshold_at_90pct_recall']:>8.4f} "
              f"{100*row['false_match_rate']:>11.1f}% "
              f"{row['positive_mean']:>7.3f} {row['negative_mean']:>7.3f} "
              f"{row['separation']:>7.3f}")

    report("classifier [CLS] L12 (CURRENT)", cls_vectors)
    report("tfidf char_wb 3-5", tfidf_vectors(masked, "char_wb", (3, 5)))
    report("tfidf word 1-2", tfidf_vectors(masked, "word", (1, 2)))

    if not args.skip_layers:
        for layer in (4, 6, 8, 12):
            report(f"xlm-r mean-pool L{layer}",
                   hidden_layer_vectors(masked, layer, "mean"))

    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "n_messages": len(masked),
                "n_positive_pairs": len(positives),
                "n_negative_pairs": len(negatives),
                "positive_jaccard": POSITIVE_JACCARD,
                "target_recall": TARGET_RECALL,
                "results": results,
            },
            handle,
            indent=2,
        )
    print(f"\nWrote {os.path.relpath(REPORT_PATH, AI)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
