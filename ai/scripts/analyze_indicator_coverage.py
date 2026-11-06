"""Measure indicator-tag dictionary coverage against real Spam/Scam messages
(Sprint 5, WBS 5.3.7 -- "polish the SHAP indicator tag dictionary based on
observed outputs").

The dictionary in ``service/indicator_tags.py`` was built from the training
data's own rule vocabulary, but never checked against how often it actually
tags something. This runs the deterministic keyword tagger -- the same path
``explain()`` falls back to whenever real SHAP (WBS 3.3.6) is unavailable,
and the vocabulary both paths share -- over every Spam/Scam row in the
labeled dataset and reports:

    1. What fraction get zero tags (a message the model correctly flags but
       the user gets no "why" for)
    2. Tag frequency, so a tag that fires on nearly everything or almost
       nothing is visible
    3. Language split on the zero-tag rows -- every prior gap in this
       dictionary (Gambling Bait, Fake Job Offer, Unsolicited Credit Offer,
       Personal Info Request, OTP/Account Phishing) turned out to be missing
       Tagalog vocabulary, so that is the first thing worth checking again
       here rather than assuming this round is different
    4. The most common words in zero-tag rows, as keyword candidates

Read-only measurement. Run:

    cd ai && .venv/Scripts/python.exe scripts/analyze_indicator_coverage.py
"""

from __future__ import annotations

import csv
import re
import sys
from collections import Counter

sys.path.insert(0, ".")

from service.indicator_tags import TAG_KEYWORDS, tags_for_message  # noqa: E402

_WORD_RE = re.compile(r"[a-zA-Zà-ÿÀ-Ÿ]+")

# Words too common in any SMS (English or Tagalog function words) to be a
# useful keyword candidate on their own.
_STOPWORDS = {
    "the",
    "a",
    "an",
    "is",
    "are",
    "was",
    "were",
    "to",
    "of",
    "and",
    "or",
    "in",
    "on",
    "for",
    "your",
    "you",
    "at",
    "with",
    "this",
    "that",
    "it",
    "as",
    "by",
    "from",
    "be",
    "will",
    "not",
    "have",
    "has",
    "we",
    "our",
    "please",
    "po",
    "ang",
    "ng",
    "sa",
    "mo",
    "ko",
    "si",
    "na",
    "may",
    "para",
    "ay",
    "yung",
    "mga",
    "ka",
    "ito",
    "kung",
    "din",
    "rin",
    "pa",
    "ba",
    "lang",
    "namin",
    "nyo",
    "niyo",
    "kayo",
    "kami",
    "sila",
    "siya",
}


def load_spam_scam_rows(path: str) -> list:
    with open(path, encoding="utf-8", newline="") as handle:
        return [row for row in csv.DictReader(handle) if row.get("label") in ("Spam", "Scam")]


def main() -> int:
    rows = load_spam_scam_rows("datasets/labeled/bantai_labeled.csv")
    print(f"{len(rows)} Spam/Scam rows\n")

    tag_counts: Counter = Counter()
    zero_tag_rows: list = []
    zero_tag_lang: Counter = Counter()

    for row in rows:
        tags = tags_for_message(row["text"])
        if not tags:
            zero_tag_rows.append(row)
            zero_tag_lang[row.get("language", "?")] += 1
        for t in tags:
            tag_counts[t.tag] += 1

    print("=== Tag frequency (of all Spam/Scam rows) ===")
    for tag in TAG_KEYWORDS:
        n = tag_counts.get(tag, 0)
        print(f"  {tag:28s} {n:5d}  ({100 * n / len(rows):5.1f}%)")
    print(f"  {'Suspicious URL / Brand Imp.':28s} (structural, counted separately, see tags_for_message)")

    zero_pct = 100 * len(zero_tag_rows) / len(rows)
    print(f"\n=== Zero-tag rows: {len(zero_tag_rows)} / {len(rows)} ({zero_pct:.1f}%) ===")
    print("By language:", dict(zero_tag_lang.most_common()))

    print("\n=== Top words in zero-tag rows (candidate keywords) ===")
    covered = {w for kws in TAG_KEYWORDS.values() for kw in kws for w in kw.lower().split()}
    word_counts: Counter = Counter()
    for row in zero_tag_rows:
        words = {w.lower() for w in _WORD_RE.findall(row["text"])}
        for w in words:
            if len(w) >= 4 and w not in _STOPWORDS and w not in covered:
                word_counts[w] += 1
    for word, n in word_counts.most_common(40):
        print(f"  {word:20s} {n:4d}")

    print("\n=== Sample zero-tag rows (first 15) ===")
    for row in zero_tag_rows[:15]:
        print(f"  [{row.get('language', '?'):12s}] {row['text'][:100]}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
