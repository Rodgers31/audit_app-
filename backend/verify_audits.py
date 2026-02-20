"""Quick verification script for audit data."""

import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent))

from database import get_db
from models import Audit
from sqlalchemy import func


def verify_audits():
    """Verify audit data in database."""
    session = next(get_db())

    try:
        # Total count
        total = session.query(Audit).count()
        print(f"✅ Total Audit Records: {total}")

        # Severity distribution
        severity_counts = (
            session.query(Audit.severity, func.count(Audit.id))
            .group_by(Audit.severity)
            .all()
        )
        print("\n📊 Severity Distribution:")
        for severity, count in severity_counts:
            print(f"   {severity.value}: {count} records")

        # Sample records
        sample = session.query(Audit).limit(3).all()
        print("\n📋 Sample Audit Records:")
        for audit in sample:
            print(f"\n   Entity ID: {audit.entity_id}")
            print(f"   Period ID: {audit.period_id}")
            print(f"   Severity: {audit.severity.value}")
            print(f"   Finding: {audit.finding_text[:80]}...")

    finally:
        session.close()


if __name__ == "__main__":
    verify_audits()
