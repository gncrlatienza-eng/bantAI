"""Bucket-level evaluation of the trained model using production routing.

Reuses training.dataset.load_split (same seed=42 val split the model was
scored on) and service.classifier.route (the exact production routing logic:
argmax -> gap check -> confidence threshold) so these numbers reflect what a
real user would see, not just raw argmax accuracy. Requires a trained model at
config.output_dir (default models/xlm-roberta-smishing).

Run:  cd ai && python scripts/evaluate_buckets.py
"""

from __future__ import annotations

import sys
from collections import Counter

sys.path.insert(0, ".")

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

from service.classifier import route
from training.config import TrainingConfig
from training.dataset import load_split

cfg = TrainingConfig()
train_texts, val_texts, train_labels, val_labels = load_split(cfg)

tok = AutoTokenizer.from_pretrained(cfg.output_dir)
model = AutoModelForSequenceClassification.from_pretrained(cfg.output_dir)
model.eval()

id2label = model.config.id2label  # {0: 'Ham', 1: 'Spam', 2: 'Scam'}

buckets = []
all_scores = []
BATCH = 64
with torch.no_grad():
    for i in range(0, len(val_texts), BATCH):
        batch = val_texts[i : i + BATCH]
        inputs = tok(batch, truncation=True, max_length=cfg.max_length, padding=True, return_tensors="pt")
        logits = model(**inputs).logits
        probs = torch.softmax(logits, dim=-1)
        for row in probs:
            scores = {id2label[j]: float(row[j]) for j in range(len(row))}
            all_scores.append(scores)
            buckets.append(route(scores))

true_label_names = [id2label[lab] for lab in val_labels]

# Expected bucket per true label under a PERFECT router.
EXPECTED = {"Ham": "safe", "Spam": "spam", "Scam": "blocked"}

print("=" * 70)
print(f"Bucket-level evaluation -- {len(val_texts)} validation messages")
print("=" * 70)

overall = Counter(buckets)
print("\nOverall bucket distribution:")
for b, n in overall.most_common():
    print(f"  {b:10} {n:5}  ({100 * n / len(buckets):.1f}%)")

print("\nTrue label x assigned bucket:")
cross = Counter(zip(true_label_names, buckets))
header = ["safe", "spam", "blocked", "unknown"]
print(f"  {'':6}" + "".join(f"{h:>10}" for h in header))
for true_label in ("Ham", "Spam", "Scam"):
    row = [cross.get((true_label, b), 0) for b in header]
    print(f"  {true_label:6}" + "".join(f"{v:>10}" for v in row))

print("\nPer-class 'correctly routed' rate (landed in its expected bucket):")
for true_label in ("Ham", "Spam", "Scam"):
    total = sum(1 for t in true_label_names if t == true_label)
    correct = cross.get((true_label, EXPECTED[true_label]), 0)
    unknown = cross.get((true_label, "unknown"), 0)
    wrong = total - correct - unknown
    print(
        f"  {true_label:6} correct={correct:5} ({100 * correct / total:.2f}%)  "
        f"unknown={unknown:5} ({100 * unknown / total:.2f}%)  "
        f"wrong-bucket={wrong:5} ({100 * wrong / total:.2f}%)"
    )

# The critical safety number: real scams that a user would NOT be protected
# from -- i.e. routed to "safe" (told it's fine) rather than blocked/unknown.
scam_idx = [i for i, t in enumerate(true_label_names) if t == "Scam"]
scam_to_safe = sum(1 for i in scam_idx if buckets[i] == "safe")
print(
    f"\nScam messages routed to 'safe' (worst-case miss): "
    f"{scam_to_safe} / {len(scam_idx)} ({100 * scam_to_safe / len(scam_idx):.2f}%)"
)

ham_idx = [i for i, t in enumerate(true_label_names) if t == "Ham"]
ham_to_blocked = sum(1 for i in ham_idx if buckets[i] == "blocked")
print(
    f"Ham messages routed to 'blocked' (worst-case false alarm): "
    f"{ham_to_blocked} / {len(ham_idx)} ({100 * ham_to_blocked / len(ham_idx):.2f}%)"
)
