"""Audit findings seeding domain."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from ...config import SeedingSettings
from ...http_client import create_http_client
from ...registries import register_domain
from ...types import DomainRunContext, DomainRunResult
from . import fetcher, parser, writer

logger = logging.getLogger("seeding.audits")


@register_domain("audits")
def run(
    session: Session, settings: SeedingSettings, context: DomainRunContext
) -> DomainRunResult:
    started_at = datetime.now(timezone.utc)
    errors: list[str] = []

    with create_http_client(settings) as client:
        try:
            payload = fetcher.fetch_audit_payload(client, settings)
        except Exception as exc:  # pragma: no cover - network failure path
            logger.exception("Failed to fetch audit payload", extra={"error": str(exc)})
            return (
                DomainRunResult.empty(
                    domain="audits",
                    dry_run=context.dry_run,
                    started_at=started_at,
                )
                .with_error(str(exc))
                .model_copy(update={"finished_at": datetime.now(timezone.utc)})
            )

    records = parser.parse_audit_payload(payload)
    stats = writer.persist_audit_records(session, records, settings, context)
    errors.extend(stats.errors)

    finished_at = datetime.now(timezone.utc)

    return DomainRunResult(
        domain="audits",
        started_at=started_at,
        finished_at=finished_at,
        items_processed=stats.processed,
        items_created=stats.created,
        items_updated=stats.updated,
        dry_run=context.dry_run,
        errors=errors,
        metadata={
            "skipped": stats.skipped,
            "source_url": settings.audits_dataset_url,
        },
    )


__all__ = ["run"]
