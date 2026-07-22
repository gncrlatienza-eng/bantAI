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

    # Confidence-threshold routing (Sprint 2). Documented here so the contract
    # is stable: >=0.90 auto-block, 0.50-0.90 alert, <0.50 inbox.
    auto_block_threshold: float = 0.90
    alert_threshold: float = 0.50


settings = Settings()
