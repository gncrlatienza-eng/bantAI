"""Sentence embedding extraction for campaign clustering (Sprint 3).

The manuscript (Stage 4/5a/5b) is explicit that classification and campaign
clustering **share one embedding**: the token sequence goes through the twelve
XLM-RoBERTa encoder layers, the final-layer ``[CLS]`` vector is pooled as a
768-dimensional sentence representation, and "this single embedding is reused
by Stages 5a and 5b." So this module deliberately extracts from the *same*
fine-tuned model the classifier uses -- not a separate sentence-transformer.
Using a different encoder here would mean clustering operates in a different
semantic space than classification, which is exactly what the manuscript's
shared-embedding design avoids.

Embeddings are L2-normalized on the way out, which makes cosine similarity a
plain dot product (see ``campaign.cosine_similarity``) and keeps centroid
averaging well-behaved.
"""

from __future__ import annotations

from typing import List, Sequence

from preprocessing import preprocess

from .config import settings

# Final-layer [CLS] vector width for XLM-RoBERTa Base.
EMBEDDING_DIM = 768


def _l2_normalize(vectors):
    import numpy as np

    norms = np.linalg.norm(vectors, axis=-1, keepdims=True)
    # Guard against a zero vector (empty/degenerate input) producing NaNs.
    norms[norms == 0] = 1.0
    return vectors / norms


def embed_texts(
    texts: Sequence[str],
    model,
    tokenizer,
    *,
    batch_size: int = 32,
    already_masked: bool = False,
):
    """Return an ``(n, 768)`` L2-normalized array of [CLS] embeddings.

    ``model`` / ``tokenizer`` are passed in rather than loaded here so callers
    that already hold the classifier's loaded model (the /classify request
    path) reuse it instead of loading a second copy into memory.

    ``already_masked=True`` skips preprocessing -- use it when the caller has
    already masked the text (the classifier does this before inference, and
    masking twice is wasteful though not harmful).
    """
    import numpy as np
    import torch

    prepared = list(texts) if already_masked else [preprocess(t) for t in texts]

    out: List = []
    model.eval()
    with torch.no_grad():
        for i in range(0, len(prepared), batch_size):
            batch = prepared[i : i + batch_size]
            inputs = tokenizer(
                batch,
                truncation=True,
                max_length=settings.max_length,
                padding=True,
                return_tensors="pt",
            )
            # The classification head sits on top of the encoder; asking for
            # hidden states gives access to the encoder output underneath it.
            outputs = model(**inputs, output_hidden_states=True)
            # hidden_states[-1] = final encoder layer; [:, 0, :] = the [CLS]
            # position, which is what the manuscript specifies as the pooled
            # sentence representation.
            cls_vectors = outputs.hidden_states[-1][:, 0, :]
            out.append(cls_vectors.cpu().numpy())

    return _l2_normalize(np.vstack(out).astype("float32"))
