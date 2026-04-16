"""
Parliament ETL orchestrator — automatic ingest, reconciliation, and validation.

This module is the **single operational entry point** for all scheduled
Parliament ETL work.  It coordinates three phases:

  1. **Ingest** — discover new items from DSpace and insert them
  2. **Reconcile** — re-resolve entity metadata on existing records
  3. **Validate** — run quality checks and log a concise summary

Each phase is idempotent and safe to re-run:

  * Ingest deduplicates on ``dspace_uuid`` (hard skip).
  * Reconcile uses a deterministic resolver; running twice → same result.
    Provenance (previous values + timestamp) is stored in JSONB metadata.
  * Validate is read-only.

Feature flags (environment variables):
  PARLIAMENT_PIPELINE_ENABLED  — master switch; "1" enables all phases
  PARLIAMENT_RECONCILE_ENABLED — "0" disables scheduled reconciliation
                                  (default "1" when pipeline is enabled)
  PARLIAMENT_MAX_INGEST_ITEMS  — cap per ingest run (default 500)
  PARLIAMENT_MIN_CONFIDENCE    — skip items below this (default 0.30)

CLI usage:
    # Full cycle (dry-run)
    python -m etl.parliament_orchestrator

    # Full cycle (commit)
    python -m etl.parliament_orchestrator --commit

    # Ingest only
    python -m etl.parliament_orchestrator --commit --ingest-only

    # Reconcile only
    python -m etl.parliament_orchestrator --commit --reconcile-only

    # Validate only (always read-only)
    python -m etl.parliament_orchestrator --validate-only
"""

import argparse
import json
import logging
import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import psycopg2

logger = logging.getLogger(__name__)

# Dedicated advisory lock key for Parliament ETL.
# Distinct from ETL worker lock (874321).  Prevents concurrent
# ingest/reconcile across multiple backend replicas or processes.
PARLIAMENT_LOCK_KEY = 874322

# Ensure backend/ is importable — but append (not insert) so the top-level
# etl/ package is found first and not shadowed by backend/etl/.
_backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
if os.path.isdir(_backend_dir) and _backend_dir not in sys.path:
    sys.path.append(os.path.abspath(_backend_dir))


def is_enabled() -> bool:
    """Master switch for Parliament automation."""
    return os.getenv("PARLIAMENT_PIPELINE_ENABLED", "0") == "1"


def reconcile_enabled() -> bool:
    """Whether scheduled reconciliation is enabled (default: yes, if pipeline enabled)."""
    return os.getenv("PARLIAMENT_RECONCILE_ENABLED", "1") == "1"


def _try_advisory_lock():
    """Acquire a PG session-level advisory lock for Parliament ETL.

    Returns ``(connection, acquired)``.  If *acquired* is ``False`` another
    process already holds the lock and the caller should skip this run.
    If the database is unreachable the caller receives ``(None, False)``.
    """
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        # No database configured — dry-run / metadata-only mode.
        # Allow the run; it won't write anything anyway.
        return None, True

    try:
        conn = psycopg2.connect(db_url)
        conn.autocommit = True
        cur = conn.cursor()
        cur.execute("SELECT pg_try_advisory_lock(%s)", (PARLIAMENT_LOCK_KEY,))
        acquired = cur.fetchone()[0]
        cur.close()
        if not acquired:
            conn.close()
            return None, False
        return conn, True
    except Exception as e:
        logger.error("Advisory lock acquisition failed: %s", e)
        return None, False


def _release_advisory_lock(conn):
    """Release the Parliament advisory lock and close the connection."""
    if conn is None:
        return
    try:
        cur = conn.cursor()
        cur.execute("SELECT pg_advisory_unlock(%s)", (PARLIAMENT_LOCK_KEY,))
        cur.close()
        conn.close()
    except Exception as e:
        logger.warning("Advisory lock release failed (connection will close): %s", e)
        try:
            conn.close()
        except Exception:
            pass


# ---------------------------------------------------------------------------
# Phase 1: Ingest
# ---------------------------------------------------------------------------


def run_ingest(
    commit: bool = False,
    max_items: Optional[int] = None,
    verbose: bool = False,
) -> Dict[str, Any]:
    """Run Parliament ingest pipeline (new items only).

    Returns a summary dict compatible with monitoring/logging.
    """
    from .parliament_pipeline import ParliamentPipeline

    if max_items is None:
        max_items = int(os.getenv("PARLIAMENT_MAX_INGEST_ITEMS", "500"))
    min_confidence = float(os.getenv("PARLIAMENT_MIN_CONFIDENCE", "0.30"))

    dry_run = not commit
    db_session = None
    if not dry_run:
        try:
            from database import SessionLocal

            db_session = SessionLocal()
        except Exception as e:
            logger.error("Cannot create DB session for ingest: %s", e)
            return {"phase": "ingest", "status": "error", "error": str(e)}

    try:
        pipeline = ParliamentPipeline(
            db_session=db_session,
            max_items=max_items,
            min_confidence=min_confidence,
        )
        stats = pipeline.run(dry_run=dry_run)
        summary = {
            "phase": "ingest",
            "status": "ok",
            "dry_run": dry_run,
            "discovered": stats.items_discovered,
            "inserted": stats.items_inserted,
            "skipped_duplicate": stats.items_skipped_duplicate,
            "skipped_low_confidence": stats.items_skipped_low_confidence,
            "errors": len(stats.errors),
            "error_details": stats.errors[:10],  # cap for log readability
        }
        if stats.errors:
            summary["status"] = "partial"
        logger.info("Ingest complete: %s", json.dumps(summary, default=str))
        return summary
    except Exception as e:
        logger.exception("Ingest failed: %s", e)
        return {"phase": "ingest", "status": "error", "error": str(e)}
    finally:
        if db_session:
            try:
                db_session.close()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Phase 2: Reconcile (re-resolve existing records)
# ---------------------------------------------------------------------------


def run_reconcile(
    commit: bool = False,
    verbose: bool = False,
) -> Dict[str, Any]:
    """Re-resolve entity metadata on all existing Parliament records.

    Wraps parliament_backfill.run_backfill() with structured output.
    """
    try:
        from .parliament_backfill import run_backfill

        result = run_backfill(commit=commit, verbose=verbose)
        summary = {
            "phase": "reconcile",
            "status": "ok",
            "dry_run": not commit,
            **result,
        }
        if result.get("errors", 0) > 0:
            summary["status"] = "partial"
        logger.info("Reconcile complete: %s", json.dumps(summary, default=str))
        return summary
    except Exception as e:
        logger.exception("Reconcile failed: %s", e)
        return {"phase": "reconcile", "status": "error", "error": str(e)}


# ---------------------------------------------------------------------------
# Phase 3: Validate (read-only quality checks)
# ---------------------------------------------------------------------------

_VALIDATION_QUERIES = {
    "total_records": """
        SELECT COUNT(*) FROM parliament_source_documents
    """,
    "unknown_entity_type": """
        SELECT COUNT(*) FROM parliament_source_documents
        WHERE metadata->>'entity_type' = 'unknown'
    """,
    "low_confidence": """
        SELECT COUNT(*) FROM parliament_source_documents
        WHERE confidence_score < 0.5
    """,
    "schools_as_state_corp": """
        SELECT COUNT(*) FROM parliament_source_documents p
        JOIN source_documents sd ON sd.id = p.source_document_id
        WHERE p.metadata->>'entity_type' = 'state_corporation'
          AND (
            sd.title ~* '\\y(university|college|school|polytechnic|institute|academy)\\y'
            OR p.metadata->>'entity_name' ~* '\\y(university|college|school|polytechnic|institute|academy)\\y'
          )
    """,
    "leaked_prefix": """
        SELECT COUNT(*) FROM parliament_source_documents
        WHERE metadata->>'entity_name' LIKE 'Report of%'
    """,
    "bare_ministry": """
        SELECT COUNT(*) FROM parliament_source_documents
        WHERE metadata->>'entity_type' = 'ministry'
          AND metadata->>'entity_name' NOT LIKE 'Ministry%'
          AND metadata->>'entity_name' NOT LIKE 'State Department%'
    """,
    "generic_name": """
        SELECT COUNT(*) FROM parliament_source_documents
        WHERE LOWER(metadata->>'entity_name') IN (
            'company', 'fund', 'board', 'authority', 'commission',
            'council', 'service', 'agency', 'corporation', 'account'
        )
    """,
    "numeric_only_name": """
        SELECT COUNT(*) FROM parliament_source_documents
        WHERE metadata->>'entity_name' ~ '^[0-9\\s]+$'
    """,
    "trailing_punctuation": """
        SELECT COUNT(*) FROM parliament_source_documents
        WHERE metadata->>'entity_name' ~ '[.,;:\\s]+$'
    """,
    "null_entity_name": """
        SELECT COUNT(*) FROM parliament_source_documents
        WHERE metadata->>'entity_name' IS NULL OR metadata->>'entity_name' = ''
    """,
}

# Thresholds: if a metric exceeds this, it's flagged as a warning
_WARN_THRESHOLDS = {
    "unknown_entity_type": 5,
    "low_confidence": 15,
    "schools_as_state_corp": 0,
    "leaked_prefix": 0,
    "bare_ministry": 0,
    "generic_name": 0,
    "numeric_only_name": 0,
    "trailing_punctuation": 0,
    "null_entity_name": 0,
}


def run_validation() -> Dict[str, Any]:
    """Run read-only quality checks on Parliament data.

    Returns a summary dict with metric counts and a list of warnings.
    """
    try:
        from database import SessionLocal
        from sqlalchemy import text
    except ImportError as e:
        return {"phase": "validate", "status": "error", "error": str(e)}

    session = SessionLocal()
    metrics: Dict[str, int] = {}
    warnings: list = []

    try:
        for name, query in _VALIDATION_QUERIES.items():
            try:
                result = session.execute(text(query)).scalar()
                metrics[name] = int(result) if result else 0
            except Exception as e:
                logger.warning("Validation query '%s' failed: %s", name, e)
                metrics[name] = -1
                session.rollback()

        # Check thresholds
        for metric, threshold in _WARN_THRESHOLDS.items():
            value = metrics.get(metric, 0)
            if value > threshold:
                warnings.append(f"{metric}={value} (threshold={threshold})")

        # Type distribution
        try:
            dist = session.execute(
                text(
                    """
                SELECT metadata->>'entity_type' AS etype, COUNT(*) AS cnt
                FROM parliament_source_documents
                GROUP BY metadata->>'entity_type'
                ORDER BY cnt DESC
            """
                )
            ).fetchall()
            metrics["type_distribution"] = {r[0]: r[1] for r in dist}
        except Exception:
            session.rollback()

        summary = {
            "phase": "validate",
            "status": "warn" if warnings else "ok",
            "metrics": metrics,
            "warnings": warnings,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # Concise log output
        total = metrics.get("total_records", 0)
        logger.info(
            "Parliament validation: total=%d, unknown=%d, low_conf=%d, "
            "schools_mistyped=%d, leaked_prefix=%d, bare_ministry=%d, "
            "generic=%d, numeric=%d, trailing_punct=%d",
            total,
            metrics.get("unknown_entity_type", 0),
            metrics.get("low_confidence", 0),
            metrics.get("schools_as_state_corp", 0),
            metrics.get("leaked_prefix", 0),
            metrics.get("bare_ministry", 0),
            metrics.get("generic_name", 0),
            metrics.get("numeric_only_name", 0),
            metrics.get("trailing_punctuation", 0),
        )
        if warnings:
            logger.warning("Parliament quality warnings: %s", "; ".join(warnings))

        return summary
    except Exception as e:
        logger.exception("Validation failed: %s", e)
        return {"phase": "validate", "status": "error", "error": str(e)}
    finally:
        session.close()


# ---------------------------------------------------------------------------
# Full orchestration
# ---------------------------------------------------------------------------


def orchestrate(
    commit: bool = False,
    verbose: bool = False,
    ingest_only: bool = False,
    reconcile_only: bool = False,
    validate_only: bool = False,
    max_items: Optional[int] = None,
) -> Dict[str, Any]:
    """Run the full Parliament ETL cycle: ingest → reconcile → validate.

    Returns a combined summary dict with results from each phase.
    """
    start = datetime.now(timezone.utc)
    results: Dict[str, Any] = {
        "started_at": start.isoformat(),
        "commit": commit,
        "phases": {},
    }

    if validate_only:
        results["phases"]["validate"] = run_validation()
        results["status"] = results["phases"]["validate"].get("status", "ok")
        results["ended_at"] = datetime.now(timezone.utc).isoformat()
        _log_summary(results)
        return results

    if not is_enabled() and commit:
        msg = "Parliament pipeline disabled (PARLIAMENT_PIPELINE_ENABLED != 1)"
        logger.warning(msg)
        results["status"] = "disabled"
        results["message"] = msg
        results["ended_at"] = datetime.now(timezone.utc).isoformat()
        return results

    # ------------------------------------------------------------------
    # Cross-process advisory lock: prevents overlapping runs when
    # multiple backend replicas or processes exist.
    # ------------------------------------------------------------------
    lock_conn, acquired = _try_advisory_lock()
    if not acquired:
        msg = (
            "Parliament ETL skipped — another instance holds advisory lock "
            f"(key={PARLIAMENT_LOCK_KEY})"
        )
        logger.info(msg)
        results["status"] = "skipped"
        results["message"] = msg
        results["ended_at"] = datetime.now(timezone.utc).isoformat()
        return results

    try:
        # Phase 1: Ingest
        if not reconcile_only:
            logger.info("=== Parliament Phase 1: Ingest ===")
            ingest_result = run_ingest(
                commit=commit,
                max_items=max_items,
                verbose=verbose,
            )
            results["phases"]["ingest"] = ingest_result

            if ingest_result.get("status") == "error":
                logger.error("Ingest failed — skipping reconcile/validate")
                results["status"] = "error"
                results["ended_at"] = datetime.now(timezone.utc).isoformat()
                _log_summary(results)
                return results

        # Phase 2: Reconcile
        if not ingest_only and reconcile_enabled():
            logger.info("=== Parliament Phase 2: Reconcile ===")
            reconcile_result = run_reconcile(commit=commit, verbose=verbose)
            results["phases"]["reconcile"] = reconcile_result
        elif not ingest_only:
            logger.info("Reconcile disabled (PARLIAMENT_RECONCILE_ENABLED=0)")

        # Phase 3: Validate (always runs, always read-only)
        logger.info("=== Parliament Phase 3: Validate ===")
        results["phases"]["validate"] = run_validation()

        # Overall status
        statuses = [p.get("status", "ok") for p in results["phases"].values()]
        if "error" in statuses:
            results["status"] = "error"
        elif "partial" in statuses or "warn" in statuses:
            results["status"] = "warn"
        else:
            results["status"] = "ok"

        results["ended_at"] = datetime.now(timezone.utc).isoformat()
        _log_summary(results)
        return results
    finally:
        _release_advisory_lock(lock_conn)


def _log_summary(results: Dict[str, Any]) -> None:
    """Print a concise human-readable summary."""
    status = results.get("status", "unknown")
    phases = results.get("phases", {})
    started = results.get("started_at", "")
    ended = results.get("ended_at", "")

    print(f"\n{'='*60}")
    print(f"  PARLIAMENT ETL ORCHESTRATOR — {status.upper()}")
    print(f"  {started} → {ended}")
    print(f"{'='*60}")

    if "ingest" in phases:
        p = phases["ingest"]
        print(f"\n  Ingest: {p.get('status', '?')}")
        print(
            f"    discovered={p.get('discovered', 0)}, "
            f"inserted={p.get('inserted', 0)}, "
            f"skipped_dup={p.get('skipped_duplicate', 0)}, "
            f"errors={p.get('errors', 0)}"
        )

    if "reconcile" in phases:
        p = phases["reconcile"]
        print(f"\n  Reconcile: {p.get('status', '?')}")
        print(
            f"    total={p.get('total', 0)}, "
            f"changed={p.get('changed', 0)}, "
            f"errors={p.get('errors', 0)}"
        )
        cats = p.get("categories", {})
        if cats:
            print(f"    fixes: {cats}")

    if "validate" in phases:
        p = phases["validate"]
        m = p.get("metrics", {})
        print(f"\n  Validate: {p.get('status', '?')}")
        print(
            f"    total={m.get('total_records', 0)}, "
            f"unknown={m.get('unknown_entity_type', 0)}, "
            f"low_conf={m.get('low_confidence', 0)}, "
            f"schools_mistyped={m.get('schools_as_state_corp', 0)}"
        )
        warns = p.get("warnings", [])
        if warns:
            for w in warns:
                print(f"    ⚠ {w}")

    print(f"\n{'='*60}\n")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(
        description="Parliament ETL Orchestrator — ingest, reconcile, validate",
    )
    parser.add_argument(
        "--commit",
        action="store_true",
        help="Apply changes to database (default: dry-run)",
    )
    parser.add_argument(
        "--ingest-only",
        action="store_true",
        help="Run ingest phase only",
    )
    parser.add_argument(
        "--reconcile-only",
        action="store_true",
        help="Run reconciliation phase only",
    )
    parser.add_argument(
        "--validate-only",
        action="store_true",
        help="Run validation only (always read-only)",
    )
    parser.add_argument(
        "--max-items",
        type=int,
        default=None,
        help="Maximum items to ingest (default: PARLIAMENT_MAX_INGEST_ITEMS or 500)",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose/debug logging",
    )
    args = parser.parse_args()

    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(name)s %(levelname)s %(message)s",
    )

    if args.commit and not is_enabled() and not args.validate_only:
        logger.error(
            "Parliament pipeline is disabled. "
            "Set PARLIAMENT_PIPELINE_ENABLED=1 to enable."
        )
        sys.exit(1)

    result = orchestrate(
        commit=args.commit,
        verbose=args.verbose,
        ingest_only=args.ingest_only,
        reconcile_only=args.reconcile_only,
        validate_only=args.validate_only,
        max_items=args.max_items,
    )
    sys.exit(0 if result.get("status") != "error" else 1)


if __name__ == "__main__":
    main()
