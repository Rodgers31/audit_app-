"""Deep duplicate audit across all database tables.

Checks every table for:
  1. Exact row duplicates (same natural-key columns).
  2. Near-duplicates (e.g. same entity+year for single-value tables).
  3. Row counts and unique-constraint coverage.

Run:  cd backend && ../venv/bin/python3 scripts/deep_duplicate_audit.py
"""

import json
import sys
from collections import defaultdict

sys.path.insert(0, ".")

from database import SessionLocal, engine
from sqlalchemy import inspect, text

db = SessionLocal()
insp = inspect(engine)

print("=" * 80)
print("DEEP DUPLICATE AUDIT — ALL TABLES")
print("=" * 80)

# ── 1. Schema overview ─────────────────────────────────────────────
tables = sorted(insp.get_table_names())
print(f"\nTotal tables: {len(tables)}\n")

total_issues = 0

for tname in tables:
    cols = [c["name"] for c in insp.get_columns(tname)]
    uniqs = insp.get_unique_constraints(tname)
    indexes = [
        (i["name"], i["unique"], i["column_names"])
        for i in insp.get_indexes(tname)
        if i["unique"]
    ]

    row_count = db.execute(text(f'SELECT COUNT(*) FROM "{tname}"')).scalar()

    # Skip empty tables
    if row_count == 0:
        continue

    print(f"┌─ TABLE: {tname} ({row_count} rows)")
    if uniqs:
        for u in uniqs:
            print(f"│  UNIQUE constraint: {u['name']} on {u['column_names']}")
    if indexes:
        for name, _, cols_list in indexes:
            print(f"│  UNIQUE index: {name} on {cols_list}")
    if not uniqs and not indexes:
        print(f"│  ⚠  NO unique constraints (besides PK)")

    # ── 2. Check for exact full-row duplicates (excluding id, created_at, updated_at) ──
    skip_cols = {"id", "created_at", "updated_at", "provenance"}
    natural_cols = [c for c in cols if c not in skip_cols]

    if natural_cols:
        cols_str = ", ".join(f'"{c}"' for c in natural_cols)
        dup_query = f"""
            SELECT {cols_str}, COUNT(*) AS cnt
            FROM "{tname}"
            GROUP BY {cols_str}
            HAVING COUNT(*) > 1
            ORDER BY cnt DESC
            LIMIT 10
        """
        try:
            dups = db.execute(text(dup_query)).fetchall()
            if dups:
                total_issues += len(dups)
                print(f"│  🔴 EXACT DUPLICATES: {len(dups)} groups")
                for row in dups[:5]:
                    # row is a Row object; last column is cnt
                    cnt = row[-1]
                    vals = dict(zip(natural_cols, row[:-1]))
                    # Truncate long values for display
                    display = {
                        k: (str(v)[:60] + "…" if len(str(v)) > 60 else v)
                        for k, v in vals.items()
                        if v is not None
                    }
                    print(f"│     {cnt}x → {display}")
            else:
                print(f"│  ✅ No exact full-row duplicates")
        except Exception as e:
            print(f"│  ⚠  Could not check exact dups: {e}")

    print("│")

    # ── 3. Table-specific natural-key duplicate checks ──
    # Define expected natural keys per table
    NATURAL_KEYS = {
        "countries": [["iso_code"]],
        "entities": [["canonical_name", "type"]],
        "fiscal_periods": [["country_id", "label"]],
        "source_documents": [["title", "publisher"]],
        "budget_lines": [
            ["entity_id", "fiscal_period_id", "programme", "economic_item"]
        ],
        "loans": [["entity_id", "lender", "issue_date"]],
        "audits": [["entity_id", "fiscal_period_id"]],
        "population_data": [["entity_id", "year"]],
        "gdp_data": [["entity_id", "year"]],
        "economic_indicators": [["entity_id", "year", "indicator_name"]],
        "debt_timeline": [["year"]],
        "governors": [["entity_id"]],  # one active governor per county
    }

    if tname in NATURAL_KEYS:
        for key_cols in NATURAL_KEYS[tname]:
            if all(c in cols for c in key_cols):
                key_str = ", ".join(f'"{c}"' for c in key_cols)
                nk_query = f"""
                    SELECT {key_str}, COUNT(*) AS cnt
                    FROM "{tname}"
                    GROUP BY {key_str}
                    HAVING COUNT(*) > 1
                    ORDER BY cnt DESC
                    LIMIT 10
                """
                try:
                    nk_dups = db.execute(text(nk_query)).fetchall()
                    if nk_dups:
                        total_issues += len(nk_dups)
                        print(
                            f"│  🔴 NATURAL-KEY DUPS on ({', '.join(key_cols)}): {len(nk_dups)} groups"
                        )
                        for row in nk_dups[:5]:
                            cnt = row[-1]
                            vals = dict(zip(key_cols, row[:-1]))
                            print(f"│     {cnt}x → {vals}")
                    else:
                        print(f"│  ✅ No natural-key dups on ({', '.join(key_cols)})")
                except Exception as e:
                    print(f"│  ⚠  Could not check natural-key dups: {e}")

    print(f"└{'─' * 60}\n")

# ── 4. Summary ──────────────────────────────────────────────────────
print("=" * 80)
if total_issues == 0:
    print("✅ ALL CLEAN — no duplicate groups found in any table.")
else:
    print(f"🔴 FOUND {total_issues} duplicate group(s) across all tables.")
print("=" * 80)

db.close()
