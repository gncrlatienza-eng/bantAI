"""XLM-RoBERTa tokenizer setup (SentencePiece, ~250K vocab)."""

from __future__ import annotations

from functools import lru_cache

# XLM-RoBERTa's SentencePiece model exposes 250,002 tokens (250K subword vocab
# + special tokens). We assert against this so a wrong/local tokenizer is
# caught early during environment setup.
EXPECTED_VOCAB_SIZE = 250002


@lru_cache(maxsize=2)
def get_tokenizer(model_name: str = "xlm-roberta-base"):
    """Load the (cached) SentencePiece tokenizer for ``model_name``.

    Requires ``transformers`` and ``sentencepiece`` (see requirements.txt).
    """
    from transformers import AutoTokenizer

    return AutoTokenizer.from_pretrained(model_name)


def assert_vocab_size(tokenizer) -> None:
    """Sanity-check that the multilingual 250K vocab is loaded."""
    actual = tokenizer.vocab_size
    if actual != EXPECTED_VOCAB_SIZE:
        raise ValueError(
            f"Unexpected tokenizer vocab size {actual}; "
            f"expected {EXPECTED_VOCAB_SIZE} for XLM-RoBERTa."
        )


def tokenize(tokenizer, texts, max_length: int = 128):
    """Tokenize a batch of already-preprocessed strings."""
    return tokenizer(
        texts,
        truncation=True,
        max_length=max_length,
        padding=False,  # dynamic padding via DataCollator at train time
    )
