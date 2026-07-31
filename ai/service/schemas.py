"""Request/response models for the ML service API."""

from __future__ import annotations

from typing import Dict, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

# Model prediction classes (what the classifier is trained to output).
Label = Literal["Ham", "Spam", "Scam"]

# User-facing routing buckets (what the app does with the message).
#   safe    -> inbox (shown, reassured)
#   unknown -> inbox (shown, no strong claim — low confidence)
#   spam    -> dropdown (hidden from inbox, retrievable)
#   blocked -> dropdown (hidden from inbox, retrievable)
Bucket = Literal["safe", "unknown", "spam", "blocked"]


class ClassifyRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Raw SMS body to classify")


class CampaignMatch(BaseModel):
    """Campaign-clustering outcome for one message (manuscript Stage 5b).

    The AI service decides the match; the backend persists it. ``cluster_id``
    refers to a ``CampaignCluster`` row the backend already knows about.
    """

    cluster_id: Optional[str] = Field(
        None, description="Matched campaign cluster, or null when nothing cleared the threshold"
    )
    similarity: float = Field(
        ..., ge=-1.0, le=1.0, description="Cosine similarity to the closest active centroid"
    )
    matched: bool = Field(..., description="Whether similarity met the 0.85 threshold")
    should_buffer: bool = Field(
        ...,
        description="True when unmatched — the embedding is buffered for the next "
                    "offline HDBSCAN re-clustering pass",
    )


class ClassifyResponse(BaseModel):
    label: Label = Field(..., description="Predicted class (Ham/Spam/Scam)")
    score: float = Field(..., ge=0.0, le=1.0, description="Confidence of the predicted class")
    scores: Dict[Label, float] = Field(
        ..., description="Full softmax distribution over all classes"
    )
    bucket: Bucket = Field(..., description="User-facing routing decision")
    masked_text: str = Field(..., description="PII-masked text fed to the model")
    campaign: Optional[CampaignMatch] = Field(
        None,
        description="Campaign clustering result. Null when no campaign centroids "
                    "are loaded (cold start), so existing callers stay unaffected.",
    )


class HealthResponse(BaseModel):
    # ``model_ready`` starts with "model_", Pydantic v2's reserved namespace;
    # disable the guard so it doesn't warn.
    model_config = ConfigDict(protected_namespaces=())

    status: Literal["ok"] = "ok"
    model_ready: bool = Field(..., description="Whether a fine-tuned model is loaded")
