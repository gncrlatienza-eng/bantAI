"""Non-sensitive checks for a local fine-tuned model bundle.

The model artifacts are deliberately ignored by Git, so every developer needs
an inexpensive way to tell "the model was copied to the right directory" from
"the inference server is broken" before starting the full backend stack.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

EXPECTED_LABELS = frozenset({"Ham", "Spam", "Scam"})
WEIGHT_FILENAMES = ("model.safetensors", "pytorch_model.bin")
TOKENIZER_FILENAMES = ("tokenizer.json", "sentencepiece.bpe.model", "spiece.model")


@dataclass(frozen=True)
class ModelBundleReport:
    """Result of inspecting artifacts without loading Torch or a model."""

    model_dir: Path
    errors: tuple[str, ...]
    weight_file: str | None
    tokenizer_file: str | None

    @property
    def is_complete(self) -> bool:
        return not self.errors


def inspect_model_bundle(model_dir: str | Path) -> ModelBundleReport:
    """Check the files and label contract required for local inference.

    This intentionally does not read model weights or SMS data. Use the
    ``--smoke`` option in ``scripts/verify_local_model.py`` to perform the
    slower, real Transformers load after this structural check passes.
    """

    path = Path(model_dir)
    errors: list[str] = []
    weight_file = next((name for name in WEIGHT_FILENAMES if (path / name).is_file()), None)
    tokenizer_file = next((name for name in TOKENIZER_FILENAMES if (path / name).is_file()), None)

    if not path.is_dir():
        errors.append("model directory does not exist")
        return ModelBundleReport(path, tuple(errors), weight_file, tokenizer_file)

    config_path = path / "config.json"
    if not config_path.is_file():
        errors.append("missing config.json")
    else:
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"config.json cannot be read: {exc}")
        else:
            labels = config.get("id2label")
            if not isinstance(labels, dict) or set(labels.values()) != EXPECTED_LABELS:
                errors.append("config.json must define exactly Ham, Spam, and Scam in id2label")

    if weight_file is None:
        errors.append("missing model.safetensors or pytorch_model.bin")
    if tokenizer_file is None:
        errors.append("missing tokenizer.json, sentencepiece.bpe.model, or spiece.model")

    return ModelBundleReport(path, tuple(errors), weight_file, tokenizer_file)
