"""One-time cleanup: remove stale bootstrap category-summary loan rows.

These rows were created by a previous version of bootstrap.py that
seeded aggregated debt summaries (e.g., "Multilateral (World Bank / IMF / AfDB)")
alongside the granular per-lender entries now coming from the seeding pipeline.

The bootstrap code was since updated to stop creating loan records
(see bootstrap.py line ~607-608), but the stale data remained in the DB,
causing the /api/v1/debt/loans total to be approximately double the real figure.

Safe to run multiple times — deletes only rows with provenance source=bootstrap
for the national entity.
"""

import sys

sys.path.insert(0, ".")

from database import SessionLocal
from models import Entity, EntityType, Loan


def cleanup_stale_bootstrap_loans() -> int:
    db = SessionLocal()
    try:
        national = db.query(Entity).filter(Entity.type == EntityType.NATIONAL).first()
        if not national:
            print("No national entity found. Nothing to clean.")
            return 0

        # Find all national loans whose provenance says "source": "bootstrap"
        all_national_loans = db.query(Loan).filter(Loan.entity_id == national.id).all()

        stale_ids = []
        for loan in all_national_loans:
            prov = loan.provenance or []
            for p in prov:
                if isinstance(p, dict) and p.get("source") == "bootstrap":
                    stale_ids.append(loan.id)
                    break

        if not stale_ids:
            print("No stale bootstrap loan rows found. Database is clean.")
            return 0

        print(f"Found {len(stale_ids)} stale bootstrap loan rows to delete:")
        for loan_id in stale_ids:
            loan = db.query(Loan).filter(Loan.id == loan_id).first()
            if loan:
                out = float(loan.outstanding or 0)
                print(
                    f"  id={loan.id:3d} | {loan.lender[:55]:55s} | "
                    f"outstanding={out / 1e9:.1f}B | rate={float(loan.interest_rate or 0):.2f}%"
                )

        # Delete them
        deleted = (
            db.query(Loan)
            .filter(Loan.id.in_(stale_ids))
            .delete(synchronize_session=False)
        )
        db.commit()
        print(f"\nDeleted {deleted} stale bootstrap loan rows.")
        return deleted

    except Exception as exc:
        db.rollback()
        print(f"Error: {exc}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    cleanup_stale_bootstrap_loans()
