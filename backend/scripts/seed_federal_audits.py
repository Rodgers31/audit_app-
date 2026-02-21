"""One-time script to seed federal audit data into the database."""

import sys

sys.path.insert(0, ".")

from bootstrap import _seed_federal_audits
from database import SessionLocal
from models import Country, Entity, EntityType, FiscalPeriod
from sqlalchemy import text

session = SessionLocal()

try:
    country = session.query(Country).filter(Country.iso_code == "KEN").first()
    if not country:
        print("ERROR: Kenya country record not found!")
        sys.exit(1)

    period = (
        session.query(FiscalPeriod)
        .filter(FiscalPeriod.country_id == country.id)
        .first()
    )
    if not period:
        print("ERROR: No fiscal period found!")
        sys.exit(1)

    print(f"Country: {country.name} (id={country.id})")
    print(f"Fiscal period: {period.label} (id={period.id})")

    # Check existing ministry entities
    ministries = (
        session.query(Entity)
        .filter(
            Entity.country_id == country.id,
            Entity.type == EntityType.MINISTRY,
        )
        .all()
    )
    print(f"Ministry entities: {len(ministries)}")

    national = (
        session.query(Entity)
        .filter(
            Entity.country_id == country.id,
            Entity.type == EntityType.NATIONAL,
        )
        .first()
    )
    print(f"National entity: {national.canonical_name if national else 'NONE'}")

    # Seed federal audits
    _seed_federal_audits(session, country=country, period=period)
    session.commit()

    # Verify
    count = session.execute(
        text(
            "SELECT COUNT(*) FROM audits a JOIN entities e ON a.entity_id = e.id "
            "WHERE e.type IN ('MINISTRY', 'NATIONAL')"
        )
    ).scalar()
    print(f"\nFederal audit records in DB: {count}")

    # Show breakdown
    rows = session.execute(
        text(
            "SELECT e.type, COUNT(a.id) FROM audits a "
            "JOIN entities e ON a.entity_id = e.id "
            "GROUP BY e.type ORDER BY e.type"
        )
    ).fetchall()
    for r in rows:
        print(f"  {r[0]}: {r[1]} audits")

    print("\nDone!")

except Exception as e:
    session.rollback()
    print(f"ERROR: {e}")
    raise
finally:
    session.close()
