"""Unit tests for TF-IDF thread summarization (WBS 4.3.9).

Covers the summarizer itself plus the /summarize endpoint that exposes it.
"""

import pytest
from fastapi.testclient import TestClient

from service.main import app
from service.summarize import split_sentences, summarize_messages

client = TestClient(app)


# --- sentence splitting -----------------------------------------------------
def test_splits_on_terminal_punctuation():
    assert len(split_sentences("Your parcel is out. Please confirm receipt.")) == 2


def test_splits_on_newlines_since_sms_often_omits_punctuation():
    text = "Delivery is today\nPlease be at home\nRider will call you"
    assert len(split_sentences(text)) == 3


def test_drops_short_fragments():
    """'ok' and 'thanks po' add nothing but compete for a summary slot."""
    result = split_sentences("ok. thanks. Your package arrives tomorrow morning.")
    assert result == ["Your package arrives tomorrow morning."]


def test_empty_text_yields_no_sentences():
    assert split_sentences("") == []
    assert split_sentences("   ") == []


# --- degenerate inputs ------------------------------------------------------
def test_no_messages_returns_empty_summary():
    summary = summarize_messages([])
    assert summary.text == ""
    assert summary.sentence_count == 0
    assert not summary.truncated


def test_messages_with_no_usable_content_return_empty():
    summary = summarize_messages(["ok", "yes", "po"])
    assert summary.text == ""


def test_single_sentence_is_returned_as_is():
    """TF-IDF over one document is degenerate -- every term has zero IDF."""
    summary = summarize_messages(["Your GCash payment of 500 pesos was received."])
    assert "GCash" in summary.text
    assert not summary.truncated


def test_fewer_sentences_than_limit_are_all_kept():
    summary = summarize_messages(
        ["Package is out for delivery.", "Rider will call you shortly."],
        max_sentences=3,
    )
    assert summary.sentence_count == 2
    assert not summary.truncated


def test_invalid_max_sentences_raises():
    with pytest.raises(ValueError):
        summarize_messages(["Some message here."], max_sentences=0)


# --- actual summarization ---------------------------------------------------
def _long_thread():
    return [
        "Hello po good morning.",
        "Your order 12345 has been confirmed and will ship today.",
        "Thank you for shopping with us.",
        "The rider will contact you at around 3pm this afternoon.",
        "Please prepare exact payment of 1500 pesos.",
        "Have a nice day po.",
    ]


def test_long_thread_is_truncated_to_the_limit():
    summary = summarize_messages(_long_thread(), max_sentences=3)
    assert summary.sentence_count == 3
    assert summary.truncated
    assert summary.source_message_count == 6


def test_summary_preserves_chronological_order():
    """Reordering by relevance reads as non-sequitur -- a conversation's
    chronology is most of its meaning."""
    messages = _long_thread()
    summary = summarize_messages(messages, max_sentences=3)

    all_sentences = []
    for message in messages:
        all_sentences.extend(split_sentences(message))

    picked = [s for s in all_sentences if s in summary.text]
    positions = [all_sentences.index(s) for s in picked]
    assert positions == sorted(positions)


def test_summary_only_contains_sentences_that_were_actually_sent():
    """Extractive by design: an invented amount or deadline is worse than no
    summary in a product where the user is judging whether to trust a message."""
    messages = _long_thread()
    summary = summarize_messages(messages, max_sentences=3)

    all_sentences = []
    for message in messages:
        all_sentences.extend(split_sentences(message))

    for sentence in summary.text.split(" "):
        assert any(sentence in original for original in all_sentences)


def test_distinctive_content_beats_boilerplate():
    """Greetings repeat across the thread and should score low; the sentence
    carrying the order details should survive."""
    messages = [
        "Good morning po.",
        "Good morning po thank you.",
        "Good morning po again.",
        "Your refund of 2500 pesos has been processed to your BPI account.",
        "Good morning po salamat.",
    ]
    summary = summarize_messages(messages, max_sentences=1)
    assert "refund" in summary.text.lower()


def test_handles_taglish_without_english_stopword_bias():
    """sklearn's English stopword list would strip English function words but
    leave Tagalog equivalents, biasing scores toward Tagalog-heavy sentences."""
    messages = [
        "Magandang umaga po sa inyo.",
        "Your account will be suspended unless you verify immediately.",
        "Salamat po sa inyong suporta.",
    ]
    summary = summarize_messages(messages, max_sentences=2)
    assert summary.text
    assert summary.sentence_count == 2


def test_source_message_count_is_reported_for_honest_display():
    """The UI needs to say 'summary of 30 messages' rather than implying the
    user has seen everything."""
    summary = summarize_messages(_long_thread(), max_sentences=2)
    assert summary.source_message_count == 6
    assert summary.truncated


# --- /summarize endpoint ----------------------------------------------------
def test_endpoint_returns_a_summary():
    resp = client.post("/summarize", json={"messages": _long_thread(), "max_sentences": 2})
    assert resp.status_code == 200
    body = resp.json()
    assert body["sentence_count"] == 2
    assert body["source_message_count"] == 6
    assert body["truncated"] is True
    assert body["summary"]


def test_endpoint_works_without_a_model_loaded():
    """TF-IDF runs over the thread's own text, so unlike /classify this must
    never return 503 -- summaries stay available when the checkpoint is
    missing or still downloading."""
    resp = client.post("/summarize", json={"messages": ["Your parcel ships today."]})
    assert resp.status_code == 200


def test_endpoint_defaults_max_sentences():
    resp = client.post("/summarize", json={"messages": _long_thread()})
    assert resp.status_code == 200
    assert resp.json()["sentence_count"] == 3


def test_endpoint_rejects_empty_message_list():
    assert client.post("/summarize", json={"messages": []}).status_code == 422


def test_endpoint_rejects_out_of_range_max_sentences():
    body = {"messages": ["Your parcel ships today."], "max_sentences": 0}
    assert client.post("/summarize", json=body).status_code == 422


def test_endpoint_returns_empty_summary_for_fragments_only():
    """Not an error -- the UI should render nothing rather than a failure."""
    resp = client.post("/summarize", json={"messages": ["ok", "po", "yes"]})
    assert resp.status_code == 200
    assert resp.json()["summary"] == ""
