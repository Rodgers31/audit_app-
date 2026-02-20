"""Quick script to verify seeded data."""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database import SessionLocal
from models import BudgetLine, FiscalPeriod, IngestionJob, SourceDocument


def verify_seeded_data():
    """Check if data was seeded successfully."""

    session = SessionLocal()
    try:
        # Check ingestion jobs
        jobs = session.query(IngestionJob).all()
        print(f"\n📊 Ingestion Jobs: {len(jobs)}")
        for job in jobs:
            print(f"  - Job #{job.id}: {job.domain} ({job.status.value})")
            print(
                f"    Created: {job.items_created}, Updated: {job.items_updated}, Processed: {job.items_processed}"
            )

        # Check source documents
        docs = session.query(SourceDocument).all()
        print(f"\n📄 Source Documents: {len(docs)}")
        for doc in docs[:5]:  # Show first 5
            print(f"  - {doc.title} ({doc.doc_type.value})")
            print(f"    Status: {doc.status.value}, Last Seen: {doc.last_seen_at}")

        # Check fiscal periods
        periods = session.query(FiscalPeriod).all()
        print(f"\n📅 Fiscal Periods: {len(periods)}")
        for period in periods:
            print(
                f"  - {period.label}: {period.start_date.date()} to {period.end_date.date()}"
            )

        # Check budget lines
        lines = session.query(BudgetLine).all()
        print(f"\n💰 Budget Lines: {len(lines)}")
        for line in lines[:5]:  # Show first 5
            print(
                f"  - {line.entity.canonical_name} / {line.category} / {line.subcategory}"
            )
            print(f"    Allocated: {line.currency} {line.allocated_amount:,.2f}")
            print(
                f"    Actual: {line.currency} {line.actual_spent:,.2f}"
                if line.actual_spent
                else "    Actual: N/A"
            )
            print(
                f"    Hash: {line.source_hash[:16] if line.source_hash else 'N/A'}..."
            )
            if line.provenance:
                print(f"    Provenance: {line.provenance}")

        print(f"\n✅ Verification complete! Found {len(lines)} budget records.")

    finally:
        session.close()


if __name__ == "__main__":
    verify_seeded_data()
