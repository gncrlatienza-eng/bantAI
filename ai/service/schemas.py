"""Request/response models for the ML service API."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

Label = Literal["Likely Smishing", "Suspicious", "Unknown"]
Routing = Literal["auto_block", "alert", "inbox"]


class ClassifyRequest(BaseModel):
    message: str = Field(..., min_length=1, description="Raw SMS body to classify")


class ClassifyResponse(BaseModel):
    label: Label = Field(..., description="Predicted class")
    score: float = Field(..., ge=0.0, le=1.0, description="Softmax confidence")
    routing: Routing = Field(..., description="Threshold-based routing decision")
    masked_text: str = Field(..., description="PII-masked text fed to the model")


class HealthResponse(BaseModel):
    # ``model_ready`` starts with "model_", Pydantic v2's reserved namespace;
    # disable the guard so it doesn't warn.
    model_config = ConfigDict(protected_namespaces=())

    status: Literal["ok"] = "ok"
    model_ready: bool = Field(..., description="Whether a fine-tuned model is loaded")
