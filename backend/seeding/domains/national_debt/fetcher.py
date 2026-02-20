"""Fetcher for National Treasury debt bulletin data."""

from __future__ import annotations

import logging
from typing import Any

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.national_debt.fetcher")


def fetch_debt_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> dict[str, Any]:
    """
    Fetch debt data from National Treasury bulletins or fixture.

    Args:
        client: HTTP client instance
        settings: Seeding configuration

    Returns:
        Parsed JSON payload with debt records
    """
    return load_json_resource(
        url=settings.national_debt_dataset_url,
        client=client,
        logger=logger,
        label="national_debt",
    )
