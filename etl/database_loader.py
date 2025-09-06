"""
Database loader for normalized financial data
Handles inserting processed data into PostgreSQL with proper relationships
"""

import asyncio
import logging
import os
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker

# Add backend to path to import models
sys.path.append(os.path.join(os.path.dirname(os.path.dirname(__file__)), "backend"))

try:
    from database import get_db
    from models import (
        Audit,
        Base,
        BudgetLine,
        Country,
        Entity,
        Extraction,
        FiscalPeriod,
        Loan,
        SourceDocument,
    )
except ImportError as e:
    logging.warning(f"Could not import backend models: {e}")

    # Mock models for testing
    class Country:
        pass

    class Entity:
        pass

    class FiscalPeriod:
        pass

    class SourceDocument:
        pass

    class BudgetLine:
        pass

    class Loan:
        pass

    class Audit:
        pass

    class Extraction:
        pass


logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class DatabaseLoader:
    """
    Loads normalized financial data into PostgreSQL database
    """

    def __init__(self, database_url: Optional[str] = None):
        self.database_url = database_url or os.getenv(
            "DATABASE_URL", "postgresql://postgres:password@localhost:5432/audit_app"
        )

        try:
            self.engine = create_engine(self.database_url)
            self.SessionLocal = sessionmaker(
                autocommit=False, autoflush=False, bind=self.engine
            )
        except Exception as e:
            logger.error(f"Could not connect to database: {e}")
            self.engine = None
            self.SessionLocal = None

    def get_db_session(self):
        """Get database session"""
        if not self.SessionLocal:
            raise RuntimeError("Database not connected")
        return self.SessionLocal()

    async def ensure_country_exists(self, country_code: str = "KEN") -> int:
        """Ensure Kenya country record exists, return country_id"""
        if not self.engine:
            return 1  # Mock return for testing

        with self.get_db_session() as db:
            country = db.query(Country).filter(Country.iso_code == country_code).first()

            if not country:
                country = Country(
                    iso_code=country_code,
                    name="Kenya",
                    currency="KES",
                    timezone="Africa/Nairobi",
                    default_locale="en_KE",
                    metadata={"fiscal_year_start": "07-01"},
                )
                db.add(country)
                db.commit()
                db.refresh(country)
                logger.info(f"Created country record for {country_code}")

            return country.id

    async def ensure_entity_exists(
        self, entity_data: Dict[str, Any], country_id: int
    ) -> int:
        """Ensure entity record exists, return entity_id"""
        if not self.engine:
            return 1  # Mock return for testing

        with self.get_db_session() as db:
            canonical_name = entity_data["canonical_name"]

            # Try to find existing entity
            entity = (
                db.query(Entity)
                .filter(
                    Entity.canonical_name == canonical_name,
                    Entity.country_id == country_id,
                )
                .first()
            )

            if not entity:
                # Create slug from canonical name
                slug = canonical_name.lower().replace(" ", "-").replace("&", "and")
                slug = "".join(c for c in slug if c.isalnum() or c in "-")

                entity = Entity(
                    country_id=country_id,
                    type=entity_data["type"],
                    canonical_name=canonical_name,
                    slug=slug,
                    alt_names=[entity_data.get("raw_name", "")],
                    metadata={
                        "confidence": entity_data.get("confidence", 0.0),
                        "category": entity_data.get("category", "unknown"),
                    },
                )
                db.add(entity)
                db.commit()
                db.refresh(entity)
                logger.info(f"Created entity: {canonical_name}")

            return entity.id

    async def ensure_fiscal_period_exists(
        self, period_data: Dict[str, Any], country_id: int
    ) -> int:
        """Ensure fiscal period record exists, return period_id"""
        if not self.engine:
            return 1  # Mock return for testing

        with self.get_db_session() as db:
            label = period_data["label"]

            # Try to find existing period
            period = (
                db.query(FiscalPeriod)
                .filter(
                    FiscalPeriod.label == label, FiscalPeriod.country_id == country_id
                )
                .first()
            )

            if not period:
                period = FiscalPeriod(
                    country_id=country_id,
                    label=label,
                    start_date=period_data["start_date"],
                    end_date=period_data["end_date"],
                )
                db.add(period)
                db.commit()
                db.refresh(period)
                logger.info(f"Created fiscal period: {label}")

            return period.id

    async def load_document(
        self, document_record: Dict[str, Any], normalized_data: List[Dict[str, Any]]
    ) -> int:
        """Load document and associated normalized data"""
        if not self.engine:
            logger.info(f"Mock loading document: {document_record['title']}")
            return 1

        with self.get_db_session() as db:
            try:
                # Create source document record
                source_doc = SourceDocument(
                    country_id=document_record["country_id"],
                    publisher=document_record["publisher"],
                    title=document_record["title"],
                    url=document_record["url"],
                    file_path=document_record["file_path"],
                    fetch_date=document_record["fetch_date"],
                    md5=document_record["md5"],
                    doc_type=document_record["doc_type"],
                    metadata=document_record["metadata"],
                )
                db.add(source_doc)
                db.commit()
                db.refresh(source_doc)

                logger.info(f"Created document record: {source_doc.id}")

                # Load normalized data items
                await self._load_normalized_items(db, normalized_data, source_doc.id)

                return source_doc.id

            except Exception as e:
                db.rollback()
                logger.error(f"Error loading document: {e}")
                raise

    async def _load_normalized_items(
        self, db, normalized_data: List[Dict[str, Any]], source_doc_id: int
    ):
        """Load individual normalized budget line items"""
        country_id = await self.ensure_country_exists()

        for item in normalized_data:
            try:
                # Route by item kind; default to budget line
                kind = item.get("_kind", "budget_line")
                if kind == "audit_finding":
                    await self._load_audit_finding_item(
                        db, item, source_doc_id, country_id
                    )
                else:
                    await self._load_budget_line_item(
                        db, item, source_doc_id, country_id
                    )
            except Exception as e:
                logger.error(f"Error loading item {item}: {e}")
                continue

    async def _load_budget_line_item(
        self, db, item: Dict[str, Any], source_doc_id: int, country_id: int
    ):
        """Load a single budget line item"""

        # Ensure entity exists
        if "entity" not in item:
            logger.warning("No entity data in item, skipping")
            return

        entity_id = await self.ensure_entity_exists(item["entity"], country_id)

        # Ensure fiscal period exists (use default if not specified)
        period_id = 1  # Default period
        if "fiscal_period" in item:
            period_id = await self.ensure_fiscal_period_exists(
                item["fiscal_period"], country_id
            )

        # Create budget line
        budget_line = BudgetLine(
            entity_id=entity_id,
            period_id=period_id,
            category=item.get("category", "Unknown"),
            subcategory=item.get("subcategory"),
            allocated_amount=item.get("allocated_amount", {}).get("base_amount"),
            actual_spent=item.get("actual_amount", {}).get("base_amount"),
            committed_amount=item.get("committed_amount", {}).get("base_amount"),
            currency="KES",  # Default to KES for Kenya
            source_document_id=source_doc_id,
            page_ref=str(item.get("source_table", {}).get("page", 1)),
            notes=f"Extracted from table {item.get('source_table', {}).get('table_index', 0)}",
            provenance=[
                {
                    "source_document_id": source_doc_id,
                    "page": item.get("source_table", {}).get("page", 1),
                    "table_index": item.get("source_table", {}).get("table_index", 0),
                    "row_index": item.get("source_table", {}).get("row_index", 0),
                    "confidence": item.get("extraction_metadata", {}).get(
                        "confidence", 0.0
                    ),
                    "extraction_date": item.get("extraction_metadata", {}).get(
                        "extraction_date"
                    ),
                }
            ],
        )

        db.add(budget_line)
        db.commit()
        logger.debug(f"Created budget line for entity {entity_id}")

    async def _load_audit_finding_item(
        self, db, item: Dict[str, Any], source_doc_id: int, country_id: int
    ):
        """Load a single audit finding into the audits table."""

        # Ensure entity exists (fallback to Unknown if missing)
        entity_info = item.get("entity") or {
            "canonical_name": "Unknown Entity",
            "type": "agency",
            "confidence": 0.0,
        }
        entity_id = await self.ensure_entity_exists(entity_info, country_id)

        # Ensure fiscal period exists if provided
        period_id = 1
        if item.get("fiscal_period"):
            period_id = await self.ensure_fiscal_period_exists(
                item["fiscal_period"], country_id
            )

        # Map severity string to enum name expected by SQLAlchemy Enum
        severity_str = (item.get("severity") or "info").upper()
        if severity_str not in {"INFO", "WARNING", "CRITICAL"}:
            severity_str = "INFO"

        # Build provenance record
        provenance = item.get("provenance") or {}
        prov = [
            {
                "source_document_id": source_doc_id,
                **provenance,
            }
        ]

        # Create audit row
        audit = Audit(
            entity_id=entity_id,
            period_id=period_id,
            finding_text=item.get("finding_text", ""),
            severity=severity_str.lower(),  # SQLAlchemy Enum will coerce
            recommended_action=item.get("recommended_action"),
            source_document_id=source_doc_id,
            provenance=prov,
        )

        db.add(audit)
        db.commit()
        logger.debug(f"Created audit finding for entity {entity_id}")

    async def load_audit_findings_document(
        self,
        document_record: Dict[str, Any],
        audit_findings: List[Dict[str, Any]],
    ) -> int:
        """Persist an audit document with parsed findings."""
        # Tag items as audit kind for router
        normalized = [{"_kind": "audit_finding", **f} for f in audit_findings]
        return await self.load_document(document_record, normalized)

    async def load_sample_kenya_data(self):
        """Load sample Kenya data for MVP testing"""
        logger.info("Loading sample Kenya data...")

        country_id = await self.ensure_country_exists("KEN")

        # Sample entities
        sample_entities = [
            {
                "canonical_name": "Ministry of Health",
                "type": "ministry",
                "confidence": 1.0,
            },
            {
                "canonical_name": "Ministry of Education",
                "type": "ministry",
                "confidence": 1.0,
            },
            {"canonical_name": "Nairobi County", "type": "county", "confidence": 1.0},
            {"canonical_name": "Mombasa County", "type": "county", "confidence": 1.0},
        ]

        for entity_data in sample_entities:
            await self.ensure_entity_exists(entity_data, country_id)

        # Sample fiscal period
        sample_period = {
            "label": "FY2024/25",
            "start_date": datetime(2024, 7, 1).date(),
            "end_date": datetime(2025, 6, 30).date(),
        }
        period_id = await self.ensure_fiscal_period_exists(sample_period, country_id)

        logger.info(
            f"Sample data loaded for country_id={country_id}, period_id={period_id}"
        )

    async def get_data_summary(self) -> Dict[str, Any]:
        """Get summary of loaded data"""
        if not self.engine:
            return {"status": "Database not connected"}

        with self.get_db_session() as db:
            try:
                summary = {}

                # Count records
                summary["countries"] = db.query(Country).count()
                summary["entities"] = db.query(Entity).count()
                summary["fiscal_periods"] = db.query(FiscalPeriod).count()
                summary["source_documents"] = db.query(SourceDocument).count()
                summary["budget_lines"] = db.query(BudgetLine).count()

                # Get latest document
                latest_doc = (
                    db.query(SourceDocument)
                    .order_by(SourceDocument.fetch_date.desc())
                    .first()
                )
                if latest_doc:
                    summary["latest_document"] = {
                        "title": latest_doc.title,
                        "publisher": latest_doc.publisher,
                        "fetch_date": latest_doc.fetch_date.isoformat(),
                    }

                return summary

            except Exception as e:
                logger.error(f"Error getting data summary: {e}")
                return {"error": str(e)}


if __name__ == "__main__":
    # Test the database loader
    async def test_loader():
        loader = DatabaseLoader()

        # Load sample data
        await loader.load_sample_kenya_data()

        # Get summary
        summary = await loader.get_data_summary()
        print("Data Summary:")
        for key, value in summary.items():
            print(f"  {key}: {value}")

    asyncio.run(test_loader())
