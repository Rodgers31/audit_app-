"""One-shot migration: normalise FiscalPeriod labels and merge duplicates.

Idempotent — safe to run multiple times.

Usage:
    cd backend && python -m scripts.normalize_fiscal_periods          # dry-run
    cd backend && python -m scripts.normalize_fiscal_periods --apply  # commit
"""

from __future__ import annotations

import argparse
import logging
import sys
from collections import defaultdict

from database import SessionLocal
from models import Audit, BudgetLine, Entity, FiscalPeriod

from seeding.utils import normalize_fiscal_label

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


def _backfill_local_revenue(session, *, dry_run: bool) -> int:
    """Add ``local_revenue`` key alongside legacy ``revenue_2024`` in entity meta."""
    updated = 0
    for entity in session.query(Entity).all():
        meta = entity.meta
        if not meta:
            continue
        changed = False
        # Fix per-FY metrics dicts
        all_metrics = meta.get("metrics")
        if isinstance(all_metrics, dict):
            for fy_key, m in all_metrics.items():
                if (
                    isinstance(m, dict)
                    and "revenue_2024" in m
                    and "local_revenue" not in m
                ):
                    m["local_revenue"] = m["revenue_2024"]
                    changed = True
        # Fix financial_metrics
        fm = meta.get("financial_metrics")
        if isinstance(fm, dict) and "revenue_2024" in fm and "local_revenue" not in fm:
            fm["local_revenue"] = fm["revenue_2024"]
            changed = True
        if changed:
            from sqlalchemy.orm.attributes import flag_modified

            entity.meta = meta
            flag_modified(entity, "meta")
            updated += 1
            log.info(
                "  + local_revenue for entity %s (%s)", entity.id, entity.canonical_name
            )
    return updated


def run(*, dry_run: bool = True) -> None:
    session = SessionLocal()
    try:
        all_fps = session.query(FiscalPeriod).all()
        log.info("Found %d FiscalPeriod records", len(all_fps))

        # Build canonical label for every FP
        fp_canonical: dict[int, str] = {}
        for fp in all_fps:
            try:
                fp_canonical[fp.id] = normalize_fiscal_label(fp.label)
            except ValueError:
                log.warning("  SKIP unrecognised label id=%d label=%r", fp.id, fp.label)
                fp_canonical[fp.id] = fp.label

        # ── Phase 1: merge duplicates FIRST (before renaming) ──
        groups: dict[tuple[int, str], list[FiscalPeriod]] = defaultdict(list)
        for fp in all_fps:
            groups[(fp.country_id, fp_canonical[fp.id])].append(fp)

        merge_count = 0
        for (cid, label), fps in groups.items():
            if len(fps) <= 1:
                continue
            # Keep the one whose label is ALREADY canonical (tie-break: most BLs, smallest id)
            fps.sort(
                key=lambda f: (
                    0 if f.label == fp_canonical[f.id] else 1,
                    -session.query(BudgetLine)
                    .filter(BudgetLine.period_id == f.id)
                    .count(),
                    f.id,
                )
            )
            keeper = fps[0]
            dupes = fps[1:]

            for dupe in dupes:
                bl_count = (
                    session.query(BudgetLine)
                    .filter(BudgetLine.period_id == dupe.id)
                    .count()
                )
                audit_count = (
                    session.query(Audit).filter(Audit.period_id == dupe.id).count()
                )
                log.info(
                    "  MERGE  label=%r  dupe id=%d (%d BLs, %d audits) -> keeper id=%d",
                    label,
                    dupe.id,
                    bl_count,
                    audit_count,
                    keeper.id,
                )
                if not dry_run:
                    # Batch-load all BLs for both periods to avoid N+1 queries
                    dupe_bls = (
                        session.query(BudgetLine)
                        .filter(BudgetLine.period_id == dupe.id)
                        .all()
                    )
                    keeper_bls = (
                        session.query(BudgetLine)
                        .filter(BudgetLine.period_id == keeper.id)
                        .all()
                    )
                    keeper_keys = {
                        (b.entity_id, b.category, b.subcategory): b for b in keeper_bls
                    }

                    move_ids = []
                    delete_ids = []
                    for bl in dupe_bls:
                        key = (bl.entity_id, bl.category, bl.subcategory)
                        existing = keeper_keys.get(key)
                        if existing:
                            if (bl.allocated_amount or 0) > (
                                existing.allocated_amount or 0
                            ):
                                existing.allocated_amount = bl.allocated_amount
                                existing.actual_spent = bl.actual_spent
                            delete_ids.append(bl.id)
                        else:
                            move_ids.append(bl.id)

                    if delete_ids:
                        session.query(BudgetLine).filter(
                            BudgetLine.id.in_(delete_ids)
                        ).delete(synchronize_session="fetch")
                    if move_ids:
                        session.query(BudgetLine).filter(
                            BudgetLine.id.in_(move_ids)
                        ).update(
                            {BudgetLine.period_id: keeper.id},
                            synchronize_session="fetch",
                        )
                    # Move Audits
                    session.query(Audit).filter(Audit.period_id == dupe.id).update(
                        {Audit.period_id: keeper.id}
                    )
                    session.delete(dupe)
                    session.flush()
                    log.info(
                        "    Done: moved %d BLs, resolved %d conflicts, moved %d audits",
                        len(move_ids),
                        len(delete_ids),
                        audit_count,
                    )
                merge_count += 1

        # ── Phase 2: rename survivors to canonical form ──
        remaining_fps = (
            session.query(FiscalPeriod).all()
            if not dry_run
            else [
                fp
                for fp in all_fps
                if fp.id
                not in {
                    d.id for grp in groups.values() if len(grp) > 1 for d in grp[1:]
                }
            ]
        )
        label_changes: list[tuple[int, str, str]] = []
        for fp in remaining_fps:
            canonical = fp_canonical[fp.id]
            if canonical != fp.label:
                label_changes.append((fp.id, fp.label, canonical))

        for fp_id, old, new in label_changes:
            log.info("  RENAME  id=%-4d  %r -> %r", fp_id, old, new)
            if not dry_run:
                session.query(FiscalPeriod).filter(FiscalPeriod.id == fp_id).update(
                    {FiscalPeriod.label: new}
                )
        if label_changes and not dry_run:
            session.flush()

        # ── Phase 3: backfill local_revenue in entity meta ──
        rev_count = _backfill_local_revenue(session, dry_run=dry_run)

        if dry_run:
            log.info(
                "DRY RUN complete — %d renames, %d merges, %d revenue backfills. Pass --apply to commit.",
                len(label_changes),
                merge_count,
                rev_count,
            )
            session.rollback()
        else:
            session.commit()
            log.info(
                "COMMITTED — %d renames, %d merges, %d revenue backfills.",
                len(label_changes),
                merge_count,
                rev_count,
            )
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Normalise FiscalPeriod labels")
    parser.add_argument(
        "--apply", action="store_true", help="Apply changes (default: dry-run)"
    )
    args = parser.parse_args()
    run(dry_run=not args.apply)
