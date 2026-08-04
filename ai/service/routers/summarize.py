"""Thread summarization endpoint (Sprint 4, WBS 4.3.9).

Backs the mobile "AI Message Summary" display (WBS 4.3.11). Unlike
``/classify`` this needs **no model** -- TF-IDF runs over the thread's own
sentences -- so it stays available even when the fine-tuned checkpoint is
missing, and never returns 503.

Summarization is intentionally separate from classification rather than
another field on ``/classify``: the two have different inputs (a whole
thread vs one message), different lifetimes (a summary is requested when
the user opens a thread, not on every intercepted SMS), and different
costs. Folding them together would compute a summary for every incoming
message that nobody asked for.
"""

from __future__ import annotations

from fastapi import APIRouter

from ..schemas import SummarizeRequest, SummarizeResponse
from ..summarize import summarize_messages

router = APIRouter(tags=["summarization"])


@router.post("/summarize", response_model=SummarizeResponse)
def summarize(req: SummarizeRequest) -> SummarizeResponse:
    result = summarize_messages(req.messages, max_sentences=req.max_sentences)
    return SummarizeResponse(
        summary=result.text,
        sentence_count=result.sentence_count,
        source_message_count=result.source_message_count,
        truncated=result.truncated,
    )
