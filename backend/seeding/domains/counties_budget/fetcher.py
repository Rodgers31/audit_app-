"""Budget domain fetcher."""

from __future__ import annotations

import logging
from typing import Any, Dict

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.counties_budget.fetcher")


def fetch_budget_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> Dict[str, Any]:
    """Retrieve the budgets dataset as JSON."""

    return load_json_resource(
        url=settings.budgets_dataset_url,
        client=client,
        logger=logger,
        label="budgets",
    )


__all__ = ["fetch_budget_payload"]
