"""Classification endpoint.

Returns HTTP 503 while no fine-tuned model exists (Sprint 1 state). The
request is still validated and PII-masking still runs, so the contract can be
exercised end to end before the model lands in Sprint 2.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..classifier import ModelNotReadyError, classifier, route
from ..schemas import ClassifyRequest, ClassifyResponse

router = APIRouter(tags=["classification"])


@router.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest) -> ClassifyResponse:
    try:
        label, score, masked = classifier.classify(req.message)
    except ModelNotReadyError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)
        ) from exc
    return ClassifyResponse(
        label=label, score=score, routing=route(score), masked_text=masked
    )
