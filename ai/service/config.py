"""Runtime configuration for the ML inference service.

Values are read from the environment (prefix ``BANTAI_AI_``) or an optional
``.env`` file. See ``ai/.env.example``.
"""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict

from .campaign import DEFAULT_SIMILARITY_THRESHOLD
from .retrain_queue import DEFAULT_QUEUE_PATH


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

    # Separate machine credentials: each is accepted by only one internal
    # capability. They must never be bundled in the web dashboard.
    campaigns_api_key: str = ""
    models_api_key: str = ""

    # Cosine similarity a message must reach to join an existing campaign
    # (manuscript Stage 5b). The manuscript specifies 0.85; measured against
    # real data that attaches 54.5% of *unrelated* messages, because the
    # classifier embedding this reuses encodes class rather than campaign.
    # Re-calibrated to 0.999 in Sprint 5 (WBS 5.3.6), then 0.998 after the
    # 2026-08-30 model promotion -- see
    # service/campaign.py:DEFAULT_SIMILARITY_THRESHOLD for the full sweep.
    # Sourced from that constant rather than re-declared here, so the two
    # cannot silently drift apart if the calibrated value ever changes.
    campaign_threshold: float = DEFAULT_SIMILARITY_THRESHOLD

    # Shared secret callers must present as ``x-api-key`` on /classify,
    # /summarize and /retrain. Empty (the default) leaves the service open,
    # which is fine on a laptop where only the local backend can reach it and
    # is what every existing dev setup assumes -- but it is not safe once the
    # service is reachable beyond that boundary, so `main.py` logs a warning
    # at startup while it is unset (audit item 7). /health stays open either
    # way: a health check that needs a secret cannot be used by the thing
    # deciding whether this process is alive.
    service_api_key: str = ""

    # Deployment environment tag ("development", "production", "test"). Used
    # by startup checks to decide whether an empty ``service_api_key`` is a
    # warning or a hard error, and by log formatters that vary by env.
    environment: str = "development"

    # Allow the service to boot without an ``x-api-key`` requirement in dev.
    # Ignored in production, where a missing key is fatal by policy.
    allow_unauthenticated_dev: bool = False

    # Hard cap on inbound request body size (bytes). Default 384 KiB is
    # comfortably above MAX_SUMMARIZE_MESSAGES * MAX_MESSAGE_CHARS and refuses
    # obvious abuse without needing an upstream reverse-proxy limit.
    max_request_body_bytes: int = 393_216

    # Concurrency ceiling for CPU-bound inference work. Beyond this the
    # semaphore rejects rather than queueing, so a burst does not blow the
    # process memory with pending tokenisation buffers.
    max_concurrent_operations: int = 4

    # --- Retraining round trip (Sprint 4, WBS 4.4.3) --------------------- #
    # Where POST /retrain records the backend's trigger requests. Training
    # itself does not happen here -- there is no GPU on the serving host --
    # so this is a queue a human drains with `scripts/retrain.py` on Colab,
    # not a job runner. A subdirectory (not a bare file directly under
    # `models/`) so `ai/models/*/` in .gitignore covers it automatically --
    # that pattern only ignores directories, not files placed straight in
    # `models/`.
    retrain_queue_path: str = DEFAULT_QUEUE_PATH

    # Where `main.py`'s startup check reads the currently active model from,
    # to compare against the version this service is actually serving (see
    # `models/xlm-roberta-smishing/version.json`). Reuses the same backend
    # as `centroid_source="backend"`, but with the distinct models key.
    version_check_enabled: bool = True


settings = Settings()
