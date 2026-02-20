"""Persist normalized population records."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Iterable, List, Optional, Tuple

from models import Entity, PopulationData
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...types import DomainRunContext
from .parser import PopulationRecord

logger = logging.getLogger("seeding.population.writer")


@dataclass
class PersistenceStats:
    processed: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[str] = field(default_factory=list)


def _resolve_entity_id(
    session: Session, record: PopulationRecord
) -> Tuple[Optional[int], Optional[str]]:
    if not record.entity_slug or record.level == "national":
        return None, None

    stmt = select(Entity).where(Entity.slug == record.entity_slug)
    entity = session.execute(stmt).scalar_one_or_none()
    if entity is None:
        logger.warning(
            "Skipping population record with unknown entity",
            extra={"slug": record.entity_slug, "entity_name": record.entity_name},
        )
        return None, f"Unknown entity slug '{record.entity_slug}'"
    return entity.id, None


def _apply_record(model: PopulationData, record: PopulationRecord) -> bool:
    updated = False

    for attr, value in (
        ("total_population", record.total_population),
        ("male_population", record.male_population),
        ("female_population", record.female_population),
        ("meta", {**(model.meta or {}), **(record.meta or {})}),
    ):
        if value is not None and getattr(model, attr) != value:
            setattr(model, attr, value)
            updated = True
    return updated


def persist_population_records(
    session: Session,
    records: Iterable[PopulationRecord],
    context: DomainRunContext,
) -> PersistenceStats:
    stats = PersistenceStats()

    for record in records:
        stats.processed += 1

        entity_id, error = _resolve_entity_id(session, record)
        if error:
            stats.errors.append(error)
        if record.level != "national" and entity_id is None:
            stats.skipped += 1
            continue

        stmt = select(PopulationData).where(
            PopulationData.year == record.year,
            PopulationData.entity_id == entity_id,
        )
        existing = session.execute(stmt).scalar_one_or_none()

        if existing is None:
            model = PopulationData(
                entity_id=entity_id,
                year=record.year,
                total_population=record.total_population,
                male_population=record.male_population,
                female_population=record.female_population,
                meta=record.meta or {},
            )
            session.add(model)
            stats.created += 1
        else:
            if _apply_record(existing, record):
                stats.updated += 1

    return stats


__all__ = ["PersistenceStats", "persist_population_records"]
