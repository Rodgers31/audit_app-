"""Writer for National Treasury debt data to database."""

from __future__ import annotations

import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING

from models import DocumentType, Entity, EntityType, Loan, SourceDocument
from sqlalchemy.orm import Session

if TYPE_CHECKING:
    from .parser import DebtRecord

logger = logging.getLogger("seeding.national_debt.writer")


def _get_or_create_entity(
    session: Session, name: str, entity_type: str
) -> Entity | None:
    """Get or create entity by name and type."""
    # Map entity_type string to enum
    type_mapping = {
        "national": EntityType.NATIONAL,
        "county": EntityType.COUNTY,
        "ministry": EntityType.MINISTRY,
        "agency": EntityType.AGENCY,
    }

    entity_type_enum = type_mapping.get(entity_type.lower())
    if not entity_type_enum:
        logger.warning(f"Unknown entity type: {entity_type}")
        return None

    # Try to find existing entity
    entity = (
        session.query(Entity)
        .filter(Entity.canonical_name == name, Entity.type == entity_type_enum)
        .first()
    )

    if entity:
        return entity

    # For National Government, this should already exist from bootstrap
    logger.warning(
        f"Entity not found: {name} ({entity_type}). "
        f"Run bootstrap_data.py to create reference entities."
    )
    return None


def _get_or_create_source_document(
    session: Session, record: DebtRecord
) -> SourceDocument:
    """Get or create source document for the debt bulletin."""
    # Use source URL or title as unique identifier
    source_identifier = record.source_url or record.source_title or "Unknown Source"

    doc = (
        session.query(SourceDocument)
        .filter(
            SourceDocument.title == record.source_title,
            SourceDocument.doc_type == DocumentType.LOAN,
        )
        .first()
    )

    if doc:
        return doc

    # Get Kenya country ID (should exist from bootstrap)
    from models import Country

    kenya = session.query(Country).filter(Country.iso_code == "KEN").first()
    if not kenya:
        raise ValueError("Kenya country not found. Run bootstrap_data.py first.")

    # Create new source document
    logger.info(f"Creating source document: {record.source_title}")
    doc = SourceDocument(
        country_id=kenya.id,
        publisher="National Treasury of Kenya",
        title=record.source_title or "National Treasury Debt Bulletin",
        doc_type=DocumentType.LOAN,
        url=record.source_url,
        fetch_date=datetime.now(timezone.utc),
    )
    session.add(doc)
    session.flush()
    return doc


def compute_loan_hash(record: DebtRecord, entity_id: int) -> str:
    """Compute deterministic hash for a loan record."""
    data = (
        f"{entity_id}:{record.lender}:{record.principal}:"
        f"{record.outstanding}:{record.issue_date.isoformat()}:"
        f"{record.maturity_date.isoformat() if record.maturity_date else 'None'}:"
        f"{record.currency}"
    )
    return hashlib.sha256(data.encode()).hexdigest()


def write_debt_records(
    session: Session, records: list[DebtRecord], dataset_id: str, job_id: int | None
) -> tuple[int, int]:
    """
    Persist debt records to database.

    Args:
        session: Database session
        records: Parsed debt records
        dataset_id: Dataset identifier for provenance
        job_id: Ingestion job ID for tracking

    Returns:
        Tuple of (created_count, updated_count)
    """
    created = 0
    updated = 0

    for record in records:
        # Get or create entity
        entity = _get_or_create_entity(session, record.entity_name, record.entity_type)
        if not entity:
            logger.warning(
                f"Skipping loan: could not resolve entity {record.entity_name}"
            )
            continue

        # Get or create source document
        source_doc = _get_or_create_source_document(session, record)

        # Check if loan already exists using hash
        loan_hash = compute_loan_hash(record, entity.id)

        existing_loan = (
            session.query(Loan)
            .filter(
                Loan.entity_id == entity.id,
                Loan.lender == record.lender,
                Loan.issue_date == record.issue_date,
            )
            .first()
        )

        provenance_entry = {
            "dataset_id": dataset_id,
            "ingestion_job_id": job_id,
            "ingested_at": datetime.now(timezone.utc).isoformat(),
        }

        if existing_loan:
            # Update if outstanding amount changed
            if existing_loan.outstanding != record.outstanding:
                logger.info(
                    f"Updating loan: {record.lender} for {record.entity_name} "
                    f"(outstanding: {existing_loan.outstanding} → {record.outstanding})"
                )
                existing_loan.outstanding = record.outstanding
                existing_loan.maturity_date = record.maturity_date

                # Append to provenance
                provenance = existing_loan.provenance or []
                provenance.append(provenance_entry)
                existing_loan.provenance = provenance

                updated += 1
        else:
            # Create new loan
            logger.info(
                f"Creating loan: {record.lender} for {record.entity_name} "
                f"(principal: {record.principal}, outstanding: {record.outstanding})"
            )

            loan = Loan(
                entity_id=entity.id,
                lender=record.lender,
                principal=record.principal,
                outstanding=record.outstanding,
                issue_date=record.issue_date,
                maturity_date=record.maturity_date,
                currency=record.currency,
                source_document_id=source_doc.id,
                provenance=[provenance_entry],
            )
            session.add(loan)
            created += 1

    logger.info(f"Debt write complete: {created} created, {updated} updated")
    return created, updated
