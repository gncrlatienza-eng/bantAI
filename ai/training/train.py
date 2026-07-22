"""Fine-tune XLM-RoBERTa for smishing classification.

Run from the ``ai/`` directory once labeled data is in
``ai/datasets/labeled/`` and dependencies are installed:

    python -m training.train

Produces a saved model + tokenizer in ``config.output_dir`` that the inference
service (``ai/service``) loads automatically.

Note: this is the Sprint 1 *environment* — the actual fine-tune (Sprint 2) needs
the Philippine smishing dataset and, realistically, a GPU.
"""

from __future__ import annotations

import numpy as np

from .config import TrainingConfig
from .dataset import build_hf_datasets
from .tokenizer import assert_vocab_size, get_tokenizer


def compute_metrics(eval_pred):
    from sklearn.metrics import accuracy_score, precision_recall_fscore_support

    logits, labels = eval_pred
    preds = np.argmax(logits, axis=-1)
    precision, recall, f1, _ = precision_recall_fscore_support(
        labels, preds, average="macro", zero_division=0
    )
    return {
        "accuracy": accuracy_score(labels, preds),
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def main(config: TrainingConfig | None = None) -> None:
    import torch
    from transformers import (
        AutoModelForSequenceClassification,
        DataCollatorWithPadding,
        Trainer,
        TrainingArguments,
    )

    config = config or TrainingConfig()

    tokenizer = get_tokenizer(config.model_name)
    assert_vocab_size(tokenizer)

    train_ds, val_ds = build_hf_datasets(config, tokenizer)

    model = AutoModelForSequenceClassification.from_pretrained(
        config.model_name,
        num_labels=config.num_labels,
        id2label=config.id2label,
        label2id=config.label2id,
    )

    args = TrainingArguments(
        output_dir=config.output_dir,
        learning_rate=config.learning_rate,          # AdamW (Trainer default)
        weight_decay=config.weight_decay,
        per_device_train_batch_size=config.train_batch_size,
        per_device_eval_batch_size=config.eval_batch_size,
        num_train_epochs=config.num_epochs,
        warmup_ratio=config.warmup_ratio,
        seed=config.seed,
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        fp16=torch.cuda.is_available(),
        logging_steps=50,
        report_to="none",
    )

    trainer = Trainer(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        tokenizer=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=compute_metrics,
    )

    trainer.train()
    trainer.save_model(config.output_dir)
    tokenizer.save_pretrained(config.output_dir)
    print(f"Saved fine-tuned model to {config.output_dir}")


if __name__ == "__main__":
    main()
