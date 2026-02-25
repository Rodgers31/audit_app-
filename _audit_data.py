"""One-off script to audit existing county data in the database."""

import json
import sys

sys.path.insert(0, "backend")

from database import SessionLocal
from models import Audit, BudgetLine, Entity, EntityType, Loan, PopulationData

s = SessionLocal()

print("=== RECORD COUNTS ===")
print("Counties:", s.query(Entity).filter(Entity.type == EntityType.COUNTY).count())
print("BudgetLines:", s.query(BudgetLine).count())
print("Audits:", s.query(Audit).count())
print("Loans:", s.query(Loan).count())
print("Population:", s.query(PopulationData).count())

sample = s.query(Entity).filter(Entity.type == EntityType.COUNTY).first()
if sample:
    meta = sample.meta or {}
    print("\n=== SAMPLE:", sample.canonical_name, "(slug=" + sample.slug + ") ===")
    print("Meta keys:", list(meta.keys()))
    fm = meta.get("financial_metrics", {})
    print("Financial metrics:", json.dumps(fm, default=str))
    ep = meta.get("economic_profile", {})
    print("Economic profile:", json.dumps(ep, default=str))
    aus = meta.get("audit_summary", {})
    print("Audit summary:", json.dumps(aus, default=str))
    mfc = meta.get("missing_funds_cases", [])
    print("Missing funds cases:", len(mfc))
    if mfc:
        print("  Sample:", json.dumps(mfc[0], default=str)[:300])

    bl = s.query(BudgetLine).filter(BudgetLine.entity_id == sample.id).count()
    au = s.query(Audit).filter(Audit.entity_id == sample.id).count()
    lo = s.query(Loan).filter(Loan.entity_id == sample.id).count()
    po = s.query(PopulationData).filter(PopulationData.entity_id == sample.id).count()
    print("\nRelated: BL=%d AU=%d LO=%d PO=%d" % (bl, au, lo, po))

    for b in (
        s.query(BudgetLine).filter(BudgetLine.entity_id == sample.id).limit(3).all()
    ):
        print(
            "  BL: cat=%s alloc=%s spent=%s committed=%s"
            % (b.category, b.allocated_amount, b.actual_spent, b.committed_amount)
        )

    for a in s.query(Audit).filter(Audit.entity_id == sample.id).limit(2).all():
        print("  AU: sev=%s text=%s" % (a.severity, a.finding_text[:100]))
        print("      prov=%s" % json.dumps(a.provenance, default=str)[:250])

    for l in s.query(Loan).filter(Loan.entity_id == sample.id).limit(2).all():
        print(
            "  LO: lender=%s cat=%s princ=%s outstand=%s"
            % (l.lender, l.debt_category, l.principal, l.outstanding)
        )

    mk = meta.get("metrics", {})
    for key in list(mk.keys())[:1]:
        print("\nMetrics[%s]:" % key, json.dumps(mk[key], default=str)[:500])

# Check a second county with lots of audits
print("\n=== COUNTY AUDIT COUNTS ===")
from sqlalchemy import func

top = (
    s.query(Entity.canonical_name, func.count(Audit.id).label("cnt"))
    .join(Audit, Audit.entity_id == Entity.id)
    .group_by(Entity.canonical_name)
    .order_by(func.count(Audit.id).desc())
    .limit(5)
    .all()
)
for name, cnt in top:
    print("  %s: %d audits" % (name, cnt))

s.close()

s.close()
