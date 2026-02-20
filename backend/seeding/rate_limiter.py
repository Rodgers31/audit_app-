"""Simple synchronous rate limiter primitives."""

from __future__ import annotations

import threading
import time
from contextlib import contextmanager
from typing import Callable, Iterator, TypeVar

T = TypeVar("T")


class RateLimiter:
    """Token bucket rate limiter supporting basic burst control."""

    def __init__(self, tokens: int, period_seconds: float) -> None:
        if tokens <= 0:
            raise ValueError("tokens must be positive")
        if period_seconds <= 0:
            raise ValueError("period_seconds must be positive")

        self._capacity = float(tokens)
        self._tokens = float(tokens)
        self._refill_period = float(period_seconds)
        self._lock = threading.Lock()
        self._last_refill = time.monotonic()

    def acquire(self) -> None:
        """Block until a single token is available."""

        while True:
            with self._lock:
                now = time.monotonic()
                elapsed = now - self._last_refill
                if elapsed > 0:
                    refill = (elapsed / self._refill_period) * self._capacity
                    if refill > 0:
                        self._tokens = min(self._capacity, self._tokens + refill)
                        self._last_refill = now

                if self._tokens >= 1.0:
                    self._tokens -= 1.0
                    return

                deficit = 1.0 - self._tokens
                sleep_for = max(deficit * (self._refill_period / self._capacity), 0.0)

            if sleep_for > 0:
                time.sleep(sleep_for)

    def wrap(self, func: Callable[..., T]) -> Callable[..., T]:
        """Return a function wrapper that enforces the limiter before invocation."""

        def wrapped(*args, **kwargs):
            self.acquire()
            return func(*args, **kwargs)

        return wrapped

    @contextmanager
    def context(self) -> Iterator[None]:
        """Context manager that acquires a token before executing the block."""

        self.acquire()
        try:
            yield
        finally:
            pass

    def __enter__(self) -> "RateLimiter":  # pragma: no cover - trivial
        self.acquire()
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # pragma: no cover - trivial
        return None
