"""Check actual DB schema and what data exists."""

import sys

sys.path.insert(0, ".")
from database import SessionLocal
from sqlalchemy import text

s = SessionLocal()

# First: discover all tables
print("=== ALL TABLES ===")
rows = s.execute(
    text(
        "SELECT table_name FROM information_schema.tables "
        "WHERE table_schema='public' ORDER BY table_name"
    )
).fetchall()
for r in rows:
    print(f"  {r[0]}")

# Check entities columns
print("\n=== ENTITIES TABLE COLUMNS ===")
rows = s.execute(
    text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='entities' ORDER BY ordinal_position"
    )
).fetchall()
for r in rows:
    print(f"  {r[0]} ({r[1]})")

# Check audits columns
print("\n=== AUDITS TABLE COLUMNS ===")
rows = s.execute(
    text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='audits' ORDER BY ordinal_position"
    )
).fetchall()
for r in rows:
    print(f"  {r[0]} ({r[1]})")

# Sample entities
print("\n=== SAMPLE ENTITIES (first 10) ===")
rows = s.execute(text("SELECT * FROM entities LIMIT 10")).fetchall()
for r in rows:
    print(f"  {r}")

# Sample audits
print("\n=== SAMPLE AUDITS (first 5) ===")
rows = s.execute(text("SELECT * FROM audits LIMIT 5")).fetchall()
for r in rows:
    print(f"  {r}")

# Check source_documents columns
print("\n=== SOURCE_DOCUMENTS COLUMNS ===")
rows = s.execute(
    text(
        "SELECT column_name, data_type FROM information_schema.columns "
        "WHERE table_name='source_documents' ORDER BY ordinal_position"
    )
).fetchall()
for r in rows:
    print(f"  {r[0]} ({r[1]})")

# Sample source_documents
print("\n=== SAMPLE SOURCE_DOCUMENTS ===")
rows = s.execute(text("SELECT * FROM source_documents LIMIT 5")).fetchall()
for r in rows:
    print(f"  {r}")

# Count all audits
print("\n=== AUDIT COUNTS ===")
total = s.execute(text("SELECT COUNT(*) FROM audits")).scalar()
print(f"  Total audits: {total}")

# Severity breakdown
rows = s.execute(
    text("SELECT severity, COUNT(*) FROM audits GROUP BY severity")
).fetchall()
for r in rows:
    print(f"  {r[0]}: {r[1]}")

s.close()
