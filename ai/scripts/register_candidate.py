"""Register a finished candidate with approval-grade evidence (audit 2026-09-30, finding 2).

An Admin can approve a ModelVersion only when its evidence binds one exact
artifact to one frozen training snapshot and one independent holdout result.
This script assembles that evidence from files on disk and POSTs it to the
backend's machine registry:

    cd ai && python scripts/evaluate_holdout.py --model-dir <candidate>
    cd ai && python scripts/register_candidate.py \\
        --model-dir <candidate> \\
        --holdout-report evaluation/holdout_confusion_<stamp>.json \\
        --dataset-version <snapshot tag> --dataset-digest <sha256>

The candidate is registered inactive and awaiting review. Running it again for
a candidate still under review, with the same files, refreshes the evidence;
different files under the same version tag are refused. Nothing here approves,
deploys, or swaps a model.
"""

from __future__ import annotations

import argparse
import os
import sys

sys.path.insert(0, ".")

from retraining.registry import (  # noqa: E402
    EvidenceError,
    ModelRegistry,
    ModelRegistryError,
    candidate_evidence,
)
from retraining.version_file import read_version  # noqa: E402

ENV_BACKEND_URL = "BANTAI_AI_BACKEND_URL"
ENV_MODELS_API_KEY = "BANTAI_AI_MODELS_API_KEY"


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--model-dir", required=True, help="Candidate checkpoint directory (with version.json).")
    parser.add_argument("--holdout-report", required=True, help="JSON written by scripts/evaluate_holdout.py.")
    parser.add_argument("--dataset-version", required=True, help="Tag of the frozen training snapshot.")
    parser.add_argument("--dataset-digest", required=True, help="SHA-256 of the frozen training snapshot.")
    parser.add_argument("--notes", default=None, help="Optional note stored with the candidate.")
    parser.add_argument("--models-url", default=None, help=f"Backend base URL. Defaults to ${ENV_BACKEND_URL}.")
    parser.add_argument("--models-api-key", default=None, help=f"Registry key. Defaults to ${ENV_MODELS_API_KEY}.")
    return parser


def main(argv=None) -> int:
    args = build_parser().parse_args(argv)
    url = args.models_url or os.environ.get(ENV_BACKEND_URL, "")
    key = args.models_api_key or os.environ.get(ENV_MODELS_API_KEY, "")
    if not url or not key:
        print(
            f"error: pass --models-url/--models-api-key or set ${ENV_BACKEND_URL}/${ENV_MODELS_API_KEY}.",
            file=sys.stderr,
        )
        return 2

    version_tag = read_version(args.model_dir)
    if not version_tag:
        print(f"error: {args.model_dir} has no version.json; it cannot be attributed.", file=sys.stderr)
        return 2

    try:
        f1_score, evaluation, provenance = candidate_evidence(
            args.model_dir, args.holdout_report, args.dataset_version, args.dataset_digest
        )
    except (OSError, ValueError, KeyError, EvidenceError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    try:
        model_id = ModelRegistry(url, key).register(
            version_tag=version_tag,
            f1_score=f1_score,
            notes=args.notes,
            evaluation=evaluation,
            provenance=provenance,
        )
    except ModelRegistryError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    print(
        f"Registered {version_tag} as ModelVersion {model_id} (awaiting Admin review).\n"
        f"  holdout macro-F1 : {f1_score:.4f} over {evaluation['holdout']['rows']} rows\n"
        f"  artifacts        : {len(provenance['artifacts'])} files\n"
        f"  dataset          : {provenance['datasetVersion']}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
