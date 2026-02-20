"""Test updated API endpoints with seeded data."""

import asyncio

# Get database URL from environment
import os
import sys

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))

from dotenv import load_dotenv
from models import Audit, BudgetLine, Entity, EntityType, PopulationData
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

# Load environment variables from backend/.env
backend_env_path = os.path.join(os.path.dirname(__file__), "backend", ".env")
load_dotenv(backend_env_path)

# Build DATABASE_URL from discrete vars
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_HOST = os.getenv("DB_HOST")
DB_PORT = os.getenv("DB_PORT", "5432")
DB_NAME = os.getenv("DB_NAME")
DB_SSLMODE = os.getenv("DB_SSLMODE", "require")

DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}?sslmode={DB_SSLMODE}"


def test_counties_data():
    """Test that county data is available in database."""
    print("\n=== Testing Counties Data ===\n")

    engine = create_engine(DATABASE_URL)

    with Session(engine) as session:
        # Check counties
        stmt = (
            select(Entity)
            .where(Entity.type == EntityType.COUNTY)
            .order_by(Entity.canonical_name)
        )
        counties = session.scalars(stmt).all()

        print(f"✓ Found {len(counties)} counties in database")

        if counties:
            # Show first 3 counties with their data
            for county in counties[:3]:
                print(f"\n  County: {county.canonical_name}")
                print(f"    ID: {county.id}")
                print(f"    Slug: {county.slug}")

                # Check population data
                pop_stmt = (
                    select(PopulationData)
                    .where(PopulationData.entity_id == county.id)
                    .order_by(PopulationData.year.desc())
                )
                pop_data = session.scalars(pop_stmt).first()

                if pop_data:
                    print(
                        f"    Population ({pop_data.year}): {pop_data.total_population:,}"
                    )
                else:
                    print(f"    Population: No data")

                # Check budget data
                budget_stmt = (
                    select(BudgetLine)
                    .where(BudgetLine.entity_id == county.id)
                    .order_by(BudgetLine.fiscal_year.desc())
                )
                budget_data = session.scalars(budget_stmt).first()

                if budget_data:
                    print(
                        f"    Budget ({budget_data.fiscal_year}): {budget_data.amount:,.2f}"
                    )
                else:
                    print(f"    Budget: No data")

                # Check audit data
                audit_stmt = (
                    select(Audit)
                    .where(Audit.entity_id == county.id)
                    .order_by(Audit.fiscal_year.desc())
                )
                audit_data = session.scalars(audit_stmt).first()

                if audit_data:
                    print(f"    Audit ({audit_data.fiscal_year}): {audit_data.opinion}")
                else:
                    print(f"    Audit: No data")

        # Summary
        print(f"\n=== Summary ===")
        print(f"Counties: {len(counties)}")

        pop_count = session.query(PopulationData).count()
        print(f"Population records: {pop_count}")

        budget_count = session.query(BudgetLine).count()
        print(f"Budget records: {budget_count}")

        audit_count = session.query(Audit).count()
        print(f"Audit records: {audit_count}")

        if len(counties) == 0:
            print("\n⚠ No counties found! Run: python -m backend.bootstrap_data")
            return False

        return True


if __name__ == "__main__":
    try:
        success = test_counties_data()
        sys.exit(0 if success else 1)
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)
