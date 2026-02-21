"""Writer for debt timeline records to database."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from models import Country, DebtTimeline, DocumentType, SourceDocument
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from .parser import DebtTimelineRecord

logger = logging.getLogger("seeding.debt_timeline.writer")


def _get_or_create_source_document(
    session: Session, metadata: dict[str, Any]
) -> SourceDocument:
    """Get or create source document for debt timeline data."""
    title = metadata.get("source", "CBK Annual Reports & National Treasury BPS")

    doc = (
        session.query(SourceDocument)
        .filter(
            SourceDocument.title == title,
            SourceDocument.doc_type == DocumentType.REPORT,
        )
        .first()
    )
    if doc:
        return doc

    kenya = session.query(Country).filter(Country.iso_code == "KEN").first()
    if not kenya:
        raise ValueError("Kenya country not found. Run bootstrap_data.py first.")

    doc = SourceDocument(
        country_id=kenya.id,
        publisher="Central Bank of Kenya / National Treasury",
        title=title,
        url="https://www.centralbank.go.ke/statistics/government-finance-statistics/",
        fetch_date=datetime.now(timezone.utc),
        doc_type=DocumentType.REPORT,
        meta={
            "notes": metadata.get("notes", ""),
            "units": metadata.get("units", "billions_kes"),
        },
    )
    session.add(doc)
    session.flush()
    return doc


def write_debt_timeline_records(
    session: Session,
    records: list[DebtTimelineRecord],
    metadata: dict[str, Any],
) -> tuple[int, int]:
    """Upsert debt timeline records into the database."""
    created = 0
    updated = 0

    source_doc = _get_or_create_source_document(session, metadata)

    for record in records:
        existing = (
            session.query(DebtTimeline).filter(DebtTimeline.year == record.year).first()
        )

        if existing:
            existing.external = record.external
            existing.domestic = record.domestic
            existing.total = record.total
            existing.gdp = record.gdp
            existing.gdp_ratio = record.gdp_ratio
            existing.source_document_id = source_doc.id
            existing.updated_at = datetime.now(timezone.utc)
            updated += 1
        else:
            row = DebtTimeline(
                year=record.year,
                external=record.external,
                domestic=record.domestic,
                total=record.total,
                gdp=record.gdp,
                gdp_ratio=record.gdp_ratio,
                source_document_id=source_doc.id,
            )
            session.add(row)
            created += 1

    session.flush()
    logger.info(f"Debt timeline: {created} created, {updated} updated")
    return created, updated
