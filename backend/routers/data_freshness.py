"""
Data Freshness Router — reports how recent each data source is.

GET /api/v1/data/freshness

Both ``last_updated`` (when the ETL last successfully ran) AND
``covers_through`` (the most recent *fiscal period / observation year*
present in the data) are derived from the live database. No fiscal-year
string is hardcoded so the endpoint stays truthful as the underlying
tables grow.
"""

import logging
import sys
from datetime import date, datetime, timezone
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

sys.path.insert(0, str(Path(__file__).parent.parent))

try:
    from database import get_db
    from models import (
        Audit,
        BudgetLine,
        DebtTimeline,
        FiscalPeriod,
        GDPData,
        IngestionJob,
        IngestionStatus,
        Loan,
        SourceDocument,
    )

    DATABASE_AVAILABLE = True
except Exception:
    DATABASE_AVAILABLE = False

    def get_db():
        return None


router = APIRouter(prefix="/api/v1/data", tags=["Data Quality"])
logger = logging.getLogger(__name__)


# ── response models ──────────────────────────────────────────────


class SourceFreshness(BaseModel):
    source: str
    label: str
    last_updated: Optional[str] = None
    covers_through: Optional[str] = None
    update_frequency: str
    status: str  # fresh | stale | outdated


class FreshnessResponse(BaseModel):
    sources: List[SourceFreshness]


# ── source config (static metadata — NOT coverage) ──────────────
# `publisher_pattern` is used to match SourceDocument.publisher (ILIKE).
# `domain` determines which data table we query to learn the latest
# period covered. `update_frequency` is purely descriptive.
#
# `covers_through` is intentionally NOT stored here — it is computed
# from the database so the API never lies about recency.

SOURCE_CONFIG = [
    {
        "source": "COB",
        "label": "Controller of Budget",
        "publisher_pattern": "Controller of Budget",
        "domain": "budget",
        "update_frequency": "Quarterly",
    },
    {
        "source": "OAG",
        "label": "Office of the Auditor General",
        "publisher_pattern": "Auditor General",
        "domain": "audit",
        "update_frequency": "Annually",
    },
    {
        "source": "KNBS",
        "label": "Kenya National Bureau of Statistics",
        "publisher_pattern": "KNBS",
        "domain": "economic",
        "update_frequency": "Annually",
    },
    {
        "source": "Treasury",
        "label": "National Treasury",
        "publisher_pattern": "Treasury",
        "domain": "debt",
        "update_frequency": "Quarterly",
    },
    {
        "source": "CBK",
        "label": "Central Bank of Kenya",
        "publisher_pattern": "Central Bank",
        "domain": "debt",
        "update_frequency": "Monthly",
    },
    {
        "source": "CRA",
        "label": "Commission on Revenue Allocation",
        "publisher_pattern": "CRA",
        "domain": "budget",
        "update_frequency": "Annually",
    },
]


def _freshness_status(last_updated: Optional[date]) -> str:
    """fresh = <45 days, stale = 45-180 days, outdated = >180 days."""
    if last_updated is None:
        return "outdated"
    delta = (date.today() - last_updated).days
    if delta < 45:
        return "fresh"
    if delta <= 180:
        return "stale"
    return "outdated"


# ── per-domain coverage lookups ──────────────────────────────────


def _latest_period_label_for_budget(db: Session, publisher_pattern: str) -> Optional[str]:
    """Latest fiscal-period label present in BudgetLine rows whose source
    document was published by the given organisation."""
    return (
        db.query(FiscalPeriod.label)
        .join(BudgetLine, BudgetLine.period_id == FiscalPeriod.id)
        .join(
            SourceDocument,
            BudgetLine.source_document_id == SourceDocument.id,
        )
        .filter(SourceDocument.publisher.ilike(f"%{publisher_pattern}%"))
        .order_by(FiscalPeriod.start_date.desc())
        .limit(1)
        .scalar()
    )


def _latest_period_label_for_audit(db: Session, publisher_pattern: str) -> Optional[str]:
    """Latest fiscal-period label present in Audit rows for a given publisher."""
    return (
        db.query(FiscalPeriod.label)
        .join(Audit, Audit.period_id == FiscalPeriod.id)
        .join(SourceDocument, Audit.source_document_id == SourceDocument.id)
        .filter(SourceDocument.publisher.ilike(f"%{publisher_pattern}%"))
        .order_by(FiscalPeriod.start_date.desc())
        .limit(1)
        .scalar()
    )


def _latest_coverage_for_debt(
    db: Session, publisher_pattern: str
) -> Optional[str]:
    """Latest debt observation — prefer Loan.issue_date for a given publisher,
    fall back to max(DebtTimeline.year) which represents the aggregate
    national debt series."""
    loan_date = (
        db.query(func.max(Loan.issue_date))
        .join(SourceDocument, Loan.source_document_id == SourceDocument.id)
        .filter(SourceDocument.publisher.ilike(f"%{publisher_pattern}%"))
        .scalar()
    )
    if loan_date:
        # Month+year is more truthful than just a year for monthly CBK data
        dt = loan_date if isinstance(loan_date, datetime) else None
        if dt is None and hasattr(loan_date, "year"):
            return f"{loan_date.strftime('%b %Y')}"
        if dt is not None:
            return dt.strftime("%b %Y")

    timeline_year = db.query(func.max(DebtTimeline.year)).scalar()
    if timeline_year:
        return str(timeline_year)
    return None


def _latest_coverage_for_economic(
    db: Session, publisher_pattern: str
) -> Optional[str]:
    """Latest economic observation — max GDPData.year linked to a publisher's
    source documents; fall back to the global max year."""
    year = (
        db.query(func.max(GDPData.year))
        .join(
            SourceDocument,
            GDPData.source_document_id == SourceDocument.id,
        )
        .filter(SourceDocument.publisher.ilike(f"%{publisher_pattern}%"))
        .scalar()
    )
    if year is None:
        year = db.query(func.max(GDPData.year)).scalar()
    return str(year) if year else None


def _covers_through(db: Session, cfg: dict) -> Optional[str]:
    """Dispatch to the right per-domain lookup based on cfg['domain']."""
    domain = cfg["domain"]
    pattern = cfg["publisher_pattern"]
    try:
        if domain == "budget":
            return _latest_period_label_for_budget(db, pattern)
        if domain == "audit":
            return _latest_period_label_for_audit(db, pattern)
        if domain == "debt":
            return _latest_coverage_for_debt(db, pattern)
        if domain == "economic":
            return _latest_coverage_for_economic(db, pattern)
    except Exception as exc:  # pragma: no cover — defensive; never leak DB errors
        logger.warning(
            "covers_through lookup failed for source=%s domain=%s: %s",
            cfg.get("source"),
            domain,
            exc,
        )
    return None


@router.get("/freshness", response_model=FreshnessResponse)
async def get_data_freshness(db: Session = Depends(get_db)):
    """Return freshness information for each data source."""

    results: List[SourceFreshness] = []

    for cfg in SOURCE_CONFIG:
        last_updated_date: Optional[date] = None
        covers_through: Optional[str] = None

        if DATABASE_AVAILABLE and db is not None:
            # Try IngestionJob first (most accurate)
            # Use the IngestionStatus enum values (not plain strings) to match the column type
            job = (
                db.query(func.max(IngestionJob.finished_at))
                .filter(
                    IngestionJob.domain.ilike(f"%{cfg['domain']}%"),
                    IngestionJob.status.in_(
                        [
                            IngestionStatus.COMPLETED,
                            IngestionStatus.COMPLETED_WITH_ERRORS,
                        ]
                    ),
                )
                .scalar()
            )
            if job:
                last_updated_date = job.date() if isinstance(job, datetime) else job

            # Fallback to SourceDocument fetch_date
            if last_updated_date is None:
                doc_date = (
                    db.query(func.max(SourceDocument.fetch_date))
                    .filter(
                        SourceDocument.publisher.ilike(f"%{cfg['publisher_pattern']}%")
                    )
                    .scalar()
                )
                if doc_date:
                    last_updated_date = (
                        doc_date.date() if isinstance(doc_date, datetime) else doc_date
                    )

            # Derived coverage (replaces the old hardcoded SOURCE_CONFIG
            # strings — stays truthful as the DB grows).
            covers_through = _covers_through(db, cfg)

        results.append(
            SourceFreshness(
                source=cfg["source"],
                label=cfg["label"],
                last_updated=(
                    last_updated_date.isoformat() if last_updated_date else None
                ),
                covers_through=covers_through,
                update_frequency=cfg["update_frequency"],
                status=_freshness_status(last_updated_date),
            )
        )

    return FreshnessResponse(sources=results)
