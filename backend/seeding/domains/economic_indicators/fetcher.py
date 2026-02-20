"""Fetch economic indicator payload."""

from __future__ import annotations

import logging
from typing import Any

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.economic_indicators.fetcher")


def fetch_economic_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> list[dict[str, Any]]:
    payload = load_json_resource(
        url=settings.economic_indicators_dataset_url,
        client=client,
        logger=logger,
        label="economic_indicators",
    )

    if not isinstance(payload, list):  # pragma: no cover - defensive check
        raise ValueError("economic indicators payload must be a list")

    return payload
