"""Request/response models for the ML service API."""

from __future__ import annotations

from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing_extensions import Annotated

# Model prediction classes (what the classifier is trained to output).
Label = Literal["Ham", "Spam", "Scam"]

# User-facing routing buckets (what the app does with the message).
#   safe    -> inbox (shown, reassured)
#   unknown -> inbox (shown, no strong claim — low confidence)
#   spam    -> dropdown (hidden from inbox, retrievable)
#   blocked -> dropdown (hidden from inbox, retrievable)
Bucket = Literal["safe", "unknown", "spam", "blocked"]


#: Longest message accepted. A concatenated SMS tops out near 1,600 characters
#: (10 segments of 160), so this is generous for real traffic while refusing
#: the megabyte body that would otherwise be normalised, regex-masked and
#: tokenised before the 128-token truncation ever discards it (audit item 8).
MAX_MESSAGE_CHARS = 4000

#: Messages one summarize call may cover. A thread this long already
#: summarises to the same few sentences; past it the cost is the caller's to
#: split, not this service's to absorb (audit item 9).
MAX_SUMMARIZE_MESSAGES = 200

#: Hostnames the phone extracted before masking replaced links with [URL].
#: Bounded like the backend's IngestSmsDto; bare hostnames only.
MAX_MESSAGE_DOMAINS = 20
Hostname = Annotated[
    str,
    StringConstraints(
        max_length=253,
        pattern=r"^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$",
    ),
]


class ClassifyRequest(BaseModel):
    message: str = Field(
        ...,
        min_length=1,
        max_length=MAX_MESSAGE_CHARS,
        description=f"Raw SMS body to classify (max {MAX_MESSAGE_CHARS} characters)",
    )
    domains: List[Hostname] = Field(
        default_factory=list,
        max_length=MAX_MESSAGE_DOMAINS,
        description="Lowercase hostnames from the original message. The backend "
        "sends masked text, so these are the only link identity the campaign "
        "matcher's domain tier can use (audit 2026-09-30, finding 5).",
    )


class CampaignMatch(BaseModel):
    """Campaign-clustering outcome for one message (manuscript Stage 5b).

    The AI service decides the match; the backend persists it. ``cluster_id``
    refers to a ``CampaignCluster`` row the backend already knows about.
    """

    cluster_id: Optional[str] = Field(
        None, description="Matched campaign cluster, or null when nothing cleared the threshold"
    )
    similarity: float = Field(..., ge=-1.0, le=1.0, description="Cosine similarity to the closest active centroid")
    matched: bool = Field(
        ...,
        description="Whether the message cleared any of the three match tiers "
        "(see match_reason) — not a single cosine threshold. The embedding-only "
        "bar is 0.999 as of the 2026-09-27 promotion of Model C (0.998 under the "
        "previous checkpoint; re-calibrated in WBS 5.3.6 from the manuscript's 0.85 — the "
        "bar moves with the model, the mechanism does not).",
    )
    should_buffer: bool = Field(
        ...,
        description="True when unmatched — the embedding is buffered for the next offline HDBSCAN re-clustering pass",
    )
    lexical_similarity: float = Field(
        0.0,
        ge=0.0,
        le=1.0,
        description="Word-overlap with the matched campaign's template (WBS 5.3.6 "
        "second signal). 0.0 when the campaign has no lexical profile.",
    )
    match_reason: Optional[Literal["domain", "hybrid", "embedding"]] = Field(
        None,
        description="Which route produced the match — 'domain' (shared scam link, "
        "embedding >= 0.90), 'hybrid' (embedding >= 0.99 corroborated by wording "
        "similarity >= 0.45), or 'embedding' (the calibrated bar alone — 0.999 "
        "as of 2026-09-27, see DEFAULT_SIMILARITY_THRESHOLD in campaign.py). "
        "Null when unmatched.",
    )


class ClassifyResponse(BaseModel):
    version_tag: Optional[str] = Field(None, description="Verified serving checkpoint version for this inference")
    bundle_digest: Optional[str] = Field(
        None, description="Verified approved artifact bundle SHA-256 for this inference"
    )
    label: Label = Field(..., description="Predicted class (Ham/Spam/Scam)")
    score: float = Field(..., ge=0.0, le=1.0, description="Confidence of the predicted class")
    scores: Dict[Label, float] = Field(..., description="Full softmax distribution over all classes")
    bucket: Bucket = Field(..., description="User-facing routing decision")
    masked_text: str = Field(..., description="PII-masked text fed to the model")
    campaign: Optional[CampaignMatch] = Field(
        None,
        description="Campaign clustering result. Null when no campaign centroids "
        "are loaded (cold start), so existing callers stay unaffected.",
    )
    indicators: List[dict] = Field(
        default_factory=list,
        description="Explainability tags for the prediction. Their provenance is in explanation_method.",
    )
    explanation_method: Literal["shap", "keyword-fallback"] = Field(
        "keyword-fallback",
        description="Whether tags came from Shapley attribution or the documented fallback.",
    )


class SummarizeRequest(BaseModel):
    """Thread bodies to summarize, oldest first (WBS 4.3.9).

    A list rather than one blob because the summariser reports how many
    messages it condensed, which the UI needs in order to say "summary of
    30 messages" rather than implying the user has seen everything.
    """

    messages: List[str] = Field(
        ...,
        min_length=1,
        max_length=MAX_SUMMARIZE_MESSAGES,
        description=f"Message bodies in the thread, oldest first (max {MAX_SUMMARIZE_MESSAGES})",
    )
    max_sentences: int = Field(3, ge=1, le=10, description="Upper bound on sentences in the summary")


class SummarizeResponse(BaseModel):
    summary: str = Field(
        ...,
        description="Extractive summary — sentences that were actually sent, in "
        "chronological order. Empty when the thread has no "
        "summarizable content (e.g. only short fragments).",
    )
    sentence_count: int = Field(..., description="Sentences in the summary")
    source_message_count: int = Field(..., description="Messages summarized")
    truncated: bool = Field(
        ...,
        description="Whether content was left out. False means the summary covers every usable sentence in the thread.",
    )


class HealthResponse(BaseModel):
    # ``model_ready`` starts with "model_", Pydantic v2's reserved namespace;
    # disable the guard so it doesn't warn.
    model_config = ConfigDict(protected_namespaces=())

    status: Literal["ok"] = "ok"
    model_ready: bool = Field(..., description="Whether a fine-tuned model is loaded")
    campaign_centroids_loaded: int = Field(
        ...,
        ge=0,
        description="Number of active campaign centroids loaded into the in-memory matcher",
    )
    version_tag: Optional[str] = Field(
        None,
        description="versionTag of the checkpoint this service is actually serving "
        "(from models/<dir>/version.json, written on promotion). Null until the "
        "first promotion writes one -- true of every checkpoint deployed before "
        "WBS 4.4.3, including the one currently live.",
    )
    bundle_digest: Optional[str] = Field(
        None,
        description="SHA-256 bundle digest of the approved files verified at startup "
        "(retraining.checksum.bundle_digest). The backend confirms a deployment only "
        "when this matches the approved registry row. Null until readiness verifies.",
    )


class ReadyResponse(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    status: Literal["ready", "not_ready"]
    model_ready: bool
    reason: str
    version_tag: Optional[str] = None
    artifact_integrity: str
    model_loaded: bool
    test_inference_passed: bool
    checked_artifacts: int = Field(..., ge=0)
    bundle_digest: Optional[str] = None


# --- Retraining round trip (Sprint 4, WBS 4.4.3) ---------------------------- #
# The backend's hourly cron (retraining.service.ts) POSTs here when a trigger
# fires. Training runs on Colab, not on the serving host -- this endpoint
# records the request; it does not train anything. See
# service/routers/retrain.py and RETRAINING.md § Stage 5.

#: What tripped the backend's cron. Kept as ``str`` rather than a ``Literal``
#: of the three known reasons: the backend is the source of truth for trigger
#: names (retraining.service.ts), and a fourth trigger added there someday
#: should not need a matching release here just to stop 422ing.
RetrainTrigger = str


#: Longest trigger name accepted. Each distinct trigger is a row the dedupe
#: cannot collapse, so an unbounded string is an unbounded file (audit item 10).
MAX_TRIGGER_CHARS = 200

#: Backend DatasetSnapshot.versionTag shape (``dataset-20260930...`` or an
#: Admin-chosen tag): short, and safe to echo into logs and file rows.
MAX_DATASET_VERSION_CHARS = 128
DATASET_VERSION_PATTERN = r"^[A-Za-z0-9][A-Za-z0-9._:-]*$"


class RetrainRequest(BaseModel):
    trigger: RetrainTrigger = Field(
        ...,
        min_length=1,
        max_length=MAX_TRIGGER_CHARS,
        description="Why the backend fired this request",
    )
    # Required (audit 2026-09-30, finding 6): a queued job that cannot name
    # the frozen snapshot it should train on cannot be reproduced offline.
    dataset_version: str = Field(
        ...,
        min_length=1,
        max_length=MAX_DATASET_VERSION_CHARS,
        pattern=DATASET_VERSION_PATTERN,
        description="Backend dataset snapshot tag the offline run must train on",
    )


class RetrainJobResponse(BaseModel):
    job_id: str = Field(..., description="Opaque id for this queued request")
    trigger: RetrainTrigger
    dataset_version: Optional[str] = Field(
        None,
        description="Frozen dataset snapshot tag to train on. Null only for jobs "
        "queued before the field existed; those are unversioned and not reproducible.",
    )
    status: Literal["queued", "completed"] = "queued"
    requested_at: str = Field(..., description="ISO-8601 UTC timestamp the request was recorded")
    completed_at: Optional[str] = Field(
        None, description="ISO-8601 UTC timestamp the job was drained; null while queued"
    )


class RetrainJobList(BaseModel):
    jobs: List[RetrainJobResponse]
