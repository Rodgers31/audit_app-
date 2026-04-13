"""
One-time backfill script to re-resolve entity names/types on existing
parliament_source_documents rows using the patched EntityResolver.

This script:
  - Reads all existing parliament records joined with their source_document title
  - Re-runs EntityResolver.resolve() on each title
  - Compares old vs new entity_name, entity_type, and confidence
  - In dry-run mode (default): reports what would change
  - In commit mode (--commit): applies the updates

Idempotent: running it twice produces identical results because
the resolver is deterministic.

Usage:
    # Dry run — preview changes
    python -m etl.parliament_backfill

    # Commit changes
    python -m etl.parliament_backfill --commit

    # Verbose dry run
    python -m etl.parliament_backfill -v
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone

# Allow running as `python -m etl.parliament_backfill` from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

try:
    from .entity_resolver import EntityResolver
except ImportError:
    from entity_resolver import EntityResolver

from database import SessionLocal
from sqlalchemy import text

logger = logging.getLogger(__name__)


def run_backfill(commit: bool = False, verbose: bool = False):
    """Re-resolve entity fields for all parliament_source_documents."""
    session = SessionLocal()
    resolver = EntityResolver()

    # Fetch all parliament records with their source document title
    rows = session.execute(
        text(
            """
        SELECT p.id,
               p.metadata,
               p.confidence_score,
               sd.title
        FROM parliament_source_documents p
        JOIN source_documents sd ON sd.id = p.source_document_id
        ORDER BY p.id
    """
        )
    ).fetchall()

    total = len(rows)
    changed = 0
    unchanged = 0
    errors = 0

    # Track change categories
    categories = {
        "entity_name_changed": 0,
        "entity_type_changed": 0,
        "confidence_changed": 0,
        "bare_ministry_fixed": 0,
        "trailing_punct_fixed": 0,
        "school_reclassified": 0,
        "generic_name_fixed": 0,
        "leaked_prefix_fixed": 0,
        "unknown_resolved": 0,
    }

    changes = []

    for row in rows:
        pid = row[0]
        meta = (
            row[1] if isinstance(row[1], dict) else json.loads(row[1]) if row[1] else {}
        )
        old_conf = float(row[2]) if row[2] is not None else 0.0
        title = row[3] or ""

        old_name = meta.get("entity_name", "")
        old_type = meta.get("entity_type", "")

        try:
            resolved = resolver.resolve(title)
        except Exception as e:
            logger.error(f"Error resolving id={pid}: {e}")
            errors += 1
            continue

        new_name = resolved.entity_name
        new_type = resolved.entity_type
        # Use the resolver confidence for the entity portion, keep combined
        # confidence as average of old classifier conf and new resolver conf
        # Since we don't have the original classifier confidence stored separately,
        # we use the new resolver confidence directly
        new_conf = resolved.confidence

        # Determine if anything changed
        name_changed = new_name != old_name
        type_changed = new_type != old_type
        conf_changed = abs(new_conf - old_conf) > 0.01

        if not (name_changed or type_changed):
            unchanged += 1
            continue

        changed += 1

        # Categorize the change
        if name_changed:
            categories["entity_name_changed"] += 1
        if type_changed:
            categories["entity_type_changed"] += 1
        if conf_changed:
            categories["confidence_changed"] += 1

        # Specific fix categories
        if (
            old_type == "ministry"
            and not old_name.startswith(("Ministry", "State Department"))
            and new_name.startswith(("Ministry", "State Department"))
        ):
            categories["bare_ministry_fixed"] += 1
        if old_name.rstrip() != old_name.rstrip(
            ".,;: "
        ) and new_name == new_name.rstrip(".,;: "):
            categories["trailing_punct_fixed"] += 1
        if old_type == "state_corporation" and new_type == "educational_institution":
            categories["school_reclassified"] += 1
        if (
            old_name.lower().strip() in EntityResolver._GENERIC_KEYWORDS
            and new_name.lower().strip() not in EntityResolver._GENERIC_KEYWORDS
        ):
            categories["generic_name_fixed"] += 1
        if old_name.startswith("Report of") and not new_name.startswith("Report of"):
            categories["leaked_prefix_fixed"] += 1
        if old_type == "unknown" and new_type != "unknown":
            categories["unknown_resolved"] += 1

        change_record = {
            "id": pid,
            "title": title[:100],
            "old_name": old_name,
            "new_name": new_name,
            "old_type": old_type,
            "new_type": new_type,
            "old_conf": old_conf,
            "new_conf": new_conf,
        }
        changes.append(change_record)

        if verbose:
            print(f"  [{pid}] name: '{old_name}' → '{new_name}'")
            print(
                f"         type: {old_type} → {new_type}  conf: {old_conf:.2f} → {new_conf:.2f}"
            )

        if commit:
            # Update the metadata JSONB and confidence_score
            new_meta = dict(meta)
            new_meta["entity_name"] = new_name
            new_meta["entity_type"] = new_type
            # Preserve backfill provenance
            new_meta["_backfill"] = {
                "previous_entity_name": old_name,
                "previous_entity_type": old_type,
                "previous_confidence": old_conf,
                "backfill_timestamp": datetime.now(timezone.utc).isoformat(),
            }
            if resolved.fiscal_years and not meta.get("fiscal_years"):
                new_meta["fiscal_years"] = resolved.fiscal_years

            session.execute(
                text(
                    """
                    UPDATE parliament_source_documents
                    SET metadata = :meta,
                        confidence_score = :conf,
                        updated_at = NOW()
                    WHERE id = :pid
                """
                ),
                {
                    "meta": json.dumps(new_meta),
                    "conf": new_conf,
                    "pid": pid,
                },
            )

    if commit:
        session.commit()
        print(f"\n✓ Committed {changed} updates.")
    else:
        print(f"\n[DRY RUN] Would update {changed} records. Use --commit to apply.")

    # Summary
    print(f"\n=== BACKFILL SUMMARY ===")
    print(f"  Total records:     {total}")
    print(f"  Changed:           {changed} ({100*changed/total:.1f}%)")
    print(f"  Unchanged:         {unchanged}")
    print(f"  Errors:            {errors}")
    print(f"\n=== CHANGE CATEGORIES ===")
    for cat, count in sorted(categories.items(), key=lambda x: -x[1]):
        if count > 0:
            print(f"  {cat}: {count}")

    # Type distribution after backfill (preview)
    if not commit:
        type_dist = {}
        # Simulate the post-backfill distribution
        all_types = session.execute(
            text(
                """
            SELECT metadata->>'entity_type' as etype, COUNT(*) as cnt
            FROM parliament_source_documents
            GROUP BY metadata->>'entity_type'
            ORDER BY cnt DESC
        """
            )
        ).fetchall()
        current = {r[0]: r[1] for r in all_types}

        # Apply changes
        projected = dict(current)
        for c in changes:
            projected[c["old_type"]] = projected.get(c["old_type"], 0) - 1
            projected[c["new_type"]] = projected.get(c["new_type"], 0) + 1
        # Clean up zeros
        projected = {k: v for k, v in projected.items() if v > 0}

        print(f"\n=== PROJECTED TYPE DISTRIBUTION (after backfill) ===")
        print(f"  {'Type':<25} {'Current':>8} {'After':>8} {'Delta':>8}")
        all_keys = sorted(set(list(current.keys()) + list(projected.keys())))
        for k in all_keys:
            cur = current.get(k, 0)
            proj = projected.get(k, 0)
            delta = proj - cur
            d = f"+{delta}" if delta > 0 else str(delta)
            print(f"  {k:<25} {cur:>8} {proj:>8} {d:>8}")

    session.close()
    return changed, errors


def main():
    parser = argparse.ArgumentParser(
        description="Backfill entity resolution for existing Parliament records",
    )
    parser.add_argument(
        "--commit", action="store_true", help="Apply changes (default: dry run)"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Show each change")
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    run_backfill(commit=args.commit, verbose=args.verbose)


if __name__ == "__main__":
    main()
