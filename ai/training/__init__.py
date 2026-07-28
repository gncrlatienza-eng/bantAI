"""XLM-RoBERTa fine-tuning environment for smishing classification."""

from .config import ID2LABEL, LABEL2ID, TrainingConfig

__all__ = ["TrainingConfig", "ID2LABEL", "LABEL2ID"]
