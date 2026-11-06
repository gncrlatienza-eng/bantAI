"""Per-category check of a model on the credential / advance-fee challenge set.

Why this exists
---------------
The 2026-10-14 classification audit found Model C calling Ham on messages that
ask the recipient to *surrender* an OTP/MPIN and on advance-fee job offers,
while the frozen holdout reported ~96% Scam recall. The holdout cannot show
this: its scam rows are 40% gambling bait, with 19 OTP-phishing, 3 fake-job and
2 personal-info rows. The labelled corpus has only ~4 scams that ask for a
code, so the model has barely seen the pattern.

``datasets/challenge/credential_advance_fee_v1.csv`` is a small, authored set of
contrast pairs (surrender vs. legitimate issuance, advance fee vs. honest
notice/promo, telco "send PIN" promos as hard negatives), English and Tagalog.

Rules
-----
* Development diagnostic only. **Never train on these rows and never tune a
  threshold against them** -- doing either turns them into another leaked
  test set. Collect new, reviewed data for training instead (see
  datasets/LABELING_ADDENDUM_2026-10-14.md).
* It is small (dozens of rows): read per-category hits, not an accuracy %.
* The script refuses to score if any challenge row's masked text also appears
  in the labelled corpus or the holdout, so a later merge can't silently leak.

Run (from ai/):
    python evaluation/evaluate_challenge.py models/xlm-roberta-smishing
"""

from __future__ import annotations

import argparse
import csv
import glob
import os
import sys
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from preprocessing import preprocess  # noqa: E402

CHALLENGE_CSV = "datasets/challenge/credential_advance_fee_v1.csv"
LEAK_SOURCES = ("datasets/labeled/*.csv", "datasets/holdout/*.csv")
LABELS = ("Ham", "Spam", "Scam")


def load_challenge(path: str) -> list[dict]:
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def leaked_rows(rows: list[dict], patterns=LEAK_SOURCES) -> list[str]:
    """Challenge categories whose masked text already exists in train/holdout data."""
    challenge = {preprocess(r["text"]): r["category"] for r in rows}
    leaked = []
    for pattern in patterns:
        for path in glob.glob(pattern):
            with open(path, newline="", encoding="utf-8") as f:
                for row in csv.DictReader(f):
                    masked = preprocess(str(row.get("text", "")))
                    if masked in challenge:
                        leaked.append(f"{challenge[masked]} (in {os.path.basename(path)})")
    return leaked


def predict(model_dir: str, texts: list[str]) -> list[dict[str, float]]:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer

    tokenizer = AutoTokenizer.from_pretrained(model_dir)
    model = AutoModelForSequenceClassification.from_pretrained(model_dir).eval()
    order = [model.config.id2label[i] for i in range(model.config.num_labels)]
    out = []
    with torch.no_grad():
        for i in range(0, len(texts), 32):
            batch = tokenizer(
                [preprocess(t) for t in texts[i : i + 32]],
                truncation=True,
                max_length=128,
                padding=True,
                return_tensors="pt",
            )
            for probs in torch.softmax(model(**batch).logits, dim=-1):
                out.append({order[j]: float(probs[j]) for j in range(len(order))})
    return out


def report(rows: list[dict], scores: list[dict[str, float]]) -> int:
    by_category: dict[str, list[tuple[str, str, float]]] = defaultdict(list)
    for row, s in zip(rows, scores):
        predicted = max(s, key=s.get)
        by_category[row["category"]].append((row["label"], predicted, s[predicted]))

    misses = 0
    print(f"{'category':24} {'gold':5} {'correct':>8}  predicted (mean confidence)")
    for category, items in sorted(by_category.items()):
        gold = items[0][0]
        correct = sum(1 for g, p, _ in items if g == p)
        misses += len(items) - correct
        predicted = defaultdict(list)
        for _, p, conf in items:
            predicted[p].append(conf)
        detail = ", ".join(f"{p} x{len(c)} ({sum(c) / len(c):.2f})" for p, c in sorted(predicted.items()))
        print(f"{category:24} {gold:5} {correct:>3}/{len(items):<4}  {detail}")
    total = len(rows)
    print(f"\n{total - misses}/{total} correct. Small authored set: read per category, not as a rate.")
    return misses


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("model_dir")
    parser.add_argument("--challenge", default=CHALLENGE_CSV)
    args = parser.parse_args()

    rows = load_challenge(args.challenge)
    leaked = leaked_rows(rows)
    if leaked:
        sys.exit("Challenge rows found in training/holdout data, scores would be meaningless: " + "; ".join(leaked))
    report(rows, predict(args.model_dir, [r["text"] for r in rows]))


if __name__ == "__main__":
    main()
