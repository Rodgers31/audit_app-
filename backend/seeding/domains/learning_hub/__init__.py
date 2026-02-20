"""Learning hub seeding domain."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ...config import SeedingSettings
from ...http_client import create_http_client
from ...registries import register_domain
from ...types import DomainRunContext, DomainRunResult
from . import fetcher, parser, writer

logger = logging.getLogger("seeding.learning_hub")


@register_domain("learning_hub")
def run(
    session: Session, settings: SeedingSettings, context: DomainRunContext
) -> DomainRunResult:
    """
    Execute learning hub seeding domain.

    Fetches educational questions and populates the quick_questions table.

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
            payload = fetcher.fetch_questions_payload(client, settings)
        except Exception as exc:
            logger.exception(
                "Failed to fetch questions payload", extra={"error": str(exc)}
            )
            return DomainRunResult(
                domain="learning_hub",
                started_at=started_at,
                finished_at=datetime.now(timezone.utc),
                items_processed=0,
                items_created=0,
                items_updated=0,
                errors=[f"Fetch failed: {exc}"],
            )

    try:
        records = parser.parse_questions_payload(payload)
    except Exception as exc:
        logger.exception("Failed to parse questions payload", extra={"error": str(exc)})
        return DomainRunResult(
            domain="learning_hub",
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            items_processed=0,
            items_created=0,
            items_updated=0,
            errors=[f"Parse failed: {exc}"],
        )

    try:
        created, updated = writer.write_questions(
            session,
            records,
            dataset_id="learning-hub",
            job_id=context.job_id,
        )
    except Exception as exc:
        logger.exception("Failed to write questions", extra={"error": str(exc)})
        return DomainRunResult(
            domain="learning_hub",
            started_at=started_at,
            finished_at=datetime.now(timezone.utc),
            items_processed=len(records),
            items_created=0,
            items_updated=0,
            errors=[f"Write failed: {exc}"],
        )

    finished_at = datetime.now(timezone.utc)
    logger.info(
        f"Learning hub seeding complete: {created} created, {updated} updated in "
        f"{(finished_at - started_at).total_seconds():.1f}s"
    )

    return DomainRunResult(
        domain="learning_hub",
        started_at=started_at,
        finished_at=finished_at,
        items_processed=len(records),
        items_created=created,
        items_updated=updated,
        errors=errors,
    )
