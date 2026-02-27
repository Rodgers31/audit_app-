"""Shared upsert helper for seeding domain writers.

Provides a single, consistent pattern for check-before-insert with
IntegrityError fallback so that DB-level unique constraints are respected
even if application-level dedup is bypassed (e.g. concurrent runs).

Usage in a domain writer::

    from seeding.upsert import upsert_row

    stats = upsert_row(
        session=db,
        model=Loan,
        natural_key={"entity_id": eid, "lender": lender, "issue_date": dt},
        update_fields={"outstanding": new_val, "principal": new_val},
        create_fields={"currency": "KES", "source_document_id": doc_id},
        logger=log,
    )
    # stats is {"created": 1, "updated": 0, "skipped": 0}
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Type

from models import Base
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

log = logging.getLogger(__name__)


class UpsertStats:
    """Accumulator for created / updated / skipped counts."""

    __slots__ = ("created", "updated", "skipped")

    def __init__(self) -> None:
        self.created = 0
        self.updated = 0
        self.skipped = 0

    def __iadd__(self, other: "UpsertStats") -> "UpsertStats":
        self.created += other.created
        self.updated += other.updated
        self.skipped += other.skipped
        return self

    def as_dict(self) -> Dict[str, int]:
        return {
            "created": self.created,
            "updated": self.updated,
            "skipped": self.skipped,
        }

    def __repr__(self) -> str:
        return f"UpsertStats(created={self.created}, updated={self.updated}, skipped={self.skipped})"


def upsert_row(
    *,
    session: Session,
    model: Type[Base],
    natural_key: Dict[str, Any],
    update_fields: Dict[str, Any],
    create_fields: Optional[Dict[str, Any]] = None,
    logger: Optional[logging.Logger] = None,
) -> UpsertStats:
    """Insert-or-update a single row, keyed on *natural_key* columns.

    1. Query for an existing row matching *natural_key*.
    2. If found — apply *update_fields* only if any column actually changed,
       otherwise mark as skipped.
    3. If not found — INSERT with natural_key + update_fields + create_fields.
    4. On IntegrityError (race condition / constraint violation) — rollback
       the savepoint and retry as an UPDATE.

    Returns an :class:`UpsertStats` with exactly one of the counters set to 1.
    """
    _log = logger or log
    stats = UpsertStats()

    existing = session.query(model).filter_by(**natural_key).first()

    if existing:
        changed = False
        for col, val in update_fields.items():
            if getattr(existing, col, None) != val:
                setattr(existing, col, val)
                changed = True
        if changed:
            stats.updated = 1
            _log.debug(
                "Updated %s %s",
                model.__tablename__,
                natural_key,
            )
        else:
            stats.skipped = 1
        return stats

    # Build a new row
    all_fields = {**natural_key, **update_fields, **(create_fields or {})}
    row = model(**all_fields)

    try:
        session.add(row)
        session.flush()
        stats.created = 1
        _log.debug(
            "Created %s %s",
            model.__tablename__,
            natural_key,
        )
    except IntegrityError:
        # Another process inserted the same row between our SELECT and INSERT.
        # Roll back to the implicit savepoint, then update instead.
        session.rollback()
        existing = session.query(model).filter_by(**natural_key).first()
        if existing:
            for col, val in update_fields.items():
                setattr(existing, col, val)
            session.flush()
            stats.updated = 1
            _log.info(
                "Race-condition upsert for %s %s — fell back to UPDATE",
                model.__tablename__,
                natural_key,
            )
        else:
            # Extremely unlikely: row disappeared between rollback and re-query.
            stats.skipped = 1
            _log.warning(
                "Race-condition upsert for %s %s — row vanished, skipping",
                model.__tablename__,
                natural_key,
            )

    return stats


__all__ = ["upsert_row", "UpsertStats"]
