"""Audit domain fetcher."""

from __future__ import annotations

import logging
from typing import Any, Dict

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient
from ...utils import load_json_resource

logger = logging.getLogger("seeding.audits.fetcher")


def fetch_audit_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> Dict[str, Any]:
    return load_json_resource(
        url=settings.audits_dataset_url,
        client=client,
        logger=logger,
        label="audits",
    )


__all__ = ["fetch_audit_payload"]
