"""Run the promotion gate on the frozen holdout instead of the validation split.

    cd ai && .venv/Scripts/python.exe scripts/fair_gate_holdout.py

``retraining/promotion.py``'s gate is normally scored on the validation split
(``pipeline.evaluate_candidate``). That comparison favours whichever checkpoint
is currently deployed: the live model trained on an older pool that contains
most of today's validation rows, and it scores 0.982 there against 0.961 on the
holdout. This runs the *same* gate, with the same thresholds, on the frozen
holdout that no compared checkpoint trained on.

Every model is scored one at a time (a 1.1 GB checkpoint at a time, not four),
and predictions are cached so an interrupted run resumes.

**What this is and is not.** It is a like-for-like comparison of candidates
against the incumbent. It is *not* an untouched final test: the same holdout has
now been scored by several candidates, and each extra look weakens it as an
unbiased estimate. The output records how many models were compared so a reader
can weigh that; treat repeated use as exploratory unless a fresh, unused set is
carved out.

Output: ``evaluation/fair_gate_holdout_<timestamp>.json`` -- counts, the exact
command, and the sha256 of every checkpoint and of the holdout, so the run can
be reproduced and attributed. No message text.
"""

from __future__ import annotations

import argparse
import gc
import json
import os
import subprocess
import sys
from datetime import datetime, timezone

sys.path.insert(0, ".")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from evaluate_holdout import (  # noqa: E402
    HOLDOUT_CSV,
    HOLDOUT_MANIFEST,
    LABEL2ID,
    load_holdout,
)

from retraining.checksum import sha256_file, verify_against_manifest  # noqa: E402
from retraining.pipeline import _predict  # noqa: E402
from retraining.promotion import evaluate_promotion  # noqa: E402
from retraining.version_file import read_version, verify_version  # noqa: E402

BASELINE = "models/xlm-roberta-smishing"
CANDIDATES = {
    "run 1": "models/retraining_runs/2026-09-21-colab/candidate",
    "A": "models/retraining_runs/2026-09-21-colab-A/candidate",
    "B": "models/retraining_runs/2026-09-21-colab-B/candidate",
    "C": "models/retraining_runs/2026-09-21-colab-C/candidate",
}


def describe(model_dir: str) -> dict:
    """Identity of a checkpoint: version tag, weights digest, integrity."""
    integrity = verify_version(model_dir)
    weights = os.path.join(model_dir, "model.safetensors")
    return {
        "dir": model_dir,
        "version_tag": read_version(model_dir),
        "sha256": sha256_file(weights) if os.path.isfile(weights) else None,
        "integrity": integrity.status,
        "integrity_detail": integrity.detail,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--baseline", default=BASELINE)
    parser.add_argument(
        "--candidate",
        action="append",
        metavar="NAME=DIR",
        help="repeatable; default: the 2026-09-21 runs",
    )
    parser.add_argument("--holdout-csv", default=HOLDOUT_CSV)
    parser.add_argument("--cache", default=None, help="prediction cache (default: alongside the output)")
    parser.add_argument("--output-dir", default="evaluation")
    parser.add_argument("--allow-drift", action="store_true")
    args = parser.parse_args()

    candidates = dict(pair.split("=", 1) for pair in args.candidate) if args.candidate else dict(CANDIDATES)

    status, detail, holdout_digest = verify_against_manifest(args.holdout_csv, HOLDOUT_MANIFEST, "holdout_csv_sha256")
    print(f"HOLDOUT: {status} -- {detail}")
    if status == "mismatch" and not args.allow_drift:
        sys.exit("error: holdout no longer matches its manifest; refusing to grade (see --allow-drift).")

    models = {"baseline": args.baseline, **candidates}
    identities = {name: describe(path) for name, path in models.items()}
    for name, meta in identities.items():
        print(f"{name:<10} {meta['version_tag'] or '(no version.json)':<26} {meta['integrity']}")

    texts, labels = load_holdout(args.holdout_csv)
    cache_path = args.cache or os.path.join(args.output_dir, "fair_gate_predictions.cache.json")
    cache = {}
    if os.path.isfile(cache_path):
        with open(cache_path, encoding="utf-8") as handle:
            cached = json.load(handle)
        if cached.get("holdout_sha256") == holdout_digest:
            shas = cached.get("shas", {})
            cache = {
                name: preds
                for name, preds in cached.get("predictions", {}).items()
                if identities.get(name, {}).get("sha256") == shas.get(name)
            }

    for name, path in models.items():
        if name in cache:
            continue
        print(f"scoring {name} ...", flush=True)
        cache[name] = [int(p) for p in _predict(path, texts)]
        with open(cache_path, "w", encoding="utf-8") as handle:
            json.dump(
                {
                    "holdout_sha256": holdout_digest,
                    "shas": {k: v["sha256"] for k, v in identities.items()},
                    "predictions": cache,
                },
                handle,
            )
        gc.collect()

    scam = LABEL2ID["Scam"]
    base = cache["baseline"]
    print(f"\n{'candidate':<10}{'verdict':<9}{'macro-F1':>20}{'Scam recall':>22}{'fixes':>7}{'regr':>6}{'p':>9}")
    results = {}
    for name in candidates:
        decision = evaluate_promotion(labels, base, cache[name], scam_label=scam)
        results[name] = {
            "promote": decision.promote,
            "reason": decision.reason,
            "baseline_macro_f1": decision.baseline_macro_f1,
            "candidate_macro_f1": decision.candidate_macro_f1,
            "baseline_scam_recall": decision.baseline_scam_recall,
            "candidate_scam_recall": decision.candidate_scam_recall,
            "n_fixes": decision.n_fixes,
            "n_regressions": decision.n_regressions,
            "p_value": decision.p_value,
        }
        print(
            f"{name:<10}{'PROMOTE' if decision.promote else 'REJECT':<9}"
            f"{decision.baseline_macro_f1:>9.4f}->{decision.candidate_macro_f1:<10.4f}"
            f"{decision.baseline_scam_recall:>10.4f}->{decision.candidate_scam_recall:<11.4f}"
            f"{decision.n_fixes:>7}{decision.n_regressions:>6}{decision.p_value:>9.4f}"
        )
        print(f"          {decision.reason}")

    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
    except Exception:  # noqa: BLE001 -- provenance is best-effort, not a reason to fail
        commit = None

    os.makedirs(args.output_dir, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
    out = os.path.join(args.output_dir, f"fair_gate_holdout_{stamp}.json")
    with open(out, "w", encoding="utf-8") as handle:
        json.dump(
            {
                "what": (
                    "promotion gate (retraining/promotion.py) run on the frozen holdout, not the validation split"
                ),
                "caveat": (
                    f"{len(candidates)} candidates were scored against the same holdout; repeated use weakens it as an "
                    "unbiased final test. Treat as exploratory unless a fresh unused set is used."
                ),
                "command": "python " + " ".join([os.path.relpath(sys.argv[0])] + sys.argv[1:]),
                "git_commit": commit,
                "evaluated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "holdout_csv": args.holdout_csv,
                "holdout_sha256": holdout_digest,
                "holdout_integrity": status,
                "holdout_rows": len(texts),
                "models": identities,
                "results": results,
            },
            handle,
            indent=2,
            default=float,
        )
    print("\nwrote", out)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
