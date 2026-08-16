"""Classification endpoint.

Returns HTTP 503 while no fine-tuned model exists (Sprint 1 state). The
request is still validated and PII-masking still runs, so the contract can be
exercised end to end before the model lands in Sprint 2.

Sprint 3 adds the campaign-clustering branch (manuscript Stage 5b): the same
embedding used for classification is matched against active campaign centroids
and the outcome is returned for the backend to persist. The AI service never
writes to the database -- see ``service/campaign.py`` for why the dependency is
kept one-directional.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, status

from ..campaign import CampaignMatcher
from ..classifier import ModelNotReadyError, classifier, route
from ..schemas import CampaignMatch, ClassifyRequest, ClassifyResponse

router = APIRouter(tags=["classification"])

#: Active campaign centroids, refreshed from the backend after each offline
#: re-clustering pass. Empty at cold start, in which case no campaign matching
#: is reported at all (rather than reporting a misleading "no match").
matcher = CampaignMatcher()


@router.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest) -> ClassifyResponse:
    try:
        result = classifier.classify_full(req.message)
    except ModelNotReadyError as exc:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(exc)) from exc

    # Campaign matching is only meaningful for messages that could belong to a
    # campaign. Clusters are built from the Spam+Scam population (personal
    # conversation is not a coordinated blast), so comparing a Ham message
    # against them is meaningless by construction -- and empirically harmful:
    # verified 2026-07-30 that "Hi, are we still meeting at 5pm later?" matched
    # a money-transfer-notification cluster at 0.96, because both are short and
    # transactional in tone. Gating on the predicted label removes that whole
    # class of false positive.
    campaign = None
    if matcher.centroids and result.label != "Ham":
        # The raw body (not ``masked_text``) goes in: the matcher masks
        # internally for its wording comparison, but ``shares_domain`` needs
        # the link identity that masking is specifically designed to destroy.
        match = matcher.match(result.embedding, req.message)
        campaign = CampaignMatch(**match.to_dict())

    return ClassifyResponse(
        label=result.label,
        score=result.score,
        scores=result.scores,
        bucket=route(result.scores),
        masked_text=result.masked_text,
        campaign=campaign,
    )
