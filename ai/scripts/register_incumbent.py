"""One-off: register the currently deployed checkpoint as the first
``ModelVersion`` row (Sprint 4, WBS 4.4.3).

``ModelVersions`` has been empty since it was created (PR #39) -- every
retraining run since has scored candidates against the checkpoint on disk,
never against a row in this table. That has two real costs documented in
``backend/src/retraining/retraining.service.ts``: the F1-degradation trigger
can never fire (it reads ``activeModel``, which is always ``null``), and
``lastPromotedAt`` defaults to the Unix epoch, which makes the validated-report
trigger mean "every validated report ever" instead of "since the last
promotion."

This does **not** change what is served. It records what already is: the
2026-07-29 checkpoint (`AI_MODEL_RESULTS.md` run 3), macro-F1 0.9438,
accuracy 0.9544, as the active ``ModelVersion``. Run once, by hand, against a
real backend -- this is not part of any test suite or CI job.

Also writes ``version.json`` beside the checkpoint (if it does not have one
yet) so ``GET /health`` can report a real ``version_tag`` for it instead of
``null``.

Run:
    cd ai && .venv/Scripts/python.exe scripts/register_incumbent.py \\
        --backend-url http://localhost:3000/api --api-key <INTERNAL_API_KEY>
"""

from __future__ import annotations

import argparse
import sys

sys.path.insert(0, ".")

from retraining.registry import ModelRegistry, ModelRegistryError  # noqa: E402
from retraining.version_file import read_version, write_version  # noqa: E402

#: AI_MODEL_RESULTS.md, "2026-07-29, run 3 (final)" -- the checkpoint
#: currently at models/xlm-roberta-smishing/.
INCUMBENT_VERSION_TAG = "v2026-07-29-run3"
INCUMBENT_MACRO_F1 = 0.9438
INCUMBENT_ACCURACY = 0.9544
INCUMBENT_NOTES = (
    "The pre-WBS-4.4.3 deployed checkpoint, registered retroactively so "
    "ModelVersions has a first row to compare candidates against. Trained "
    "2026-07-29 on 15,728 rows -- see AI_MODEL_RESULTS.md 'run 3 (final)'. "
    "0.00% train/val leakage verified."
)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--backend-url", required=True, metavar="URL", help="e.g. http://localhost:3000/api")
    parser.add_argument("--api-key", required=True, help="Must match the backend's INTERNAL_API_KEY.")
    parser.add_argument(
        "--model-dir",
        default="models/xlm-roberta-smishing",
        help="Default: %(default)s -- the currently deployed checkpoint.",
    )
    parser.add_argument(
        "--activate",
        action="store_true",
        help=(
            "Also mark it active (POST /models/:id/activate). Do this unless "
            "the backend already has a different active ModelVersion you "
            "want to keep -- e.g. if this script is being re-run after a "
            "real promotion already happened."
        ),
    )
    args = parser.parse_args()

    registry = ModelRegistry(args.backend_url, args.api_key)

    try:
        active = registry.get_active()
    except ModelRegistryError as exc:
        print(f"error: could not reach the backend: {exc}", file=sys.stderr)
        return 1

    if active is not None:
        print(f"Backend already has an active ModelVersion: {active.get('versionTag')!r}. Not registering again.")
        print("(Delete it in ModelVersions first if you really want to replace it.)")
        return 0

    try:
        model_id = registry.register(
            version_tag=INCUMBENT_VERSION_TAG,
            f1_score=INCUMBENT_MACRO_F1,
            accuracy=INCUMBENT_ACCURACY,
            notes=INCUMBENT_NOTES,
        )
        print(f"Registered {INCUMBENT_VERSION_TAG} as ModelVersion {model_id} (inactive).")

        if args.activate:
            registry.activate(model_id)
            print(f"Activated {INCUMBENT_VERSION_TAG} as the live ModelVersion.")
    except ModelRegistryError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1

    if read_version(args.model_dir) is None:
        write_version(args.model_dir, INCUMBENT_VERSION_TAG)
        print(
            f"Wrote version.json into {args.model_dir} ({INCUMBENT_VERSION_TAG}). Restart the AI service to pick it up."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
