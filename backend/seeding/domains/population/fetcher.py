"""Population domain fetcher leveraging the shared HTTP client."""

from __future__ import annotations

import logging
from typing import Any, Dict

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.population.fetcher")


def fetch_population_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> Dict[str, Any]:
    """Retrieve the population dataset payload as JSON."""

    return load_json_resource(
        url=settings.population_dataset_url,
        client=client,
        logger=logger,
        label="population",
    )


__all__ = ["fetch_population_payload"]
