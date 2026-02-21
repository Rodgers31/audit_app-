"""Check entity type breakdown for audits."""

import sys

sys.path.insert(0, ".")
from database import SessionLocal
from sqlalchemy import text

s = SessionLocal()

# Entity type breakdown
print("=== ENTITY TYPES ===")
rows = s.execute(text("SELECT type, COUNT(*) FROM entities GROUP BY type")).fetchall()
for r in rows:
    print(f"  {r[0]}: {r[1]}")

# Which entity types have audits?
print("\n=== AUDITS BY ENTITY TYPE ===")
rows = s.execute(
    text(
        "SELECT e.type, COUNT(a.id) FROM audits a "
        "JOIN entities e ON a.entity_id = e.id "
        "GROUP BY e.type"
    )
).fetchall()
for r in rows:
    print(f"  {r[0]}: {r[1]}")

# List all ministries
print("\n=== ALL MINISTRY ENTITIES ===")
rows = s.execute(
    text("SELECT id, canonical_name FROM entities WHERE type='MINISTRY' ORDER BY id")
).fetchall()
for r in rows:
    print(f"  [{r[0]}] {r[1]}")

# Any audits for ministries?
print("\n=== MINISTRY AUDITS ===")
rows = s.execute(
    text(
        "SELECT a.id, e.canonical_name, a.severity, LEFT(a.finding_text, 100) "
        "FROM audits a JOIN entities e ON a.entity_id = e.id "
        "WHERE e.type = 'MINISTRY' LIMIT 20"
    )
).fetchall()
if rows:
    for r in rows:
        print(f"  [{r[0]}] {r[1]} [{r[2]}] {r[3]}")
else:
    print("  (NO ministry/federal audits in the DB)")

# List county entities with audits
print("\n=== COUNTY ENTITIES WITH AUDITS (sample) ===")
rows = s.execute(
    text(
        "SELECT e.id, e.canonical_name, COUNT(a.id) "
        "FROM entities e JOIN audits a ON a.entity_id = e.id "
        "WHERE e.type = 'COUNTY' GROUP BY e.id, e.canonical_name "
        "ORDER BY COUNT(a.id) DESC LIMIT 10"
    )
).fetchall()
for r in rows:
    print(f"  [{r[0]}] {r[1]}: {r[2]} audits")

s.close()
