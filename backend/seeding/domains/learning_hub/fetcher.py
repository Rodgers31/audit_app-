"""Fetcher for learning hub question data."""

from __future__ import annotations

import logging
from typing import Any

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.learning_hub.fetcher")


def fetch_questions_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> dict[str, Any]:
    """
    Fetch educational questions from curated source or fixture.

    Args:
        client: HTTP client instance
        settings: Seeding configuration

    Returns:
        Parsed JSON payload with question records
    """
    return load_json_resource(
        url=settings.learning_hub_dataset_url,
        client=client,
        logger=logger,
        label="learning_hub",
    )
