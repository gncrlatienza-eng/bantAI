"""Test-wide isolation for configuration read at service import time."""

import pytest


@pytest.fixture(autouse=True)
def reset_service_api_key(monkeypatch):
    """Keep HTTP route tests deterministic when a developer has an AI key.

    Route tests run under the explicit local opt-out (test environment +
    ALLOW_UNAUTHENTICATED_DEV); auth tests override these per test.
    """
    from service.config import settings

    monkeypatch.setattr(settings, "service_api_key", "")
    monkeypatch.setattr(settings, "environment", "test")
    monkeypatch.setattr(settings, "allow_unauthenticated_dev", True)
