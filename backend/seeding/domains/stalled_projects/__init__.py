"""Stalled projects seeder domain.

Seeds stalled/delayed county development projects identified in
Office of the Auditor General (OAG) audit reports into Entity.meta.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ...config import SeedingSettings
from ...registries import register_domain
from ...types import DomainRunContext, DomainRunResult
from . import fetcher, parser, writer

logger = logging.getLogger("seeding.stalled_projects")


@register_domain("stalled_projects")
def run(
    session: Session, settings: SeedingSettings, context: DomainRunContext
) -> DomainRunResult:
    started_at = datetime.now(timezone.utc)
    errors: list[str] = []

    try:
        raw = fetcher.fetch(settings)
    except Exception as exc:
        logger.exception("Failed to fetch stalled_projects data")
        return (
            DomainRunResult.empty(
                domain="stalled_projects",
                dry_run=context.dry_run,
                started_at=started_at,
            )
            .with_error(str(exc))
            .mark_finished()
        )

    records = parser.parse(raw, settings)
    stats = writer.write(records, session, dry_run=context.dry_run)

    return DomainRunResult(
        domain="stalled_projects",
        started_at=started_at,
        finished_at=datetime.now(timezone.utc),
        items_processed=len(records),
        items_created=stats.get("updated", 0),
        items_updated=0,
        dry_run=context.dry_run,
        errors=errors,
        metadata={"skipped": stats.get("skipped", 0)},
    )
