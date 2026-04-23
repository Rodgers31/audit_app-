"""Upsert IMF WEO observations into ``imf_weo_observations``.

Idempotent on ``(country_code, indicator, year, vintage)``. Re-running
the seeder within the same vintage window is a no-op; a new vintage
inserts a fresh set of rows without touching the old ones (that's the
point — we keep full revision history).
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

# Absolute import — sibling domains (audits, counties_budget, etc.) all
# import models this way because the seeder runs with `backend/` on
# PYTHONPATH. The nested relative path `....models` that I originally
# used errors out in the CI test collector: "ImportError: attempted
# relative import beyond top-level package".
from models import ImfWeoObservation
from ...types import DomainRunContext

logger = logging.getLogger("seeding.imf_weo.writer")


@dataclass
class WriteStats:
    processed: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[str] = field(default_factory=list)


def persist_imf_weo(
    session: Session,
    records: List[Dict[str, Any]],
    context: DomainRunContext,
) -> WriteStats:
    """Bulk upsert with on-conflict-do-nothing.

    The unique constraint on (country, indicator, year, vintage) means
    re-runs within the same vintage are no-ops. Skipped counts reflect
    rows that already existed.
    """
    stats = WriteStats()
    stats.processed = len(records)

    if not records:
        return stats

    if context.dry_run:
        stats.skipped = len(records)
        logger.info("[dry-run] would upsert %d IMF WEO rows", len(records))
        return stats

    try:
        stmt = (
            insert(ImfWeoObservation)
            .values(records)
            .on_conflict_do_nothing(
                index_elements=[
                    "country_code",
                    "indicator",
                    "year",
                    "vintage",
                ]
            )
        )
        result = session.execute(stmt)
        session.commit()
        # `rowcount` returns inserts; anything not inserted was a conflict.
        inserted = result.rowcount or 0
        stats.created = inserted
        stats.skipped = len(records) - inserted
    except Exception as exc:  # pragma: no cover
        session.rollback()
        logger.exception("Failed to persist IMF WEO rows")
        stats.errors.append(str(exc))

    return stats


__all__ = ["persist_imf_weo", "WriteStats"]
