"""Fetcher for debt timeline data."""

from __future__ import annotations

import logging
from typing import Any

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.debt_timeline.fetcher")


def fetch_debt_timeline_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> dict[str, Any]:
    """Fetch debt timeline data from CBK/Treasury fixture or API."""
    return load_json_resource(
        url=settings.debt_timeline_dataset_url,
        client=client,
        logger=logger,
        label="debt_timeline",
    )
