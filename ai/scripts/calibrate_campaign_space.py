"""Calibrate the campaign-match thresholds inside a campaign space (item 19).

``scripts/cluster_campaigns.py`` clusters in a transformed space (the top
shared directions removed -- see ``service/campaign_space.py``) and writes that
space to ``models/campaign_space.json`` *without* thresholds. Raw-space values
(0.999 / 0.99 / 0.90) mean nothing after the transform, so this script measures
new ones and writes them into the space file. Until it has run, the service
refuses to match against the new centroids.

## Protocol

Everything is measured the way the service will actually decide, against
**all** centroids at once -- not one centroid at a time, as the older
calibration scripts did. With dozens of scam campaigns instead of one blob, the
error that matters most is attaching a message to the *wrong* campaign, and
that can only be seen when every campaign competes for it.

1. Re-create the clustering exactly (same population, de-duplication, space
   and HDBSCAN settings as ``cluster_campaigns.py``; the space id and cluster
   count are checked against the files it wrote).
2. Per cluster, hold out 20% of members (at least one). The other 80% build the
   centroid and lexical profile, as ``cluster_campaigns.py`` does with 100%.
3. Every held-out member is run through the three-tier rule of
   ``CampaignMatcher.match`` against all centroids. Outcome: **correct** (its
   own campaign), **wrong** (another campaign), or **none**.
4. Every unclustered ("noise") message -- the realistic stranger: same
   Spam/Scam population, but part of no campaign -- is run through the same
   rule. Any attachment is a **false attachment**.

## Selection rule (fixed before looking at the result)

Maximize *correct*, subject to *wrong* <= 2% of held-out members and *false
attachment* <= 2.8% of noise messages (the stranger rate the raw-space 0.998
bar was approved at). Ties go to fewer false attachments, then to the stricter
thresholds. The domain and hybrid tiers may each be switched **off** (their
gate is then ``null`` in the space file); a tier that is on keeps the raw-space
ordering, domain floor <= hybrid gate <= embedding threshold. ``LEXICAL_GATE``
is not re-tuned: it measures wording, which the transform does not touch.

The rule is applied three times: to all messages (the shared fallback set),
and separately to Scam and to Spam messages (the per-label sets the matcher
uses, since one shared set was being dictated by Spam -- see
``evaluation/item19_preregistration_2026-09-28.md``). Each label's limits are
measured on that label's own held-out members and strangers. Outcomes are
pooled over several held-out splits (``--seeds``, default 0-4), because one
split holds only ~86 Scam members; the report gives the range across seeds.

The same protocol is also run on the raw classifier embeddings with the raw
thresholds, so the report carries a like-for-like "before".

The report (``evaluation/campaign_space_calibration.json``) holds counts and
rates only -- no message text.

Run:  cd ai && python scripts/cluster_campaigns.py
      cd ai && python scripts/calibrate_campaign_space.py
      cd ai && python scripts/cluster_campaigns.py   # re-writes match_threshold
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter
from dataclasses import replace
from datetime import datetime, timezone
from typing import Dict

sys.path.insert(0, ".")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np
from cluster_campaigns import (  # noqa: E402
    DEFAULT_MIN_CLUSTER_SIZE,
    DEFAULT_MIN_SAMPLES,
    DEFAULT_SELECTION_EPSILON,
    DEFAULT_SELECTION_METHOD,
    EMBEDDINGS,
    OUT_DIR,
    SPACE_FILE,
    cluster_embeddings,
    dedupe_by_masked_text,
)

from retraining.version_file import read_version  # noqa: E402
from service.campaign import (  # noqa: E402
    DEFAULT_SIMILARITY_THRESHOLD,
    DOMAIN_EMBEDDING_FLOOR,
    HYBRID_EMBEDDING_GATE,
    LEXICAL_GATE,
    compute_centroid,
)
from service.campaign_space import CampaignSpace  # noqa: E402
from service.lexical import (  # noqa: E402
    build_profile,
    domains_overlap,
    extract_domains,
    shingles,
    similarity_from_shingles,
)

HERE = os.path.dirname(os.path.abspath(__file__))
AI = os.path.normpath(os.path.join(HERE, ".."))
REPORT_PATH = os.path.join(AI, "evaluation", "campaign_space_calibration.json")
CLUSTER_FILE = os.path.join(OUT_DIR, "campaign_clusters.json")

HOLDOUT_FRACTION = 0.2
MAX_WRONG = 0.02
MAX_FALSE_ATTACH = 0.028

#: Where each grid sits, as quantiles of the held-out members' best cosine.
#: Quantiles rather than fixed values because the transformed space has its
#: own scale (its cosines are far lower than the raw space's ~0.999).
THRESHOLD_QUANTILES = np.linspace(0.0, 1.0, 101)
GATE_QUANTILES = np.linspace(0.0, 1.0, 26)


def load_population():
    """The Spam+Scam, de-duplicated population cluster_campaigns.py clusters."""
    data = np.load(EMBEDDINGS, allow_pickle=True)
    labels = data["labels"]
    mask = np.isin(labels, ["Spam", "Scam"])
    emb, labs, texts = data["embeddings"][mask], labels[mask], data["texts"][mask]
    keep = dedupe_by_masked_text(texts)
    model_dir = str(data["model_dir"]) if "model_dir" in data.files else None
    version = read_version(os.path.join(AI, model_dir)) if model_dir else None
    return emb[keep].astype("float32"), labs[keep], texts[keep], version


def split(cluster_ids, rng) -> Dict[int, tuple]:
    """cluster -> (build indices, held-out indices)."""
    out = {}
    for cid in sorted(set(int(c) for c in cluster_ids) - {-1}):
        members = np.where(cluster_ids == cid)[0]
        rng.shuffle(members)
        n_test = max(1, int(round(len(members) * HOLDOUT_FRACTION)))
        out[cid] = (members[n_test:], members[:n_test])
    return out


def score(vectors, texts, parts: Dict[int, tuple], queries) -> dict:
    """Cosine, lexical and shared-domain signals of every query vs every centroid."""
    ids = list(parts)
    centroids = np.stack([compute_centroid(vectors[parts[c][0]]) for c in ids])
    profiles = []
    for c in ids:
        build = [str(texts[i]) for i in parts[c][0]]
        profiles.append(build_profile(build, domains={d for t in build for d in extract_domains(t)}))
    cos = vectors[queries] @ centroids.T
    lex = np.zeros_like(cos)
    dom = np.zeros(cos.shape, dtype=bool)
    for row, q in enumerate(queries):
        body = str(texts[q])
        sh, doms = shingles(body), extract_domains(body)
        for col, profile in enumerate(profiles):
            lex[row, col] = similarity_from_shingles(sh, profile)
            dom[row, col] = domains_overlap(doms, profile)
    return {"ids": np.array(ids), "cos": cos, "lex": lex, "dom": dom}


def _pick(mask, key):
    """Per row: column of the highest ``key`` among ``mask``, or -1."""
    masked = np.where(mask, key, -np.inf)
    col = masked.argmax(axis=1)
    return np.where(mask.any(axis=1), col, -1)


def _off(gate):
    return np.inf if gate is None else gate


def decide(s: dict, domain_floor, hybrid_gate, threshold: float) -> np.ndarray:
    """Column each query attaches to (-1 = none). Mirrors CampaignMatcher.match.

    ``None`` for ``domain_floor`` / ``hybrid_gate`` switches that tier off.
    """
    cos, lex, dom = s["cos"], s["lex"], s["dom"]
    domain = _pick(dom & (cos >= _off(domain_floor)), cos)
    hybrid = _pick((cos >= _off(hybrid_gate)) & (lex >= LEXICAL_GATE), lex)
    embed = _pick(cos >= threshold, cos)
    return np.where(domain >= 0, domain, np.where(hybrid >= 0, hybrid, embed))


class Tiers:
    """Precomputed per-gate decisions, so a 3-D grid is cheap to search."""

    def __init__(self, s: dict, floors, gates, thresholds):
        cos, lex, dom = s["cos"], s["lex"], s["dom"]
        self.domain = {f: _pick(dom & (cos >= _off(f)), cos) for f in floors}
        self.hybrid = {g: _pick((cos >= _off(g)) & (lex >= LEXICAL_GATE), lex) for g in gates}
        best = cos.argmax(axis=1)
        self.best, self.best_cos = best, cos.max(axis=1)

    def decide(self, f, g, t):
        embed = np.where(self.best_cos >= t, self.best, -1)
        d, h = self.domain[f], self.hybrid[g]
        return np.where(d >= 0, d, np.where(h >= 0, h, embed))


def outcomes(chosen, own_cols) -> dict:
    n = max(len(chosen), 1)
    attached = chosen >= 0
    return {
        "correct": float(((chosen == own_cols) & attached).sum() / n),
        "wrong": float(((chosen != own_cols) & attached).sum() / n),
        "none": float((~attached).sum() / n),
    }


def evaluate(vectors, labs, texts, cluster_ids, seed: int):
    rng = np.random.default_rng(seed)
    parts = split(cluster_ids, rng)
    held = np.concatenate([parts[c][1] for c in parts])
    own = np.concatenate([[c] * len(parts[c][1]) for c in parts])
    noise = np.where(cluster_ids == -1)[0]
    pos = score(vectors, texts, parts, held)
    neg = score(vectors, texts, parts, noise)
    col_of = {int(c): i for i, c in enumerate(pos["ids"])}
    own_cols = np.array([col_of[int(c)] for c in own])
    return parts, held, own_cols, noise, pos, neg


def cluster_stats(cluster_ids, labs) -> dict:
    ids = sorted(set(int(c) for c in cluster_ids) - {-1})
    scam_ids = [c for c in ids if Counter(labs[cluster_ids == c].tolist()).most_common(1)[0][0] == "Scam"]
    scam_sizes = [int(((cluster_ids == c) & (labs == "Scam")).sum()) for c in scam_ids]
    clustered_scams = sum(scam_sizes)
    n_scam = int((labs == "Scam").sum())
    return {
        "clusters": len(ids),
        "scam_clusters": len(scam_ids),
        "largest_scam_cluster_share": round(max(scam_sizes, default=0) / max(clustered_scams, 1), 4),
        "scams_unassigned": round((n_scam - clustered_scams) / max(n_scam, 1), 4),
        "noise_messages": int((cluster_ids == -1).sum()),
    }


def _rows(s: dict, mask) -> dict:
    return {"cos": s["cos"][mask], "lex": s["lex"][mask], "dom": s["dom"][mask]}


def search(runs, labels, thresholds, options):
    """Best ``(domain_floor, hybrid_gate, threshold)`` for messages with one of
    ``labels``, outcomes pooled over every seed's split. Returns
    ``(settings, pooled_result, per_seed_results, embedding_curve)``."""
    subsets = []
    for run in runs:
        pmask = np.isin(run["held_labels"], labels)
        nmask = np.isin(run["noise_labels"], labels)
        subsets.append(
            (
                Tiers(_rows(run["pos"], pmask), options, options, thresholds),
                Tiers(_rows(run["neg"], nmask), options, options, thresholds),
                run["own_cols"][pmask],
                run,
                pmask,
                nmask,
            )
        )
    own = np.concatenate([sub[2] for sub in subsets])

    def pooled(f, g, t):
        cp = np.concatenate([sub[0].decide(f, g, t) for sub in subsets])
        cn = np.concatenate([sub[1].decide(f, g, t) for sub in subsets])
        o = outcomes(cp, own)
        o["false_attach"] = float((cn >= 0).mean()) if len(cn) else 0.0
        return o

    best, curve = None, []
    for t in thresholds:
        for g in (g for g in options if g is None or g <= t):
            for f in (f for f in options if f is None or (f <= t and (g is None or f <= g))):
                o = pooled(f, g, t)
                if o["wrong"] > MAX_WRONG or o["false_attach"] > MAX_FALSE_ATTACH:
                    continue
                # Ties: fewer false attachments, then stricter settings (a
                # tier that is off counts as strictest).
                key = (o["correct"], -o["false_attach"], t, _off(g), _off(f))
                if best is None or key > best[0]:
                    best = (key, (f, g, t), o)
        curve.append({"threshold": t, **pooled(None, None, t)})  # embedding tier alone
    if best is None:
        return None, None, None, curve

    f, g, t = best[1]
    per_seed = []
    for tiers_pos, tiers_neg, own_cols, run, _, _ in subsets:
        o = outcomes(tiers_pos.decide(f, g, t), own_cols)
        cn = tiers_neg.decide(f, g, t)
        o["false_attach"] = float((cn >= 0).mean()) if len(cn) else 0.0
        o["seed"] = run["seed"]
        per_seed.append(o)
    pooled_result = dict(best[2])
    pooled_result["n_held_out"] = int(len(own))
    pooled_result["n_strangers"] = int(sum(int(sub[5].sum()) for sub in subsets))
    return best[1], pooled_result, per_seed, curve


def _seed_range(per_seed, key) -> list:
    values = [o[key] for o in per_seed]
    return [round(min(values), 4), round(max(values), 4)]


def _print_choice(name, settings, result, per_seed):
    f, g, t = settings
    print(
        f"{name:<6} embedding {t}  hybrid gate {g or 'off'}  domain floor {f or 'off'}\n"
        f"       correct {100 * result['correct']:.1f}% (seeds {_seed_range(per_seed, 'correct')})  "
        f"wrong {100 * result['wrong']:.1f}%  none {100 * result['none']:.1f}%  "
        f"strangers {100 * result['false_attach']:.1f}%  (n={result['n_held_out']} held out, "
        f"{result['n_strangers']} strangers, pooled over {len(per_seed)} seeds)"
    )


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--space", default=SPACE_FILE)
    parser.add_argument(
        "--seeds",
        default="0,1,2,3,4",
        help="Held-out splits to pool (default 0-4: ~86 Scam members per split is too few to choose on alone).",
    )
    parser.add_argument("--no-raw-reference", action="store_true", help="Skip the raw-space 'before' run.")
    args = parser.parse_args(argv)
    seeds = [int(x) for x in args.seeds.split(",") if x.strip()]

    space = CampaignSpace.load(args.space)
    emb, labs, texts, version = load_population()
    if space.model_version and version and space.model_version != version:
        raise SystemExit(f"Space fitted on {space.model_version}, embeddings are from {version}.")
    refit = CampaignSpace.fit(emb, k=space.k, model_version=version)
    if refit.space_id != space.space_id:
        raise SystemExit(
            f"Space {space.space_id} does not match these embeddings (refit gives {refit.space_id}). "
            "Re-run scripts/cluster_campaigns.py first."
        )
    if not os.path.isfile(CLUSTER_FILE):
        raise SystemExit("No campaign_clusters.json. Run scripts/cluster_campaigns.py first.")
    with open(CLUSTER_FILE, encoding="utf-8") as fh:
        written = json.load(fh)
    # Same HDBSCAN settings the cluster file was written with.
    hdbscan_settings = (
        int(written.get("min_cluster_size", DEFAULT_MIN_CLUSTER_SIZE)),
        int(written.get("min_samples", DEFAULT_MIN_SAMPLES)),
        written.get("selection_method", DEFAULT_SELECTION_METHOD),
        float(written.get("selection_epsilon", DEFAULT_SELECTION_EPSILON)),
    )

    vectors = space.apply(emb)
    cluster_ids = cluster_embeddings(vectors, *hdbscan_settings)
    stats = cluster_stats(cluster_ids, labs)
    if (written.get("space") or {}).get("space_id") != space.space_id or written.get("n_clusters") != stats["clusters"]:
        raise SystemExit("campaign_clusters.json is not this clustering. Re-run scripts/cluster_campaigns.py first.")

    print(
        f"Space {space.space_id} (k={space.k}, model {version})  --  {len(emb)} messages, "
        f"{stats['clusters']} clusters, HDBSCAN {hdbscan_settings}"
    )
    runs = []
    for seed in seeds:
        _, held, own_cols, noise, pos, neg = evaluate(vectors, labs, texts, cluster_ids, seed)
        runs.append(
            {
                "seed": seed,
                "own_cols": own_cols,
                "pos": pos,
                "neg": neg,
                "held_labels": labs[held],
                "noise_labels": labs[noise],
            }
        )
        print(f"  seed {seed}: {len(held)} held out, {len(noise)} strangers")

    pooled_best = np.concatenate([r["pos"]["cos"].max(axis=1) for r in runs])
    q = lambda values: sorted({round(float(v), 4) for v in np.quantile(pooled_best, values)})  # noqa: E731
    thresholds, gates = q(THRESHOLD_QUANTILES), q(GATE_QUANTILES)
    options = [None] + gates  # None = tier off

    results = {}
    for name, group in (("shared", ["Spam", "Scam"]), ("Scam", ["Scam"]), ("Spam", ["Spam"])):
        settings, result, per_seed, curve = search(runs, group, thresholds, options)
        if settings is None:
            raise SystemExit(f"No threshold combination meets the limits for {name} -- nothing written.")
        _print_choice(name, settings, result, per_seed)
        f, g, t = settings
        results[name] = {
            "embedding": t,
            "hybrid_gate": g,
            "domain_floor": f,
            "result": result,
            "per_seed": per_seed,
            "correct_range_across_seeds": _seed_range(per_seed, "correct"),
            "embedding_curve": curve,
        }

    raw = None
    if not args.no_raw_reference:
        # The raw "before": today's settings, seed 0.
        raw_vectors = emb / np.linalg.norm(emb, axis=1, keepdims=True)
        raw_ids = cluster_embeddings(raw_vectors, DEFAULT_MIN_CLUSTER_SIZE, DEFAULT_MIN_SAMPLES)
        _, rheld, rown, rnoise, rpos, rneg = evaluate(raw_vectors, labs, texts, raw_ids, seeds[0])
        rargs = (DOMAIN_EMBEDDING_FLOOR, HYBRID_EMBEDDING_GATE, DEFAULT_SIMILARITY_THRESHOLD)
        cp, cn = decide(rpos, *rargs), decide(rneg, *rargs)
        raw = {"thresholds": dict(zip(("domain_floor", "hybrid_gate", "embedding"), rargs))}
        raw["clustering"] = cluster_stats(raw_ids, labs)
        for name, group in (("shared", ["Spam", "Scam"]), ("Scam", ["Scam"]), ("Spam", ["Spam"])):
            pm, nm = np.isin(labs[rheld], group), np.isin(labs[rnoise], group)
            o = outcomes(cp[pm], rown[pm])
            o["false_attach"] = float((cn[nm] >= 0).mean()) if nm.any() else 0.0
            raw[name] = o
        r = raw["shared"]
        print(
            f"Raw space (before, seed {seeds[0]}): correct {100 * r['correct']:.1f}%  wrong {100 * r['wrong']:.1f}%  "
            f"none {100 * r['none']:.1f}%  strangers {100 * r['false_attach']:.1f}%"
        )

    shared = results["shared"]
    updated = space.with_thresholds(shared["embedding"], shared["hybrid_gate"], shared["domain_floor"])
    updated = replace(updated, label_thresholds={})
    for label in ("Scam", "Spam"):
        chosen = results[label]
        updated = updated.with_label_thresholds(
            label, chosen["embedding"], chosen["hybrid_gate"], chosen["domain_floor"]
        )
    updated.save(args.space)

    report = {
        "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "model_version": version,
        "space_id": space.space_id,
        "k": space.k,
        "hdbscan": dict(
            zip(("min_cluster_size", "min_samples", "selection_method", "selection_epsilon"), hdbscan_settings)
        ),
        "seeds": seeds,
        "holdout_fraction": HOLDOUT_FRACTION,
        "rules": "evaluation/item19_preregistration_2026-09-28.md",
        "limits": {"max_wrong": MAX_WRONG, "max_false_attach": MAX_FALSE_ATTACH, "lexical_gate": LEXICAL_GATE},
        "n_messages": int(len(emb)),
        "clustering": stats,
        "chosen": results,
        "raw_space_reference": raw,
    }
    os.makedirs(os.path.dirname(REPORT_PATH), exist_ok=True)
    with open(REPORT_PATH, "w", encoding="utf-8") as fh:
        json.dump(report, fh, indent=2)
    print(f"Wrote thresholds into {os.path.relpath(args.space, AI)} and {os.path.relpath(REPORT_PATH, AI)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
