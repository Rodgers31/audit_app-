"""Writer for fiscal summary records to database."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

from models import Country, DocumentType, FiscalSummary, SourceDocument
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from .parser import FiscalSummaryRecord

logger = logging.getLogger("seeding.fiscal_summary.writer")


def _get_or_create_source_document(
    session: Session, metadata: dict[str, Any]
) -> SourceDocument:
    """Get or create source document for fiscal summary data."""
    title = metadata.get(
        "source", "National Treasury BPS & Controller of Budget Reports"
    )

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
        publisher="National Treasury & Controller of Budget",
        title=title,
        url="https://www.treasury.go.ke/budget-policy-statement/",
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


def write_fiscal_summary_records(
    session: Session,
    records: list[FiscalSummaryRecord],
    metadata: dict[str, Any],
) -> tuple[int, int]:
    """Upsert fiscal summary records into the database."""
    created = 0
    updated = 0

    source_doc = _get_or_create_source_document(session, metadata)

    for record in records:
        existing = (
            session.query(FiscalSummary)
            .filter(FiscalSummary.fiscal_year == record.fiscal_year)
            .first()
        )

        fields = {
            "appropriated_budget": record.appropriated_budget,
            "total_revenue": record.total_revenue,
            "tax_revenue": record.tax_revenue,
            "non_tax_revenue": record.non_tax_revenue,
            "total_borrowing": record.total_borrowing,
            "borrowing_pct_of_budget": record.borrowing_pct_of_budget,
            "debt_service_cost": record.debt_service_cost,
            "debt_service_per_shilling": record.debt_service_per_shilling,
            "debt_ceiling": record.debt_ceiling,
            "actual_debt": record.actual_debt,
            "debt_ceiling_usage_pct": record.debt_ceiling_usage_pct,
            "development_spending": record.development_spending,
            "recurrent_spending": record.recurrent_spending,
            "county_allocation": record.county_allocation,
        }

        if existing:
            for key, val in fields.items():
                setattr(existing, key, val)
            existing.source_document_id = source_doc.id
            existing.updated_at = datetime.now(timezone.utc)
            updated += 1
        else:
            row = FiscalSummary(
                fiscal_year=record.fiscal_year,
                source_document_id=source_doc.id,
                **fields,
            )
            session.add(row)
            created += 1

    session.flush()
    logger.info(f"Fiscal summary: {created} created, {updated} updated")
    return created, updated
