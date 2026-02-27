"""Verify all real data in database."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from database import get_db
from models import Audit, BudgetLine, EconomicIndicator, Entity, Loan, PopulationData
from sqlalchemy import func


def verify_data():
    session = next(get_db())

    print("=" * 60)
    print("DATABASE VERIFICATION - REAL DATA STATUS")
    print("=" * 60)

    # Check entities (counties)
    entities = session.query(Entity).count()
    print(f"\nEntities (Counties): {entities}")

    # Check population
    pop = session.query(PopulationData).count()
    print(f"Population Records: {pop}")

    # Check economic indicators
    econ = session.query(EconomicIndicator).count()
    print(f"Economic Indicators: {econ}")

    # Check county budgets (BudgetLine)
    budgets = session.query(BudgetLine).count()
    print(f"Budget Line Records: {budgets}")

    # Check audits
    audits = session.query(Audit).count()
    print(f"Audit Records: {audits}")

    # Check loans (national debt)
    try:
        loans = session.query(Loan).count()
        print(f"Loan Records: {loans}")
    except Exception as e:
        print(f"Loans: Error - {e}")
        loans = 0

    print("\n" + "=" * 60)
    total = pop + econ + budgets + audits + loans
    print(f"TOTAL DATA RECORDS: {total}")
    print("=" * 60)

    # Sample data verification
    print("\nSAMPLE DATA VERIFICATION:")

    # Sample population
    sample_pop = session.query(PopulationData).first()
    if sample_pop:
        entity = session.query(Entity).filter(Entity.id == sample_pop.entity_id).first()
        print(
            f"\n  Population Sample: {entity.name if entity else 'Unknown'} = {sample_pop.total_population:,}"
        )

    # Sample budget
    sample_budget = session.query(BudgetLine).first()
    if sample_budget:
        entity = (
            session.query(Entity).filter(Entity.id == sample_budget.entity_id).first()
        )
        print(
            f"  Budget Sample: {entity.name if entity else 'Unknown'} - {sample_budget.category} = {sample_budget.allocated_amount:,.2f}"
        )

    # Sample audit
    sample_audit = session.query(Audit).first()
    if sample_audit:
        entity = (
            session.query(Entity).filter(Entity.id == sample_audit.entity_id).first()
        )
        print(
            f"  Audit Sample: {entity.name if entity else 'Unknown'} - {sample_audit.severity.value}"
        )

    session.close()

    return {
        "entities": entities,
        "population": pop,
        "economic_indicators": econ,
        "budgets": budgets,
        "audits": audits,
        "debt": loans,
        "total": total,
    }


if __name__ == "__main__":
    verify_data()
