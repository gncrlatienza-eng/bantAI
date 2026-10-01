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
from ..explainer import explain
from ..language import is_supported_language
from ..readiness import require_model_ready
from ..schemas import CampaignMatch, ClassifyRequest, ClassifyResponse

router = APIRouter(tags=["classification"])

#: Active campaign centroids, refreshed from the backend after each offline
#: re-clustering pass. Empty at cold start, in which case no campaign matching
#: is reported at all (rather than reporting a misleading "no match").
matcher = CampaignMatcher()


@router.post("/classify", response_model=ClassifyResponse)
def classify(req: ClassifyRequest) -> ClassifyResponse:
    require_model_ready()
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
        # The body goes in as received (the backend sends masked text): the
        # matcher masks internally for its wording comparison. Link identity
        # arrives separately as ``domains``, because masking destroys it.
        match = matcher.match(
            result.embedding,
            req.message,
            domains=req.domains,
            label=result.label,
        )
        campaign = CampaignMatch(**match.to_dict())

    # Keyword tagger only -- deliberately no model/tokenizer, so real SHAP never
    # runs inside this request. SHAP needs hundreds of forward passes: measured
    # 9.7-45.7 s per message on 2026-09-21 (13-26 s in July), while the backend
    # abandons /classify after 3.5 s (backend/src/ai/ai.service.ts) and the phone
    # after 5 s. Running it here made every message time out and fall back to
    # the phone's keyword heuristic, so no SMS got a model verdict at all. The
    # keyword tags are instant and still reach the app; full SHAP has to run
    # after the response, not before it (docs/api/explainability.md).
    explanation = explain(req.message, result.masked_text, predicted_label=result.label)

    # A message in a language the model wasn't trained on (Italian, Spanish,
    # Chinese...) gets out-of-distribution scores that can look confident.
    # Never let those auto-block or hide it: route to "unknown" so the user
    # reviews it. The label and score are left as the model gave them.
    bucket = route(result.scores)
    if bucket in ("blocked", "spam") and not is_supported_language(req.message):
        bucket = "unknown"

    return ClassifyResponse(
        label=result.label,
        score=result.score,
        scores=result.scores,
        bucket=bucket,
        masked_text=result.masked_text,
        campaign=campaign,
        indicators=explanation.to_indicator_payload(),
        explanation_method=explanation.method,
    )
