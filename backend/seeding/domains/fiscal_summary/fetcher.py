"""Fetcher for fiscal summary data."""

from __future__ import annotations

import logging
from typing import Any

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.fiscal_summary.fetcher")


def fetch_fiscal_summary_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> dict[str, Any]:
    """Fetch fiscal summary data from Treasury/COB fixture or API."""
    return load_json_resource(
        url=settings.fiscal_summary_dataset_url,
        client=client,
        logger=logger,
        label="fiscal_summary",
    )
