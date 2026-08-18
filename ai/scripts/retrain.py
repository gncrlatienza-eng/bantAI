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

    cd ai && python scripts/retrain.py --reports-url http://localhost:3000/api
        Include admin-validated user reports read live from the backend
        (WBS 4.3.1). Needs BANTAI_AI_BACKEND_API_KEY, or --reports-api-key.

    cd ai && python scripts/retrain.py --reports-dir datasets/reports
        Same, from a CSV/JSONL export instead. This is the route for a GPU box
        that cannot reach the backend -- Colab has no path to a laptop's
        localhost:3000.

    cd ai && python scripts/retrain.py --export-reports datasets/reports/validated.csv
        Write the backend's validated reports to that CSV and stop. The bridge
        between the two lines above.

Reports are **never** included implicitly. One of the flags above is required
to consult a store; the default is ``NullReportSource``, which records in the
manifest that no store was consulted rather than reporting a zero that reads
like "none were filed".

Nothing here swaps the live model. The run records a promote-or-reject verdict
in ``decision.json``; performing the swap is a separate, deliberate step (see
``ai/RETRAINING.md`` -- Rollback), and re-embedding + re-clustering must follow
any swap because campaign centroids are tied to the checkpoint that produced
them.

    cd ai && python scripts/retrain.py --register --activate ...
        WBS 4.4.3. --register POSTs the candidate to the backend's
        ModelVersions table as an *inactive* row -- safe the moment a gate
        verdict exists, it is only a record. --activate (implies --register)
        additionally makes it the live ModelVersion, and refuses to do so for
        a rejected candidate. Both need real backend connectivity, which
        Colab does not have -- run them from a machine that can reach the
        backend, against a candidate copied down from Drive.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from datetime import datetime

sys.path.insert(0, ".")

from retraining.pipeline import (  # noqa: E402
    DEFAULT_BASELINE_DIR,
    DEFAULT_RUNS_ROOT,
    run_retraining,
)
from retraining.registry import ModelRegistry, ModelRegistryError  # noqa: E402
from retraining.reports import (  # noqa: E402
    DatabaseReportSource,
    FileReportSource,
    NullReportSource,
    ReportSourceError,
)
from training.config import TrainingConfig  # noqa: E402

#: Read from the environment so one ``ai/.env``-style export serves both this
#: CLI and the inference service (``service/config.py`` reads the same two
#: names via pydantic). Deliberately *not* imported from ``service.config``:
#: ``service/`` is the FastAPI app and ``retraining/`` is the training side,
#: and coupling them would drag pydantic into the training path for two
#: strings.
ENV_BACKEND_URL = "BANTAI_AI_BACKEND_URL"
ENV_BACKEND_API_KEY = "BANTAI_AI_BACKEND_API_KEY"


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
            "Directory of admin-validated report exports (CSV/JSONL). The "
            "offline route -- use it on a GPU box that cannot reach the "
            "backend. Omit both report flags and the run records that no "
            "store was consulted, rather than a zero that reads like 'none "
            "were filed'."
        ),
    )
    parser.add_argument(
        "--reports-url",
        nargs="?",
        const="",
        default=None,
        metavar="URL",
        help=(
            "Read validated reports live from the backend, e.g. "
            f"http://localhost:3000/api. Pass the flag bare to use ${ENV_BACKEND_URL}. "
            "Omitting the flag entirely means no store is consulted -- a set "
            "environment variable is never enough on its own to turn this on. "
            "Mutually exclusive with --reports-dir."
        ),
    )
    parser.add_argument(
        "--reports-api-key",
        default=None,
        help=(
            f"Key for the backend's ApiKeyGuard routes. Defaults to "
            f"${ENV_BACKEND_API_KEY}. Must match the backend's INTERNAL_API_KEY."
        ),
    )
    parser.add_argument(
        "--export-reports",
        default=None,
        metavar="PATH",
        help=(
            "Fetch validated reports from the backend, write them to PATH as "
            "CSV, and exit without training. Use this to carry reports to a "
            "GPU box, then point --reports-dir at the directory there. "
            "Implies --reports-url."
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
    parser.add_argument(
        "--register",
        action="store_true",
        help=(
            "POST the finished candidate to the backend's ModelVersions table "
            "(WBS 4.3.4/4.4.3) as an inactive row, once the gate has produced "
            "a decision. Needs --models-url/--models-api-key (or the "
            f"${ENV_BACKEND_URL}/${ENV_BACKEND_API_KEY} env vars). No-op with "
            "--dry-run: there is no candidate yet."
        ),
    )
    parser.add_argument(
        "--activate",
        action="store_true",
        help=(
            "Implies --register, and additionally makes the candidate the "
            "live ModelVersion. This is the promotion decision -- refuses to "
            "activate a candidate the gate rejected. Nothing here re-points "
            "the running service at the new checkpoint; that is still a "
            "separate manual step (see the note this script prints below)."
        ),
    )
    parser.add_argument(
        "--models-url",
        default=None,
        metavar="URL",
        help=(
            f"Backend base URL for --register/--activate. Defaults to "
            f"${ENV_BACKEND_URL}, same variable --reports-url reads. Colab "
            "cannot reach a laptop's localhost:3000 -- --register/--activate "
            "are only usable from a machine with real backend connectivity."
        ),
    )
    parser.add_argument(
        "--models-api-key",
        default=None,
        help=f"Key for the backend's ModelVersions routes. Defaults to ${ENV_BACKEND_API_KEY}.",
    )
    return parser


def _build_report_source(args):
    """Resolve the report source, or return an error message to exit 2 with.

    Returns ``(source, None)`` on success and ``(None, message)`` on failure.
    Everything checked here is checked *before* any work starts -- a wrong API
    key should cost you a line of output, not a snapshot build followed by a
    401.
    """
    # ``--reports-url`` absent is None; bare is "" (meaning "resolve from the
    # environment"); with a value it is that value. ``--export-reports`` is a
    # database operation by definition, so it implies the bare form.
    raw_url = args.reports_url
    if raw_url is None and args.export_reports:
        raw_url = ""
    wants_database = raw_url is not None

    if args.reports_dir and wants_database:
        return None, "--reports-dir and --reports-url are mutually exclusive; pick one source."

    if not wants_database:
        if args.reports_dir and not os.path.isdir(args.reports_dir):
            return None, f"--reports-dir '{args.reports_dir}' does not exist."
        return (FileReportSource(args.reports_dir) if args.reports_dir else NullReportSource()), None

    url = raw_url or os.environ.get(ENV_BACKEND_URL, "")
    if not url:
        return None, (
            f"--reports-url was given no value and ${ENV_BACKEND_URL} is unset; "
            "pass the URL explicitly, e.g. --reports-url http://localhost:3000/api."
        )

    key = args.reports_api_key or os.environ.get(ENV_BACKEND_API_KEY, "")
    if not key:
        return None, (
            f"reading reports from {url} needs an API key: pass --reports-api-key "
            f"or set ${ENV_BACKEND_API_KEY} (it must match the backend's INTERNAL_API_KEY)."
        )
    return DatabaseReportSource(url, key), None


def _resolve_models_registry(args) -> tuple:
    """Build the :class:`ModelRegistry` for --register/--activate, or an error.

    Independent of report-source resolution on purpose: reports can come
    from a file export (the Colab route), but registration always needs a
    real, reachable backend -- there is no offline equivalent for "record
    this candidate in ModelVersions".
    """
    url = args.models_url or os.environ.get(ENV_BACKEND_URL, "")
    if not url:
        return None, (
            f"--register/--activate need a backend URL: pass --models-url or set "
            f"${ENV_BACKEND_URL}, e.g. --models-url http://localhost:3000/api."
        )
    key = args.models_api_key or os.environ.get(ENV_BACKEND_API_KEY, "")
    if not key:
        return None, (
            f"--register/--activate need an API key: pass --models-api-key or set "
            f"${ENV_BACKEND_API_KEY} (must match the backend's INTERNAL_API_KEY)."
        )
    return ModelRegistry(url, key), None


def _register_candidate(args, run) -> int:
    """Handle --register/--activate for a finished run. Returns an exit code.

    Registration needs a completed gate verdict -- ``run.decision`` -- so it
    is a no-op (with an explanation, not silence) for a dry run or a run the
    gate never reached (e.g. no baseline checkpoint existed yet).
    """
    if run.dry_run:
        print("\n--register/--activate ignored: a dry run has no candidate to register.")
        return 0
    if run.decision is None:
        print(f"\n--register/--activate ignored: {run.skipped_reason or 'no gate decision was produced'}.")
        return 0

    registry, error = _resolve_models_registry(args)
    if error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    try:
        model_id = registry.register(
            version_tag=run.version_tag,
            f1_score=run.decision.candidate_macro_f1,
            notes=(
                f"{run.decision.reason} "
                f"({run.decision.n_fixes} fixes vs {run.decision.n_regressions} regressions, "
                f"p={run.decision.p_value:.6f})"
            ),
        )
        print(f"\nRegistered {run.version_tag} as ModelVersion {model_id} (inactive).")

        if args.activate:
            if not run.decision.promote:
                print(
                    f"NOT activating: the gate rejected this candidate ({run.decision.reason}). "
                    "Registered as an inactive record only."
                )
                return 1
            registry.activate(model_id)
            print(
                f"Activated {run.version_tag} as the live ModelVersion.\n"
                "This does NOT re-point the running service -- that is still a separate step:\n"
                f"  1. Point the live model at {run.candidate_dir}\n"
                "  2. Restart the AI service so /health reports the new version_tag\n"
                "  3. Re-run scripts/embed_dataset.py and scripts/cluster_campaigns.py"
            )
    except ModelRegistryError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    return 0


def _export_reports(source, path: str) -> int:
    """Write validated reports to a CSV and stop.

    The columns are exactly the ones ``datasets/reports/README.md`` documents,
    so the file drops straight into ``--reports-dir`` on the other machine.
    Raw ``text`` -- preprocessing stays inside the training path so that
    training input is produced by the same code as inference input.
    """
    reports = list(source.fetch())
    parent = os.path.dirname(path)
    if parent:
        os.makedirs(parent, exist_ok=True)
    with open(path, "w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["text", "label", "report_id", "validated_at"])
        for report in reports:
            writer.writerow(
                [
                    report.text,
                    report.label,
                    report.report_id or "",
                    report.validated_at.isoformat() if report.validated_at else "",
                ]
            )
    print(f"{source.describe()}\nwrote {len(reports)} validated report(s) to {path}")
    if not reports:
        # Not an error -- but a silent empty CSV is how you end up "including
        # reports" in a GPU run that had none.
        print("note: nothing was exported. Retraining with this file consumes no corrections.")
    return 0


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)

    source, error = _build_report_source(args)
    if error:
        print(f"error: {error}", file=sys.stderr)
        return 2

    # Checked before any work starts, same reasoning as the report source
    # above: a missing --models-url should cost a line of output, not a
    # multi-hour fine-tune followed by an unregistrable candidate.
    if args.register or args.activate:
        _, models_error = _resolve_models_registry(args)
        if models_error:
            print(f"error: {models_error}", file=sys.stderr)
            return 2

    if args.export_reports:
        try:
            return _export_reports(source, args.export_reports)
        except ReportSourceError as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 1

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
                f"error: --since '{args.since}' is not an ISO-8601 timestamp (or 'all').",
                file=sys.stderr,
            )
            return 2

    try:
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
    except ReportSourceError as exc:
        # Surfaced as a clean CLI error rather than a traceback, but it does
        # stop the run: retraining on silently-zero corrections is the outcome
        # this whole path exists to make impossible.
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(run.summary())

    if run.dry_run:
        print(
            f"\nSnapshot written to {run.snapshot_dir}\nRe-run without --dry-run (on a GPU machine) to fine-tune on it."
        )
    elif run.decision and run.decision.promote:
        print(
            "\nThe gate accepts this candidate. Promotion is NOT automatic:\n"
            f"  1. Point the live model at {run.candidate_dir}\n"
            "  2. Re-run scripts/embed_dataset.py and scripts/cluster_campaigns.py\n"
            "     -- campaign centroids are tied to the checkpoint that made them\n"
            "        and are meaningless against a different model's embeddings."
        )

    if args.register or args.activate:
        return _register_candidate(args, run)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
