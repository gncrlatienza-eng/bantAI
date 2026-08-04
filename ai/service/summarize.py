"""TF-IDF thread summarization (Sprint 4, WBS 4.3.9).

Feeds the mobile "AI Message Summary" display (WBS 4.3.11): a user with 30
unread messages in a thread wants the gist without reading all of them.

**Extractive, not abstractive.** This selects the most informative sentences
that were actually sent; it never generates new wording. That is a
deliberate constraint, not a limitation to fix later -- an abstractive
summariser can hallucinate a detail (a wrong amount, a wrong deadline) into
a message the sender never wrote, and in a security product where the user
is deciding whether to trust a message, invented content is worse than no
summary at all. Extraction cannot invent.

It is also the reason no LLM is involved: a transformer summariser would
need to run on-device or round-trip real SMS content to a third party, and
TF-IDF over the thread itself is both local and free.

Scoring: term frequency-inverse document frequency across the thread's own
sentences. Words repeated across many sentences (greetings, boilerplate)
score low; words distinctive to one sentence score high. The sentences
carrying the most distinctive vocabulary are the ones that carry the
thread's actual content.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import List, Sequence

from sklearn.feature_extraction.text import TfidfVectorizer

#: Sentence boundaries. SMS punctuation is unreliable -- messages routinely
#: run on without terminators -- so newlines split too, and a bare newline
#: is treated as a boundary even without punctuation.
_SENTENCE_SPLIT = re.compile(r"(?<=[.!?])\s+|\n+")

#: Below this many words a "sentence" is almost always a fragment ("ok",
#: "thanks", "po") that adds nothing to a summary but competes for a slot.
_MIN_SENTENCE_WORDS = 3


@dataclass(frozen=True)
class Summary:
    """A thread summary plus the provenance needed to display it honestly.

    ``truncated`` tells the UI whether content was dropped, so it can show
    "summary of 30 messages" rather than implying the user has seen
    everything.
    """

    text: str
    sentence_count: int
    source_message_count: int
    truncated: bool


def split_sentences(text: str) -> List[str]:
    """Split into candidate sentences, dropping fragments and whitespace."""
    if not text:
        return []
    parts = _SENTENCE_SPLIT.split(text)
    return [
        cleaned
        for part in parts
        if (cleaned := part.strip())
        and len(cleaned.split()) >= _MIN_SENTENCE_WORDS
    ]


def summarize_messages(
    messages: Sequence[str],
    max_sentences: int = 3,
) -> Summary:
    """Summarize a thread by extracting its most distinctive sentences.

    Sentences are returned in their **original order**, not scored order.
    A summary reordered by relevance reads as non-sequitur when the
    underlying messages describe a sequence of events -- the reader loses
    the thread's chronology, which for a conversation is most of its
    meaning.

    Degrades gracefully rather than raising:

    - No messages, or nothing that survives fragment filtering -> empty
      summary. The UI should show nothing, not an error.
    - Fewer sentences than ``max_sentences`` -> returns them all,
      ``truncated=False``. Nothing was summarised away.
    - A single sentence -> returned as-is. TF-IDF over one document is
      degenerate (every term has zero IDF), so scoring is skipped entirely.

    Args:
        messages: Thread bodies, oldest first.
        max_sentences: Upper bound on sentences in the summary.
    """
    if max_sentences < 1:
        raise ValueError(f"max_sentences must be >= 1, got {max_sentences}")

    source_count = len(messages)
    sentences: List[str] = []
    for message in messages:
        sentences.extend(split_sentences(message))

    if not sentences:
        return Summary("", 0, source_count, False)

    if len(sentences) <= max_sentences:
        return Summary(
            text=" ".join(sentences),
            sentence_count=len(sentences),
            source_message_count=source_count,
            truncated=False,
        )

    scores = _score_sentences(sentences)

    # Take the top-scoring indices, then restore chronological order.
    top_indices = sorted(
        sorted(range(len(sentences)), key=lambda i: scores[i], reverse=True)[
            :max_sentences
        ]
    )

    return Summary(
        text=" ".join(sentences[i] for i in top_indices),
        sentence_count=len(top_indices),
        source_message_count=source_count,
        truncated=True,
    )


def _score_sentences(sentences: List[str]) -> List[float]:
    """Mean TF-IDF weight of each sentence's terms.

    Mean rather than sum: summing rewards length, so the longest sentence
    wins almost regardless of content. Averaging measures information
    *density*, which is what makes a sentence worth a summary slot.

    ``norm=None`` is essential and not a detail. With sklearn's default L2
    normalization every row sums-of-squares to 1, so a short sentence
    concentrates all its weight into few terms and a long one spreads it
    thin -- mean score then measures brevity, not informativeness, and
    "Good morning po." beats the sentence carrying the actual refund
    amount. Caught by test_distinctive_content_beats_boilerplate. Without
    normalization each weight stays tf*idf, so boilerplate repeated across
    the thread (low IDF) scores low and distinctive vocabulary scores high,
    which is the property this function is supposed to rank on.

    Falls back to length-based scoring when the vectorizer finds no usable
    vocabulary -- possible when every sentence is pure punctuation or
    stopwords. Returning something ranked is better than raising, since a
    mediocre summary still beats a crashed screen.
    """
    try:
        matrix = TfidfVectorizer(
            lowercase=True,
            # No English stopword list: threads are Tagalog/Taglish as often
            # as English, and sklearn's list would strip English function
            # words while leaving their Tagalog equivalents, systematically
            # biasing scores toward Tagalog-heavy sentences.
            stop_words=None,
            sublinear_tf=True,
            norm=None,
        ).fit_transform(sentences)
    except ValueError:
        return [float(len(s.split())) for s in sentences]

    scores: List[float] = []
    for row_index in range(matrix.shape[0]):
        row = matrix.getrow(row_index)
        n_terms = row.nnz
        scores.append(float(row.sum() / n_terms) if n_terms else 0.0)
    return scores
