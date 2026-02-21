"""Fetcher for pending bills data from COB reports.

Supports two fetch strategies:
1. Live ETL: Run the pending_bills_extractor to scrape COB website,
   download PDF, extract tables (requires pdfplumber + httpx).
2. Fixture / API: Load from a local JSON fixture or remote API
   (configured via SEED_PENDING_BILLS_DATASET_URL).
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from ...config import SeedingSettings
from ...http_client import SeedingHttpClient

logger = logging.getLogger("seeding.pending_bills.fetcher")


def fetch_pending_bills_payload(
    client: SeedingHttpClient, settings: SeedingSettings
) -> dict[str, Any]:
    """
    Fetch pending bills data.

    Strategy:
      1. If pending_bills_dataset_url is configured (file:// or https://),
         load from that source (same pattern as other domains).
      2. Otherwise, run the live ETL extractor against COB website.

    Args:
        client: HTTP client instance
        settings: Seeding configuration

    Returns:
        Parsed JSON payload with pending bills records
    """
    dataset_url = getattr(settings, "pending_bills_dataset_url", None)

    if dataset_url:
        logger.info(f"Fetching pending bills from configured URL: {dataset_url}")
        from ...utils import load_json_resource

        return load_json_resource(
            url=dataset_url,
            client=client,
            logger=logger,
            label="pending_bills",
        )

    # No fixture URL configured — run live ETL extraction
    logger.info(
        "No pending_bills_dataset_url configured. " "Running live COB extraction..."
    )
    return _run_live_extraction()


def _run_live_extraction() -> dict[str, Any]:
    """Run the pending bills ETL extractor against the COB website."""
    try:
        from etl.pending_bills_extractor import PendingBillsExtractor

        extractor = PendingBillsExtractor()
        # Run the async extractor in a sync context
        loop = asyncio.new_event_loop()
        try:
            result = loop.run_until_complete(extractor.extract_all())
        finally:
            loop.close()

        if not result.get("pending_bills") and not result.get("summary", {}).get(
            "grand_total"
        ):
            logger.warning(
                "Live extraction returned no pending bills data. "
                "The COB reports may require Playwright for PDF download. "
                "Consider setting PLAYWRIGHT_ENABLED=1 and "
                "SEED_PENDING_BILLS_DATASET_URL to a fixture file."
            )
        return result

    except ImportError as exc:
        logger.error(
            f"Cannot run live extraction: {exc}. "
            f"Install required packages: pip install pdfplumber httpx beautifulsoup4"
        )
        return {
            "pending_bills": [],
            "summary": {},
            "source_url": "https://cob.go.ke/reports/",
            "source_title": "Controller of Budget Reports",
            "extraction_error": str(exc),
        }
    except Exception as exc:
        logger.exception(f"Live extraction failed: {exc}")
        return {
            "pending_bills": [],
            "summary": {},
            "source_url": "https://cob.go.ke/reports/",
            "source_title": "Controller of Budget Reports",
            "extraction_error": str(exc),
        }
