"""Runtime configuration for the ML inference service.

Values are read from the environment (prefix ``BANTAI_AI_``) or an optional
``.env`` file. See ``ai/.env.example``.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_prefix="BANTAI_AI_",
        env_file=".env",
        extra="ignore",
        # ``model_dir`` starts with "model_", Pydantic v2's reserved namespace;
        # disable the guard so it doesn't warn.
        protected_namespaces=(),
    )

    # Directory holding the fine-tuned XLM-RoBERTa model (config.json + weights
    # + tokenizer). Populated by ai/training/train.py in Sprint 2; until then
    # the service reports the model as not ready.
    model_dir: str = "models/xlm-roberta-smishing"
    max_length: int = 128

    # Confidence-threshold routing (Sprint 2). The model predicts Ham/Spam/Scam
    # with a confidence score; these per-class thresholds decide the user-facing
    # bucket. A prediction below its class threshold falls back to "unknown"
    # (kept in the inbox so nothing important is ever hidden on a weak guess).
    # The bar is deliberately highest for "blocked" — hiding a real message is
    # the most costly mistake. Tune these once the model's score distribution is
    # observed on real data.
    safe_threshold: float = 0.50  # Ham  -> safe    (inbox)
    spam_threshold: float = 0.60  # Spam -> spam    (dropdown)
    block_threshold: float = 0.90  # Scam -> blocked (dropdown)

    # Minimum gap between the top two class probabilities. When the winner
    # leads the runner-up by less than this, the model is treated as "torn"
    # (e.g. 0.50/0.50/0.00) and the message routes to "unknown" regardless of
    # thresholds — a near-tie is not a confident call and must not be acted on.
    review_margin: float = 0.15

    # --- Campaign clustering (Sprint 3) ---------------------------------- #
    # Where the live matcher gets its campaign centroids from:
    #   "backend" -- fetch from GET /campaigns/centroids on the NestJS
    #                service (default; the production path)
    #   "file"    -- read scripts/cluster_campaigns.py output. No-backend,
    #                no-database bootstrap/local-dev fallback.
    #   "none"    -- disable campaign matching entirely
    centroid_source: str = "backend"
    cluster_file: str = "datasets/processed/campaign_clusters.json"
    backend_url: str = "http://localhost:3000/api"

    # Shared secret for the backend's ApiKeyGuard-protected internal routes --
    # GET /campaigns/centroids (this service) and GET /reports (the retraining
    # pipeline). Must equal the backend's ``INTERNAL_API_KEY``. Empty means the
    # header is omitted entirely, which those routes answer with 401; since
    # ``load_centroids`` swallows failures by design, an unset key shows up as
    # "0 campaigns loaded" rather than an error, so check this first if
    # matching is silently doing nothing.
    backend_api_key: str = ""

    # Cosine similarity a message must reach to join an existing campaign
    # (manuscript Stage 5b). The manuscript specifies 0.85; measured against
    # real data that attaches 54.5% of *unrelated* messages, because the
    # classifier embedding this reuses encodes class rather than campaign.
    # Re-calibrated to 0.999 in Sprint 5 (WBS 5.3.6) -- see
    # service/campaign.py:DEFAULT_SIMILARITY_THRESHOLD for the full sweep.
    campaign_threshold: float = 0.999


settings = Settings()
