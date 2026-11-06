"""Compare two existing checkpoints on the same validation split, with real examples.

Track B, adviser-prep tool (2026-08-26). The retraining pipeline already scores
a freshly-trained candidate against the incumbent (``retraining/pipeline.py:
evaluate_candidate``) and can write out the actual disagreeing messages, not
just their counts (``_write_disagreements`` -> ``disagreements.json``). That
capability has never been exposed on its own, so answering "can I see actual
examples of what the new model fixed / broke" for a checkpoint that already
exists always meant re-running a multi-hour fine-tune just to reach the
scoring step. This script calls the same, already-tested scoring path directly
against two checkpoint directories -- no training involved.

**Deliberately re-splits against the CURRENT datasets/labeled/ pool**, not a
reproduction of retraining_run_2026-08-17.json's exact validation rows: that
run predates the 2026-08-18 holdout carve-out, and some of its rows physically
no longer live in datasets/labeled/ (they moved to datasets/holdout/). A
literal reproduction is no longer possible; a fresh comparison against today's
pool is honest instead, and incidentally excludes holdout rows from either
side of this comparison as a side effect. Expect the metrics to differ
slightly from the archived 2026-08-17 numbers for exactly this reason -- that
is not a bug in either run.

Run:
    cd ai && python scripts/compare_checkpoints.py \\
        --candidate-dir models/retraining_runs/2026-08-17T14-25-52Z/candidate

    (--baseline-dir defaults to the currently deployed checkpoint. The
    candidate directory only exists locally once copied down from Google
    Drive -- see the run manifest's own note on where the weights live.)

Writes, under --out-dir (default models/checkpoint_comparison/ -- inside
ai/models/, which .gitignore already excludes wholesale via "ai/models/*/",
the same protection retraining_runs/ relies on; ai/evaluation/ is NOT
gitignored, so this deliberately does not default there):
    summary.json         Safe to move out and commit if you want to. Aggregate
                          metrics + class-level transition counts
                          ("Scam->Spam: 3"). No message text.
    disagreements.json   NEVER commit this one, wherever it ends up. Every
                          disagreeing row's real (masked) text, true label,
                          and both models' predictions -- this is the file
                          that actually answers "show me examples." If you
                          point --out-dir somewhere else, confirm it's
                          gitignored first.
"""

from __future__ import annotations

import argparse
import json
import os
import sys

sys.path.insert(0, ".")

from retraining.pipeline import DISAGREEMENTS_JSON, evaluate_candidate  # noqa: E402
from training.config import TrainingConfig  # noqa: E402
from training.dataset import load_split  # noqa: E402


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--baseline-dir",
        default="models/xlm-roberta-smishing",
        help="Currently deployed checkpoint (default: %(default)s).",
    )
    parser.add_argument(
        "--candidate-dir",
        required=True,
        help="Candidate checkpoint to compare against the baseline.",
    )
    parser.add_argument(
        "--labeled-dir",
        default="datasets/labeled",
        help="Labeled dataset directory to rebuild the validation split from (default: %(default)s).",
    )
    parser.add_argument(
        "--out-dir",
        default="models/checkpoint_comparison",
        help=(
            "Where summary.json and disagreements.json are written (default: "
            "%(default)s, inside ai/models/ so it's gitignored automatically -- "
            "disagreements.json contains real masked SMS text and must never "
            "be committed)."
        ),
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=TrainingConfig().seed,
        help="Train/val split seed (default: %(default)s -- same as training, for a comparable split).",
    )
    return parser


def _checkpoint_error(flag: str, path: str) -> str:
    """None if ``path`` looks like a checkpoint dir, else the error to print."""
    if not os.path.isfile(os.path.join(path, "config.json")):
        return f"{flag} '{path}' has no config.json -- not a model checkpoint directory."
    return ""


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)

    # Checked before any work starts, same reasoning as scripts/retrain.py: a
    # typo'd path should cost a line of output, not a partially-built
    # validation split followed by a confusing failure deep inside torch.
    for flag, path in (("--baseline-dir", args.baseline_dir), ("--candidate-dir", args.candidate_dir)):
        error = _checkpoint_error(flag, path)
        if error:
            print(f"error: {error}", file=sys.stderr)
            return 2

    config = TrainingConfig(dataset_path=args.labeled_dir, seed=args.seed)
    print(f"Building validation split from '{args.labeled_dir}' (seed={args.seed}) ...")
    _, val_texts, _, val_labels = load_split(config)
    print(f"{len(val_texts)} validation rows.\n")

    os.makedirs(args.out_dir, exist_ok=True)

    print(f"Scoring baseline : {args.baseline_dir}")
    print(f"Scoring candidate: {args.candidate_dir}")
    print("(scores both checkpoints over every validation row -- CPU: several minutes; GPU: under a minute)\n")

    decision = evaluate_candidate(
        args.baseline_dir,
        args.candidate_dir,
        val_texts,
        val_labels,
        run_dir=args.out_dir,
    )

    summary = {
        "baseline_dir": args.baseline_dir,
        "candidate_dir": args.candidate_dir,
        "labeled_dir": args.labeled_dir,
        "seed": args.seed,
        "n_validation_rows": len(val_texts),
        "promote": decision.promote,
        "reason": decision.reason,
        "baseline_macro_f1": decision.baseline_macro_f1,
        "candidate_macro_f1": decision.candidate_macro_f1,
        "n_fixes": decision.n_fixes,
        "n_regressions": decision.n_regressions,
        "p_value": decision.p_value,
        "fix_transitions": decision.fix_transitions,
        "regression_transitions": decision.regression_transitions,
    }
    summary_path = os.path.join(args.out_dir, "summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(decision.reason)
    print("\nWrote:")
    print(f"  {summary_path}  (committable -- no message text)")
    print(f"  {os.path.join(args.out_dir, DISAGREEMENTS_JSON)}  (DO NOT COMMIT -- contains real masked SMS text)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
