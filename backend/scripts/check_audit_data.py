"""Quick script to check audit data in the database."""

from database import SessionLocal
from sqlalchemy import text

session = SessionLocal()

# Count audits
count = session.execute(text("SELECT COUNT(*) FROM audits")).scalar()
print(f"Total audits in DB: {count}")

# Sample records
rows = session.execute(
    text(
        """
  SELECT a.id, e.canonical_name, a.severity, LEFT(a.finding_text, 80) as finding
  FROM audits a
  JOIN entities e ON a.entity_id = e.id
  ORDER BY a.id
  LIMIT 8
"""
    )
).fetchall()
for r in rows:
    print(f"  [{r[0]}] {r[1]} | {r[2]} | {r[3]}")

# Count by severity
sev = session.execute(
    text(
        """
  SELECT severity, COUNT(*) as cnt FROM audits GROUP BY severity ORDER BY severity
"""
    )
).fetchall()
print(f"By severity: {dict(sev)}")

# Count distinct counties
counties = session.execute(
    text(
        """
  SELECT COUNT(DISTINCT e.canonical_name)
  FROM audits a JOIN entities e ON a.entity_id = e.id
"""
    )
).scalar()
print(f"Counties with audits: {counties}")

# Source documents
docs = session.execute(
    text(
        """
  SELECT sd.id, sd.title, sd.document_type, sd.publisher
  FROM source_documents sd
  WHERE sd.document_type = 'audit'
  LIMIT 5
"""
    )
).fetchall()
print(f"Audit source docs: {len(docs)}")
for d in docs:
    print(f"  [{d[0]}] {d[1]} | {d[2]} | {d[3]}")

# Sample provenance
prov = session.execute(
    text(
        """
  SELECT a.id, a.provenance
  FROM audits a
  LIMIT 3
"""
    )
).fetchall()
print("Sample provenance:")
for p in prov:
    print(f"  [{p[0]}] {p[1]}")

session.close()
