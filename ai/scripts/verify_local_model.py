"""Validate a teammate's private model bundle before local AI-service testing.

Run from ``ai/``:

    python scripts/verify_local_model.py --smoke

The script never reads a dataset or prints message content. ``--smoke`` loads
the checkpoint and classifies one built-in, non-sensitive string so the result
also catches incompatible or partial model files.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# ``python scripts/verify_local_model.py`` places ``scripts/`` rather than
# ``ai/`` on sys.path. Add the project package root so the documented command
# works without requiring an editable install or a manual PYTHONPATH change.
AI_ROOT = Path(__file__).resolve().parents[1]
if str(AI_ROOT) not in sys.path:
    sys.path.insert(0, str(AI_ROOT))

from service.classifier import SmishingClassifier  # noqa: E402 -- path bootstrap above
from service.config import settings  # noqa: E402 -- path bootstrap above
from service.model_bundle import inspect_model_bundle  # noqa: E402 -- path bootstrap above


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--model-dir",
        default=settings.model_dir,
        help="Model bundle directory (default: BANTAI_AI_MODEL_DIR)",
    )
    parser.add_argument(
        "--smoke",
        action="store_true",
        help="Load the model and classify a built-in non-sensitive test string",
    )
    args = parser.parse_args()

    report = inspect_model_bundle(args.model_dir)
    print(f"model_dir={report.model_dir}")
    if not report.is_complete:
        for error in report.errors:
            print(f"ERROR: {error}")
        return 2

    print(f"bundle=complete weight_file={report.weight_file} tokenizer_file={report.tokenizer_file}")
    if not args.smoke:
        return 0

    classifier = SmishingClassifier(model_dir=str(report.model_dir))
    result = classifier.classify_full("Local bantAI smoke check: visit https://example.invalid/ref/123")
    print(f"model_load=ok label={result.label} bucket={result.bucket} score={result.scores[result.label]:.4f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
