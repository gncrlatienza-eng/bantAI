"""Training configuration for XLM-RoBERTa smishing classification."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict

# Three-way smishing head (matches backend ClassificationResult labels).
ID2LABEL: Dict[int, str] = {0: "Likely Smishing", 1: "Suspicious", 2: "Unknown"}
LABEL2ID: Dict[str, int] = {v: k for k, v in ID2LABEL.items()}


@dataclass
class TrainingConfig:
    # Base model: XLM-RoBERTa uses a SentencePiece tokenizer with a ~250K
    # (250,002) shared multilingual vocabulary — covers Tagalog/English/Taglish
    # out of the box, which is why it was chosen over English-only encoders.
    model_name: str = "xlm-roberta-base"
    num_labels: int = 3
    id2label: Dict[int, str] = field(default_factory=lambda: dict(ID2LABEL))
    label2id: Dict[str, int] = field(default_factory=lambda: dict(LABEL2ID))

    # Data
    dataset_path: str = "datasets/labeled"
    text_column: str = "text"
    label_column: str = "label"
    test_size: float = 0.20  # 80/20 train/validation split
    seed: int = 42

    # Tokenization
    max_length: int = 128

    # Optimization (AdamW is the HuggingFace Trainer default optimizer).
    learning_rate: float = 2e-5
    weight_decay: float = 0.01
    train_batch_size: int = 16
    eval_batch_size: int = 32
    num_epochs: int = 4
    warmup_ratio: float = 0.1

    # Output
    output_dir: str = "models/xlm-roberta-smishing"
