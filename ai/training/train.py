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


def compute_class_weights(train_ds, num_labels: int):
    """Inverse-frequency weights: ``n_samples / (n_classes * class_count)``.

    Ham is ~62% of the dataset, so unweighted training is rewarded for
    defaulting to Ham whenever it is unsure. These weights make each class
    contribute equally to the loss regardless of how many examples it has.

    Returns a list of floats indexed by label id, or None when a class is
    missing from the training split (weighting is meaningless then, and a
    zero-count class would divide by zero).
    """
    # The tokenized dataset carries ``label``; DataCollatorWithPadding renames
    # it to ``labels`` only at batch time, so accept either name here.
    names = getattr(train_ds, "column_names", None) or list(train_ds)
    column = "labels" if "labels" in names else "label"

    counts = [0] * num_labels
    for label in train_ds[column]:
        counts[int(label)] += 1
    if any(c == 0 for c in counts):
        return None
    total = sum(counts)
    return [total / (num_labels * c) for c in counts]


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
        # Trainer keeps a FULL checkpoint per epoch by default -- model weights
        # *and* AdamW optimizer state (~3.4GB each for this model), even though
        # only the final `trainer.save_model()` call below is ever used. That
        # turned a ~1.1GB model into a 7GB download for no benefit. Keep just
        # the 1 checkpoint load_best_model_at_end needs to restore the best
        # epoch.
        save_total_limit=1,
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        fp16=torch.cuda.is_available(),
        logging_steps=50,
        report_to="none",
    )

    weights = (
        compute_class_weights(train_ds, config.num_labels)
        if config.class_weighted_loss
        else None
    )

    trainer_cls = Trainer
    if weights is not None:
        print("Class-weighted loss: " + ", ".join(
            f"{config.id2label[i]}={w:.3f}" for i, w in enumerate(weights)
        ))

        class WeightedTrainer(Trainer):
            """Trainer with inverse-frequency class weights in the loss.

            ``num_items_in_batch`` is accepted because transformers >=4.46
            passes it positionally to ``compute_loss``; swallowing it here
            keeps the override compatible across 4.4x and 5.x.
            """

            def compute_loss(self, model, inputs, return_outputs=False,
                             num_items_in_batch=None):
                labels = inputs.pop("labels")
                outputs = model(**inputs)
                loss = torch.nn.functional.cross_entropy(
                    outputs.logits.view(-1, config.num_labels),
                    labels.view(-1),
                    weight=torch.tensor(
                        weights, dtype=outputs.logits.dtype,
                        device=outputs.logits.device,
                    ),
                )
                # Restore for downstream consumers (eval loop reads this back).
                inputs["labels"] = labels
                return (loss, outputs) if return_outputs else loss

        trainer_cls = WeightedTrainer

    trainer = trainer_cls(
        model=model,
        args=args,
        train_dataset=train_ds,
        eval_dataset=val_ds,
        # Renamed from ``tokenizer=`` in transformers 4.46; the old name was
        # removed outright in 5.x, so passing it raises TypeError.
        processing_class=tokenizer,
        data_collator=DataCollatorWithPadding(tokenizer),
        compute_metrics=compute_metrics,
    )

    trainer.train()
    trainer.save_model(config.output_dir)
    tokenizer.save_pretrained(config.output_dir)
    print(f"Saved fine-tuned model to {config.output_dir}")


if __name__ == "__main__":
    main()
