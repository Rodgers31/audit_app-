"""Fetch national budget execution payload."""

from __future__ import annotations

import logging
from typing import Any

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.national_budget.fetcher")


def fetch_national_budget_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> list[dict[str, Any]]:
    payload = load_json_resource(
        url=settings.national_budget_execution_dataset_url,
        client=client,
        logger=logger,
        label="national_budget_execution",
    )

    if not isinstance(payload, list):
        raise ValueError("national_budget_execution payload must be a list")

    # Skip metadata entries (first element has _metadata key)
    return [r for r in payload if "_metadata" not in r]
