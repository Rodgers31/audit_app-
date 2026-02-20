"""Check the latest seeded budget line."""

import sys
from pathlib import Path

backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from database import SessionLocal
from models import BudgetLine


def check_latest_budget_line():
    """Display the most recently created budget line."""

    session = SessionLocal()
    try:
        # Get the most recent budget line
        latest = (
            session.query(BudgetLine).order_by(BudgetLine.created_at.desc()).first()
        )

        if latest:
            print(f"\n🆕 Latest Budget Line (ID: {latest.id})")
            print(f"   Entity: {latest.entity.canonical_name}")
            print(f"   Period: {latest.period.label}")
            print(f"   Category: {latest.category}")
            print(f"   Subcategory: {latest.subcategory}")
            print(f"   Allocated: {latest.currency} {latest.allocated_amount:,.2f}")
            if latest.actual_spent:
                print(f"   Actual: {latest.currency} {latest.actual_spent:,.2f}")
            print(f"   Source Hash: {latest.source_hash}")
            print(f"   Provenance: {latest.provenance}")
            print(f"   Created: {latest.created_at}")
        else:
            print("\n❌ No budget lines found")

    finally:
        session.close()


if __name__ == "__main__":
    check_latest_budget_line()
