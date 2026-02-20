"""Tests for the seeding HTTP client helper."""

from __future__ import annotations

import httpx
import pytest
from seeding.config import SeedingSettings
from seeding.http_client import SeedingHttpClient
from seeding.storage import SimpleHTTPCache


@pytest.fixture()
def seeding_settings(tmp_path):
    settings = SeedingSettings(
        storage_path=tmp_path / "storage",
        cache_path=tmp_path / "cache",
        log_path=tmp_path / "logs" / "seed.log",
        retry_backoff=0.01,
        max_retries=3,
    )
    settings.ensure_directories()
    return settings


def test_http_client_uses_cache(seeding_settings):
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        return httpx.Response(200, json={"ok": True}, request=request)

    transport = httpx.MockTransport(handler)
    cache = SimpleHTTPCache(seeding_settings.cache_path, ttl_seconds=60)
    client = httpx.Client(transport=transport, headers=seeding_settings.default_headers)

    with SeedingHttpClient(seeding_settings, cache=cache, client=client) as http_client:
        first = http_client.get("https://example.com/data")
        assert first.status_code == 200
        assert first.extensions.get("seeding_cache") is False

        second = http_client.get("https://example.com/data")
        assert second.status_code == 200
        assert second.extensions.get("seeding_cache") is True

    assert calls["count"] == 1


def test_http_client_handles_404_without_raise(seeding_settings):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, request=request)

    transport = httpx.MockTransport(handler)
    cache = SimpleHTTPCache(seeding_settings.cache_path, ttl_seconds=60)
    client = httpx.Client(transport=transport, headers=seeding_settings.default_headers)

    with SeedingHttpClient(seeding_settings, cache=cache, client=client) as http_client:
        response = http_client.get(
            "https://example.com/missing",
            raise_for_status=False,
            cache=False,
        )

    assert response.status_code == 404
    # 4xx responses should not be cached
    assert response.extensions.get("seeding_cache") is False


def test_http_client_retries_on_server_error(seeding_settings):
    calls = {"count": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        calls["count"] += 1
        if calls["count"] < 2:
            return httpx.Response(500, request=request)
        return httpx.Response(200, json={"attempt": calls["count"]}, request=request)

    transport = httpx.MockTransport(handler)
    cache = SimpleHTTPCache(seeding_settings.cache_path, ttl_seconds=60)
    client = httpx.Client(transport=transport, headers=seeding_settings.default_headers)

    with SeedingHttpClient(seeding_settings, cache=cache, client=client) as http_client:
        response = http_client.get("https://example.com/retry")

    assert response.status_code == 200
    assert calls["count"] == 2
