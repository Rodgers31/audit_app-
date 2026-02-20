"""National debt seeding domain."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ...config import SeedingSettings
from ...http_client import create_http_client
from ...registries import register_domain
from ...types import DomainRunContext, DomainRunResult
from . import fetcher, parser, writer

logger = logging.getLogger("seeding.national_debt")


@register_domain("national_debt")
def run(
    session: Session, settings: SeedingSettings, context: DomainRunContext
) -> DomainRunResult:
    """
    Execute national debt seeding domain.

    Fetches debt data from National Treasury bulletins and populates
    the loans table with government debt records.

    Args:
        session: Database session
        settings: Seeding configuration
        context: Domain execution context

    Returns:
        Result with metrics and errors
    """
    started_at = datetime.now(timezone.utc)
    errors: list[str] = []

    with create_http_client(settings) as client:
        try:
            payload = fetcher.fetch_debt_payload(client, settings)
        except Exception as exc:
            logger.exception("Failed to fetch debt payload", extra={"error": str(exc)})
            return DomainRunResult(
                domain="national_debt",
                started_at=started_at,
                finished_at=datetime.now(timezone.utc),
                items_processed=0,
                items_created=0,
                items_updated=0,
                errors=[f"Fetch failed: {exc}"],
            )

    try:
        records = parser.parse_debt_payload(payload)
    except Exception as exc:
        logger.exception("Failed to parse debt payload", extra={"error": str(exc)})
        return DomainRunResult(
            domain="national_debt",
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            items_processed=0,
            items_created=0,
            items_updated=0,
            errors=[f"Parse failed: {exc}"],
        )

    try:
        created, updated = writer.write_debt_records(
            session,
            records,
            dataset_id="national-debt",
            job_id=context.job_id,
        )
    except Exception as exc:
        logger.exception("Failed to write debt records", extra={"error": str(exc)})
        return DomainRunResult(
            domain="national_debt",
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            items_processed=len(records),
            items_created=0,
            items_updated=0,
            errors=[f"Write failed: {exc}"],
        )

    finished_at = datetime.now(timezone.utc)
    logger.info(
        f"National debt seeding complete: {created} created, {updated} updated in "
        f"{(finished_at - started_at).total_seconds():.1f}s"
    )

    return DomainRunResult(
        domain="national_debt",
        started_at=started_at,
        finished_at=finished_at,
        items_processed=len(records),
        items_created=created,
        items_updated=updated,
        errors=errors,
    )
