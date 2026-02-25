"""Persist national budget execution records to BudgetLine."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, time, timezone
from decimal import Decimal
from typing import Iterable, Optional, Tuple

from models import (
    BudgetLine,
    DocumentStatus,
    DocumentType,
    Entity,
    EntityType,
    FiscalPeriod,
    SourceDocument,
)
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ...config import SeedingSettings
from ...types import DomainRunContext
from ...utils import compute_hash
from .parser import NationalBudgetRecord

logger = logging.getLogger("seeding.national_budget.writer")


@dataclass
class PersistenceStats:
    processed: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: list[str] = field(default_factory=list)


def _ensure_entity(
    session: Session, record: NationalBudgetRecord
) -> Tuple[Optional[Entity], Optional[str]]:
    """Find or create the national-government entity."""
    stmt = select(Entity).where(Entity.slug == record.entity_slug)
    entity = session.execute(stmt).scalar_one_or_none()
    if entity is None:
        # Try to create it — national-government may not exist yet
        from models import Country

        country = session.execute(
            select(Country).order_by(Country.id.asc())
        ).scalar_one_or_none()
        if country is None:
            msg = "No country found in database — run population seeder first"
            logger.error(msg)
            return None, msg

        entity = Entity(
            canonical_name=record.entity_name,
            slug=record.entity_slug,
            type=EntityType.NATIONAL,
            country_id=country.id,
        )
        session.add(entity)
        session.flush()
        logger.info(
            "Created entity '%s' (slug=%s)", record.entity_name, record.entity_slug
        )
    return entity, None


def _ensure_source_document(
    session: Session,
    country_id: int,
    settings: SeedingSettings,
    record: NationalBudgetRecord,
) -> SourceDocument:
    url = record.source_url or settings.national_budget_execution_dataset_url
    source = session.execute(
        select(SourceDocument).where(SourceDocument.url == url)
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if source is None:
        source = SourceDocument(
            country_id=country_id,
            publisher="Controller of Budget",
            title=f"CoB Annual NG-BIRR {record.period_label}",
            url=url,
            file_path=None,
            fetch_date=now,
            doc_type=DocumentType.BUDGET,
            md5=None,
            meta={"data_quality": record.data_quality or "official"},
        )
        session.add(source)
        session.flush()
    else:
        source.status = DocumentStatus.AVAILABLE
        source.last_seen_at = now
    return source


def _ensure_period(
    session: Session,
    country_id: int,
    record: NationalBudgetRecord,
) -> FiscalPeriod:
    stmt = select(FiscalPeriod).where(
        and_(
            FiscalPeriod.country_id == country_id,
            FiscalPeriod.label == record.period_label,
        )
    )
    period = session.execute(stmt).scalar_one_or_none()
    if period is None:
        period = FiscalPeriod(
            country_id=country_id,
            label=record.period_label,
            start_date=datetime.combine(
                record.start_date, time.min, tzinfo=timezone.utc
            ),
            end_date=datetime.combine(record.end_date, time.max, tzinfo=timezone.utc),
        )
        session.add(period)
        session.flush()
    return period


def _record_hash(record: NationalBudgetRecord, currency: str) -> str:
    return compute_hash(
        {
            "entity_slug": record.entity_slug,
            "period_label": record.period_label,
            "category": record.category,
            "subcategory": record.subcategory,
            "allocated": (
                str(record.allocated_amount)
                if record.allocated_amount is not None
                else None
            ),
            "actual": (
                str(record.actual_spent) if record.actual_spent is not None else None
            ),
            "committed": (
                str(record.committed_amount)
                if record.committed_amount is not None
                else None
            ),
            "currency": currency,
        }
    )


def _apply_line(
    line: BudgetLine,
    record: NationalBudgetRecord,
    currency: str,
    source_document_id: int,
    record_hash: str,
) -> bool:
    updated = False

    for attr, value in (
        ("allocated_amount", record.allocated_amount),
        ("actual_spent", record.actual_spent),
        ("committed_amount", record.committed_amount),
        ("currency", currency),
        ("source_document_id", source_document_id),
        ("notes", record.notes),
    ):
        if value is None:
            continue
        if isinstance(value, Decimal):
            current = getattr(line, attr)
            if current is None or current != value:
                setattr(line, attr, value)
                updated = True
        elif getattr(line, attr) != value:
            setattr(line, attr, value)
            updated = True

    if line.source_hash != record_hash:
        line.source_hash = record_hash
        updated = True

    return updated


def persist_national_budget_records(
    session: Session,
    records: Iterable[NationalBudgetRecord],
    settings: SeedingSettings,
    context: DomainRunContext,
) -> PersistenceStats:
    stats = PersistenceStats()

    for record in records:
        stats.processed += 1

        entity, error = _ensure_entity(session, record)
        if error:
            stats.errors.append(error)
            stats.skipped += 1
            continue
        assert entity is not None

        source = _ensure_source_document(session, entity.country_id, settings, record)
        period = _ensure_period(session, entity.country_id, record)

        # Match on entity + period + category + subcategory (natural key)
        stmt = select(BudgetLine).where(
            and_(
                BudgetLine.entity_id == entity.id,
                BudgetLine.period_id == period.id,
                BudgetLine.category == record.category,
                BudgetLine.subcategory == record.subcategory,
            )
        )
        existing = session.execute(stmt).scalar_one_or_none()

        currency = record.currency or settings.budget_default_currency
        provenance_entry: dict[str, object] = {
            "source": record.source or "CoB NG-BIRR",
            "data_quality": record.data_quality or "official",
        }
        if context.job_id is not None:
            provenance_entry["ingestion_job_id"] = context.job_id

        record_hash = _record_hash(record, currency)

        if existing is None:
            line = BudgetLine(
                entity_id=entity.id,
                period_id=period.id,
                category=record.category,
                subcategory=record.subcategory,
                currency=currency,
                allocated_amount=record.allocated_amount,
                actual_spent=record.actual_spent,
                committed_amount=record.committed_amount,
                source_document_id=source.id,
                notes=record.notes,
                provenance=[provenance_entry] if provenance_entry else [],
                source_hash=record_hash,
            )
            session.add(line)
            stats.created += 1
            logger.debug(
                "Created BudgetLine: %s / %s / %s",
                record.entity_slug,
                record.period_label,
                record.category,
            )
        else:
            if _apply_line(existing, record, currency, source.id, record_hash):
                stats.updated += 1
                logger.debug(
                    "Updated BudgetLine: %s / %s / %s",
                    record.entity_slug,
                    record.period_label,
                    record.category,
                )

            if provenance_entry:
                provenance = list(existing.provenance or [])
                if provenance_entry not in provenance:
                    provenance.append(provenance_entry)
                    existing.provenance = provenance

    return stats


__all__ = ["PersistenceStats", "persist_national_budget_records"]
