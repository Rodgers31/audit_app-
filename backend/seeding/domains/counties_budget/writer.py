"""Persistence logic for county budget records."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, time, timezone
from decimal import Decimal
from typing import Iterable, List, Optional, Tuple

from models import (
    BudgetLine,
    DocumentStatus,
    DocumentType,
    Entity,
    FiscalPeriod,
    SourceDocument,
)
from sqlalchemy import and_, select
from sqlalchemy.orm import Session

from ...config import SeedingSettings
from ...types import DomainRunContext
from ...utils import compute_hash
from .parser import BudgetRecord

logger = logging.getLogger("seeding.counties_budget.writer")


@dataclass
class PersistenceStats:
    processed: int = 0
    created: int = 0
    updated: int = 0
    skipped: int = 0
    errors: List[str] = field(default_factory=list)


def _ensure_source_document(
    session: Session,
    country_id: int,
    settings: SeedingSettings,
    record: BudgetRecord,
) -> SourceDocument:
    """Return the backing SourceDocument, creating or refreshing it as needed."""
    url = record.source_url or settings.budgets_dataset_url
    source = session.execute(
        select(SourceDocument).where(SourceDocument.url == url)
    ).scalar_one_or_none()
    now = datetime.now(timezone.utc)

    if source is None:
        source = SourceDocument(
            country_id=country_id,
            publisher="Controller of Budget",
            title=settings.dataset_title("budgets"),
            url=url,
            file_path=None,
            fetch_date=now,
            doc_type=DocumentType.BUDGET,
            md5=None,
            meta={"dataset_id": record.dataset_id} if record.dataset_id else {},
        )
        session.add(source)
        session.flush()
    else:
        meta = dict(source.meta or {})
        if record.dataset_id and "dataset_id" not in meta:
            meta["dataset_id"] = record.dataset_id
        source.meta = meta

    source.status = DocumentStatus.AVAILABLE
    source.last_seen_at = now
    return source


def _ensure_period(
    session: Session,
    country_id: int,
    record: BudgetRecord,
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


def _resolve_entity(
    session: Session, record: BudgetRecord
) -> Tuple[Optional[Entity], Optional[str]]:
    stmt = select(Entity).where(Entity.slug == record.entity_slug)
    entity = session.execute(stmt).scalar_one_or_none()
    if entity is None:
        message = f"Unknown entity slug '{record.entity_slug}'"
        logger.warning(message, extra={"entity_slug": record.entity_slug})
        return None, message
    return entity, None


def _record_hash(record: BudgetRecord, currency: str) -> str:
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
                str(record.actual_amount) if record.actual_amount is not None else None
            ),
            "currency": currency,
        }
    )


def _apply_line(
    line: BudgetLine,
    record: BudgetRecord,
    currency: str,
    source_document_id: int,
    record_hash: str,
) -> bool:
    updated = False

    for attr, value in (
        ("allocated_amount", record.allocated_amount),
        ("actual_spent", record.actual_amount),
        ("currency", currency),
        ("source_document_id", source_document_id),
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


def persist_budget_records(
    session: Session,
    records: Iterable[BudgetRecord],
    settings: SeedingSettings,
    context: DomainRunContext,
) -> PersistenceStats:
    stats = PersistenceStats()

    for record in records:
        stats.processed += 1

        entity, error = _resolve_entity(session, record)
        if error:
            stats.errors.append(error)
            stats.skipped += 1
            continue
        assert entity is not None

        source = _ensure_source_document(session, entity.country_id, settings, record)
        period = _ensure_period(session, entity.country_id, record)

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
        provenance_entry: dict[str, object] = {}
        if record.dataset_id:
            provenance_entry["dataset_id"] = record.dataset_id
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
                actual_spent=record.actual_amount,
                source_document_id=source.id,
                provenance=[provenance_entry] if provenance_entry else [],
                source_hash=record_hash,
            )
            session.add(line)
            stats.created += 1
        else:
            if _apply_line(existing, record, currency, source.id, record_hash):
                stats.updated += 1

            if provenance_entry:
                provenance = list(existing.provenance or [])
                if provenance_entry not in provenance:
                    provenance.append(provenance_entry)
                    existing.provenance = provenance

    return stats


__all__ = ["PersistenceStats", "persist_budget_records"]
