"""HTTP client tailored for seeding workloads."""

from __future__ import annotations

import logging
from contextlib import AbstractContextManager
from typing import Any, Optional

import httpx
from tenacity import (
    Retrying,
    before_sleep_log,
    retry_if_exception,
    stop_after_attempt,
    wait_exponential,
)

from .config import SeedingSettings
from .rate_limiter import RateLimiter
from .storage import SimpleHTTPCache

logger = logging.getLogger("seeding.http")


def _is_retryable(exception: BaseException) -> bool:
    if isinstance(exception, httpx.HTTPStatusError):
        status = exception.response.status_code
        return status >= 500 or status == 429
    return isinstance(exception, httpx.TransportError)


class SeedingHttpClient(AbstractContextManager["SeedingHttpClient"]):
    """Synchronous HTTP client with rate limiting, retry, and optional caching."""

    def __init__(
        self,
        settings: SeedingSettings,
        rate_limiter: Optional[RateLimiter] = None,
        cache: Optional[SimpleHTTPCache] = None,
        client: Optional[httpx.Client] = None,
        request_logger: Optional[logging.Logger] = None,
    ) -> None:
        self._settings = settings
        self._logger = request_logger or logger
        tokens, period = settings.rate_limit_window
        self._rate_limiter = rate_limiter or RateLimiter(
            tokens=tokens, period_seconds=period
        )
        self._cache = cache
        self._client = client or httpx.Client(
            timeout=settings.timeout_seconds,
            headers=settings.default_headers,
            follow_redirects=settings.http_follow_redirects,
        )

    def close(self) -> None:
        self._client.close()

    def __exit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - trivial
        self.close()
        return None

    def __enter__(self) -> "SeedingHttpClient":  # pragma: no cover - trivial
        return self

    def request(
        self,
        method: str,
        url: str,
        *,
        raise_for_status: bool = True,
        cache: Optional[bool] = None,
        **kwargs: Any,
    ) -> httpx.Response:
        method_upper = method.upper()
        params = kwargs.get("params")
        use_cache = cache if cache is not None else self._settings.http_cache_enabled
        cached_response: Optional[httpx.Response] = None
        if (
            use_cache
            and self._cache
            and method_upper == "GET"
            and not kwargs.get("stream")
            and kwargs.get("data") is None
            and kwargs.get("files") is None
        ):
            cached_response = self._cache.get(method_upper, url, params=params)
            if cached_response is not None:
                self._logger.debug(
                    "HTTP cache hit",
                    extra={"url": url, "method": method_upper},
                )
                return cached_response

        self._logger.debug(
            "HTTP request",
            extra={"url": url, "method": method_upper, "cached": False},
        )

        retryer = Retrying(
            reraise=True,
            stop=stop_after_attempt(max(self._settings.max_retries, 1)),
            wait=wait_exponential(
                multiplier=self._settings.retry_backoff,
                min=self._settings.retry_backoff,
                max=self._settings.retry_backoff * 8,
            ),
            retry=retry_if_exception(_is_retryable),
            before_sleep=before_sleep_log(self._logger, logging.WARNING),
        )

        response: Optional[httpx.Response] = None
        for attempt in retryer:
            with attempt:
                with self._rate_limiter.context():
                    response = self._client.request(method_upper, url, **kwargs)
                if raise_for_status:
                    response.raise_for_status()
                break

        if response is None:  # pragma: no cover - defensive
            raise RuntimeError("HTTP request did not produce a response")

        response.extensions["seeding_cache"] = False
        if (
            use_cache
            and self._cache
            and method_upper == "GET"
            and response.status_code == 200
            and not kwargs.get("stream")
        ):
            self._cache.set(response)
        return response

    def get(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("POST", url, **kwargs)

    def head(self, url: str, **kwargs: Any) -> httpx.Response:
        return self.request("HEAD", url, **kwargs)


def create_http_client(settings: SeedingSettings) -> SeedingHttpClient:
    cache_backend: Optional[SimpleHTTPCache] = None
    if settings.http_cache_enabled:
        cache_backend = SimpleHTTPCache(settings.cache_path, settings.cache_ttl_seconds)
    return SeedingHttpClient(settings=settings, cache=cache_backend)


__all__ = ["SeedingHttpClient", "create_http_client"]
