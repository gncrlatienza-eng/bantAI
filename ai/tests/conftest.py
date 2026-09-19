"""Test-wide isolation for configuration read at service import time."""

import pytest


@pytest.fixture(autouse=True)
def reset_service_api_key(monkeypatch):
    """Keep HTTP route tests deterministic when a developer has an AI key."""
    from service.config import settings

    monkeypatch.setattr(settings, "service_api_key", "")
