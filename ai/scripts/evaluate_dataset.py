"""HTTP-level accuracy evaluation of the deployed classifier against a labeled CSV.

Unlike evaluate_buckets.py (which loads the model in-process and only scores the
training-time validation split), this script calls the running AI service's
POST /classify endpoint for each row of an arbitrary text,label CSV -- the same
contract ai.service.ts uses, and the same contract the mobile app's debug
"Simulate incoming SMS" tool exercises. That makes it useful for:

  - Testing against data that was never part of training (e.g. real extracted
    scam messages once available), without touching the train/val split.
  - Testing without a phone, an emulator, or a live SMS in the loop at all --
    useful given carrier-side smishing filters can silently drop scam-pattern
    SMS before they ever reach a test device.

Requires the AI service running (from ai/: uvicorn service.main:app --port 8001).

CSV format matches ai/datasets/labeled/sample.csv: columns "text,label" with
label in {Ham, Spam, Scam}.

Run:  cd ai && python scripts/evaluate_dataset.py datasets/labeled/dummy_test.csv
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from collections import Counter

import httpx

EXPECTED = {"Ham": "safe", "Spam": "spam", "Scam": "blocked"}
BUCKETS = ["safe", "unknown", "spam", "blocked"]


def load_rows(path: str) -> list[tuple[str, str]]:
    with open(path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = [(row["text"], row["label"]) for row in reader]
    if not rows:
        sys.exit(f"No rows found in {path}")
    bad = [label for _, label in rows if label not in EXPECTED]
    if bad:
        sys.exit(f"Unexpected label(s) {set(bad)} -- expected one of {sorted(EXPECTED)}")
    return rows


def classify_all(base_url: str, texts: list[str]) -> list[dict]:
    results = []
    # CPU inference (no GPU) can take several seconds per request, especially
    # the first one -- a short timeout here reads as a hang, not a real failure.
    with httpx.Client(base_url=base_url, timeout=30.0) as client:
        for i, text in enumerate(texts):
            try:
                resp = client.post("/classify", json={"message": text})
            except httpx.ConnectError:
                sys.exit(
                    f"Could not reach {base_url} -- is the AI service running?\n"
                    f"  cd ai && uvicorn service.main:app --port 8001"
                )
            except httpx.TimeoutException:
                sys.exit(
                    f"Request timed out classifying message {i + 1}/{len(texts)} "
                    f"(30s) -- the service may be overloaded or stuck."
                )
            if resp.status_code == 503:
                sys.exit("AI service returned 503 (model not ready) -- is a trained model present?")
            resp.raise_for_status()
            results.append(resp.json())
            print(f"\r  classified {i + 1}/{len(texts)}", end="", flush=True)
    print()
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("dataset", help="Path to a text,label CSV")
    parser.add_argument(
        "--url",
        default=os.environ.get("AI_SERVICE_URL", "http://localhost:8001"),
        help="AI service base URL (default: $AI_SERVICE_URL or http://localhost:8001)",
    )
    args = parser.parse_args()

    rows = load_rows(args.dataset)
    texts = [t for t, _ in rows]
    true_labels = [lab for _, lab in rows]

    print("=" * 70)
    print(f"HTTP classifier evaluation -- {len(rows)} messages from {args.dataset}")
    print(f"Target: {args.url}/classify")
    print("=" * 70)

    results = classify_all(args.url, texts)
    predicted_labels = [r["label"] for r in results]
    buckets = [r["bucket"] for r in results]

    label_correct = sum(1 for t, p in zip(true_labels, predicted_labels) if t == p)
    print(
        f"\nRaw label accuracy (predicted label == true label): "
        f"{label_correct}/{len(rows)} ({100 * label_correct / len(rows):.2f}%)"
    )

    print("\nOverall bucket distribution:")
    overall = Counter(buckets)
    for b, n in overall.most_common():
        print(f"  {b:10} {n:5}  ({100 * n / len(buckets):.1f}%)")

    print("\nTrue label x assigned bucket:")
    cross = Counter(zip(true_labels, buckets))
    print(f"  {'':6}" + "".join(f"{h:>10}" for h in BUCKETS))
    for true_label in ("Ham", "Spam", "Scam"):
        row = [cross.get((true_label, b), 0) for b in BUCKETS]
        print(f"  {true_label:6}" + "".join(f"{v:>10}" for v in row))

    print("\nPer-class 'correctly routed' rate (landed in its expected bucket):")
    for true_label in ("Ham", "Spam", "Scam"):
        total = sum(1 for t in true_labels if t == true_label)
        if total == 0:
            continue
        correct = cross.get((true_label, EXPECTED[true_label]), 0)
        unknown = cross.get((true_label, "unknown"), 0)
        wrong = total - correct - unknown
        print(
            f"  {true_label:6} correct={correct:5} ({100 * correct / total:.2f}%)  "
            f"unknown={unknown:5} ({100 * unknown / total:.2f}%)  "
            f"wrong-bucket={wrong:5} ({100 * wrong / total:.2f}%)"
        )

    # The critical safety number: real scams a user would NOT be protected from.
    scam_idx = [i for i, t in enumerate(true_labels) if t == "Scam"]
    if scam_idx:
        scam_to_safe = sum(1 for i in scam_idx if buckets[i] == "safe")
        print(
            f"\nScam messages routed to 'safe' (worst-case miss): "
            f"{scam_to_safe}/{len(scam_idx)} ({100 * scam_to_safe / len(scam_idx):.2f}%)"
        )

    ham_idx = [i for i, t in enumerate(true_labels) if t == "Ham"]
    if ham_idx:
        ham_to_blocked = sum(1 for i in ham_idx if buckets[i] == "blocked")
        print(
            f"Ham messages routed to 'blocked' (worst-case false alarm): "
            f"{ham_to_blocked}/{len(ham_idx)} ({100 * ham_to_blocked / len(ham_idx):.2f}%)"
        )


if __name__ == "__main__":
    main()
