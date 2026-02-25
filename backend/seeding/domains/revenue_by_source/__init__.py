"""Revenue by source seeding domain.

Seeds revenue breakdown by tax type per fiscal year from KRA annual performance reports.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ...config import SeedingSettings
from ...http_client import create_http_client
from ...registries import register_domain
from ...types import DomainRunContext, DomainRunResult
from . import fetcher, parser, writer

logger = logging.getLogger("seeding.revenue_by_source")


@register_domain("revenue_by_source")
def run(
    session: Session, settings: SeedingSettings, context: DomainRunContext
) -> DomainRunResult:
    started_at = datetime.now(timezone.utc)
    errors: list[str] = []

    with create_http_client(settings) as client:
        try:
            payload = fetcher.fetch_revenue_payload(client, settings)
        except Exception as exc:
            logger.exception(
                "Failed to fetch revenue_by_source payload",
                extra={"error": str(exc)},
            )
            return (
                DomainRunResult.empty(
                    domain="revenue_by_source",
                    dry_run=context.dry_run,
                    started_at=started_at,
                )
                .with_error(str(exc))
                .model_copy(update={"finished_at": datetime.now(timezone.utc)})
            )

    records = parser.parse_revenue_payload(payload)
    stats = writer.persist_revenue_records(session, records, settings, context)
    errors.extend(stats.errors)

    finished_at = datetime.now(timezone.utc)

    return DomainRunResult(
        domain="revenue_by_source",
        started_at=started_at,
        finished_at=finished_at,
        items_processed=stats.processed,
        items_created=stats.created,
        items_updated=stats.updated,
        dry_run=context.dry_run,
        errors=errors,
        metadata={
            "skipped": stats.skipped,
            "source_url": settings.revenue_by_source_dataset_url,
        },
    )
