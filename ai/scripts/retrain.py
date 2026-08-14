"""Automated retraining CLI (Sprint 4, WBS 4.3.5).

Assembles a training snapshot (labeled dataset + validated user reports),
fine-tunes XLM-RoBERTa on it, scores the result against the currently promoted
checkpoint, and records whether the promotion gate would accept it. The
orchestration itself lives in ``retraining/pipeline.py``; this is the thin
command-line surface over it.

Run:

    cd ai && python scripts/retrain.py --dry-run
        Assemble and write the snapshot, print what it contains, stop before
        training. Use this to check the inputs on a machine without a GPU.

    cd ai && python scripts/retrain.py
        Full cycle. Needs a GPU to be practical -- a CPU fine-tune of
        xlm-roberta-base over ~16.8k rows takes many hours. See ai/colab/ for
        the notebook that runs training on Colab.

    cd ai && python scripts/retrain.py --reports-dir datasets/reports
        Include admin-validated user reports from a CSV/JSONL export.

Nothing here swaps the live model. The run records a promote-or-reject verdict
in ``decision.json``; performing the swap is a separate, deliberate step (see
``ai/RETRAINING.md`` -- Rollback), and re-embedding + re-clustering must follow
any swap because campaign centroids are tied to the checkpoint that produced
them.
"""

from __future__ import annotations

import argparse
import os
import sys
from datetime import datetime

sys.path.insert(0, ".")

from retraining.pipeline import (  # noqa: E402
    DEFAULT_BASELINE_DIR,
    DEFAULT_RUNS_ROOT,
    run_retraining,
)
from retraining.reports import FileReportSource, NullReportSource  # noqa: E402
from training.config import TrainingConfig  # noqa: E402


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Run one automated retraining cycle (WBS 4.3.5).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Assemble and write the snapshot, then stop before fine-tuning.",
    )
    parser.add_argument(
        "--labeled-dir",
        default="datasets/labeled",
        help="Labeled dataset directory (default: %(default)s).",
    )
    parser.add_argument(
        "--reports-dir",
        default=None,
        help=(
            "Directory of admin-validated report exports (CSV/JSONL). "
            "Omit while WBS 4.3.1 is unbuilt -- the run then records zero "
            "reports rather than pretending it consulted a store."
        ),
    )
    parser.add_argument(
        "--runs-root",
        default=DEFAULT_RUNS_ROOT,
        help="Where run directories are created (default: %(default)s).",
    )
    parser.add_argument(
        "--baseline",
        default=DEFAULT_BASELINE_DIR,
        help="Promoted checkpoint to compare against (default: %(default)s).",
    )
    parser.add_argument(
        "--max-history",
        type=int,
        default=None,
        help=(
            "Cap rows drawn from the labeled dataset (reservoir-sampled). "
            "Validated reports are always included in full and are never "
            "sampled away. Default: no cap."
        ),
    )
    parser.add_argument(
        "--since",
        default=None,
        help=(
            "Only consume reports validated after this ISO-8601 timestamp. "
            "Defaults to the previous non-dry run's timestamp. Pass 'all' to "
            "consume every report regardless of when it was validated."
        ),
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=TrainingConfig().seed,
        help=(
            "Reservoir + training seed (default: %(default)s). Fixing this is "
            "what makes a snapshot regenerable and two runs comparable."
        ),
    )
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)

    if args.reports_dir and not os.path.isdir(args.reports_dir):
        print(
            f"error: --reports-dir '{args.reports_dir}' does not exist.",
            file=sys.stderr,
        )
        return 2

    source = (
        FileReportSource(args.reports_dir)
        if args.reports_dir
        else NullReportSource()
    )

    # ``datetime.min`` rather than None: None means "fall back to the previous
    # run's watermark", which is the opposite of what --since all asks for.
    since = None
    if args.since == "all":
        since = datetime.min
    elif args.since:
        try:
            since = datetime.fromisoformat(args.since.replace("Z", "+00:00"))
        except ValueError:
            print(
                f"error: --since '{args.since}' is not an ISO-8601 timestamp "
                "(or 'all').",
                file=sys.stderr,
            )
            return 2

    run = run_retraining(
        since=since,
        labeled_dir=args.labeled_dir,
        report_source=source,
        runs_root=args.runs_root,
        baseline_dir=args.baseline,
        max_history=args.max_history,
        seed=args.seed,
        dry_run=args.dry_run,
    )

    print(run.summary())

    if run.dry_run:
        print(
            f"\nSnapshot written to {run.snapshot_dir}\n"
            "Re-run without --dry-run (on a GPU machine) to fine-tune on it."
        )
    elif run.decision and run.decision.promote:
        print(
            "\nThe gate accepts this candidate. Promotion is NOT automatic:\n"
            f"  1. Point the live model at {run.candidate_dir}\n"
            "  2. Re-run scripts/embed_dataset.py and scripts/cluster_campaigns.py\n"
            "     -- campaign centroids are tied to the checkpoint that made them\n"
            "        and are meaningless against a different model's embeddings."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
