"""Fetch revenue-by-source payload."""

from __future__ import annotations

import logging
from typing import Any

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.revenue_by_source.fetcher")


def fetch_revenue_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> list[dict[str, Any]]:
    payload = load_json_resource(
        url=settings.revenue_by_source_dataset_url,
        client=client,
        logger=logger,
        label="revenue_by_source",
    )

    if not isinstance(payload, list):
        raise ValueError("revenue_by_source payload must be a list")

    return payload
