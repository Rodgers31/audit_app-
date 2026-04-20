"""
Follow the Money – county and national money-flow waterfall endpoints.

Traces public funds through: Allocation → Release → Expenditure → Audit Flags.
"""

import functools
import logging
import re
import time
from collections import defaultdict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from database import get_db
from models import Audit, BudgetLine, Entity, EntityType, FiscalPeriod

logger = logging.getLogger(__name__)

# Try to import Redis cache; fall back to in-memory TTL cache
try:
    from cache.redis_cache import RedisCache
    _redis_cache = RedisCache()
except Exception:
    _redis_cache = None


def _cached(key_prefix: str, ttl: int = 1800):
    """Cache decorator with Redis + in-memory fallback."""
    def decorator(fn):
        _mem: Dict[str, Dict[str, Any]] = {}

        @functools.wraps(fn)
        async def wrapper(*args, **kwargs):
            parts = [key_prefix]
            for k, v in kwargs.items():
                if k not in ("db", "request", "background_tasks"):
                    parts.append(f"{k}:{v}")
            cache_key = ":".join(parts)

            if _redis_cache:
                hit = _redis_cache.get(cache_key)
                if hit is not None:
                    return hit
                result = await fn(*args, **kwargs)
                _redis_cache.set(cache_key, result, ttl=ttl)
                return result

            rec = _mem.get(cache_key)
            if rec and (time.time() - rec["ts"]) < ttl:
                return rec["value"]
            result = await fn(*args, **kwargs)
            _mem[cache_key] = {"value": result, "ts": time.time()}
            return result

        wrapper._cache = _mem  # expose for test teardown
        return wrapper
    return decorator

router = APIRouter(prefix="/api/v1", tags=["money-flow"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_stage(
    stage: str,
    label: str,
    amount: Optional[float],
    source: Optional[str] = None,
    source_doc: Optional[str] = None,
    gap_from_prev: Optional[float] = None,
    gap_label: Optional[str] = None,
    data_unavailable: bool = False,
) -> Dict[str, Any]:
    """Build a single waterfall stage dict."""
    d: Dict[str, Any] = {
        "stage": stage,
        "label": label,
        "amount": amount,
    }
    if source is not None:
        d["source"] = source
    if source_doc is not None:
        d["source_doc"] = source_doc
    if gap_from_prev is not None:
        d["gap_from_prev"] = gap_from_prev
    if gap_label is not None:
        d["gap_label"] = gap_label
    if data_unavailable:
        d["data_unavailable"] = True
    return d


def _normalize_fiscal_year(fiscal_year: str) -> List[str]:
    """Return candidate DB label forms for a fiscal year input.

    Accepts "2023/24", "2023/2024", "FY2023/24", "FY 2023/24",
    "2023-24", "2023-2024", "23/24" etc. and emits the canonical
    "FY2023/24" label plus a couple of common variants so ``_resolve_periods``
    can match regardless of how the caller formatted it.
    """
    if not fiscal_year:
        return []
    raw = fiscal_year.strip().upper().replace("FY", "").strip()
    m = re.match(r"^\s*(\d{2,4})\s*[/\-]\s*(\d{2,4})\s*$", raw)
    if not m:
        return []
    y1, y2 = m.group(1), m.group(2)
    y1_full = y1 if len(y1) == 4 else f"20{y1}"
    y2_short = y2[-2:] if len(y2) >= 2 else y2.zfill(2)
    y2_full = f"{y1_full[:2]}{y2_short}"
    # Emit canonical + a few tolerated legacy variants
    return [
        f"FY{y1_full}/{y2_short}",        # canonical: FY2023/24
        f"FY{y1_full}/{y2_full}",         # FY2023/2024
        f"{y1_full}/{y2_short}",          # 2023/24
        f"{y1_full}/{y2_full}",           # 2023/2024
        f"FY{y1_full}-{y2_short}",        # FY2023-24
    ]


def _resolve_periods(db: Session, fiscal_year: str) -> List[int]:
    """Return period IDs matching the given fiscal year (tolerant of format)."""
    candidates = _normalize_fiscal_year(fiscal_year)
    if not candidates:
        return []
    periods = (
        db.query(FiscalPeriod.id)
        .filter(FiscalPeriod.label.in_(candidates))
        .all()
    )
    return [p.id for p in periods]


def _money_flow_for_entity(
    db: Session,
    entity_id: int,
    period_ids: List[int],
) -> Dict[str, Any]:
    """Compute money-flow stages for a single entity and period set."""
    # --- Allocated & Spent from BudgetLine ---
    # If no matching periods found, there's no data for this year
    if not period_ids:
        return {
            "stages": [
                _build_stage("Allocated", "Budget Allocation", None,
                             source="CRA Allocation + Conditional Grants", data_unavailable=True),
                _build_stage("Released", "Funds Released", None,
                             gap_label="Withheld/Delayed", data_unavailable=True),
                _build_stage("Spent", "Actual Expenditure", None,
                             gap_label="Unspent Funds", data_unavailable=True),
                _build_stage("Flagged", "Auditor Flagged", None,
                             gap_label="Irregular/Unsupported Expenditure", data_unavailable=True),
            ],
            "total_waste_estimate": None,
            "efficiency_score": None,
        }

    budget_q = db.query(BudgetLine).filter(
        BudgetLine.entity_id == entity_id,
        BudgetLine.period_id.in_(period_ids),
    )
    budget_lines = budget_q.all()

    if budget_lines:
        allocated = sum(float(b.allocated_amount or 0) for b in budget_lines)
        # Treat "no non-null spent rows" as data-unavailable (projected-
        # year budgets don't have execution figures yet). Returning 0
        # would misleadingly render as "100% unspent" in the waterfall.
        spent_vals = [b.actual_spent for b in budget_lines if b.actual_spent is not None]
        spent = sum(float(s) for s in spent_vals) if spent_vals else None
        # COB data doesn't have a separate "released" column – use committed_amount
        # as a proxy for releases if available, otherwise mark unavailable.
        committed_amounts = [b.committed_amount for b in budget_lines if b.committed_amount is not None]
        if committed_amounts:
            released = sum(float(c) for c in committed_amounts)
        else:
            released = None

        # Source doc URL from first budget line
        first_doc = budget_lines[0].source_document if budget_lines else None
        source_doc_url = first_doc.url if first_doc and hasattr(first_doc, "url") else None
    else:
        allocated = None
        released = None
        spent = None
        source_doc_url = None

    # --- Audit flagged amounts ---
    audit_q = db.query(func.sum(Audit.amount)).filter(
        Audit.entity_id == entity_id,
        Audit.period_id.in_(period_ids),
    )
    flagged = audit_q.scalar()
    flagged = float(flagged) if flagged else None

    # --- Build stages ---
    stages: List[Dict[str, Any]] = []

    # 1. Allocated
    stages.append(_build_stage(
        stage="Allocated",
        label="Budget Allocation",
        amount=allocated,
        source="CRA Allocation + Conditional Grants",
        source_doc=source_doc_url,
        data_unavailable=allocated is None,
    ))

    # 2. Released
    if released is not None and allocated is not None:
        gap = round(allocated - released, 2)
    else:
        gap = None
    stages.append(_build_stage(
        stage="Released",
        label="Funds Released",
        amount=released,
        gap_from_prev=gap,
        gap_label="Withheld/Delayed",
        data_unavailable=released is None,
    ))

    # 3. Spent
    prev_for_spent = released if released is not None else allocated
    if spent is not None and prev_for_spent is not None:
        gap_spent = round(prev_for_spent - spent, 2)
    else:
        gap_spent = None
    stages.append(_build_stage(
        stage="Spent",
        label="Actual Expenditure",
        amount=spent,
        gap_from_prev=gap_spent,
        gap_label="Unspent Funds",
        data_unavailable=spent is None,
    ))

    # 4. Flagged
    stages.append(_build_stage(
        stage="Flagged",
        label="Auditor Flagged",
        amount=flagged,
        gap_from_prev=None,
        gap_label="Irregular/Unsupported Expenditure",
        data_unavailable=flagged is None,
    ))

    # --- Derived metrics ---
    efficiency = None
    if spent is not None and allocated and allocated > 0:
        efficiency = round((spent / allocated) * 100, 2)

    return {
        "stages": stages,
        "total_waste_estimate": flagged,
        "efficiency_score": efficiency,
    }


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/counties/{county_id}/money-flow")
async def county_money_flow(
    county_id: str,
    year: str = Query(..., description="Fiscal year label, e.g. '2024/25'"),
    db: Session = Depends(get_db),
):
    """Trace the full money flow for a county in a fiscal year.

    ``county_id`` accepts either the numeric ``Entity.id`` or the county
    ``slug`` (e.g. ``nairobi-city``) so the frontend can link by either.
    """
    q = db.query(Entity).filter(Entity.type == EntityType.COUNTY)
    if county_id.isdigit():
        entity = q.filter(Entity.id == int(county_id)).first()
    else:
        entity = q.filter(Entity.slug == county_id).first()
    if not entity:
        raise HTTPException(status_code=404, detail="County not found")

    period_ids = _resolve_periods(db, year)

    result = _money_flow_for_entity(db, entity.id, period_ids)

    return {
        "county_id": entity.id,
        "county_name": entity.canonical_name,
        "fiscal_year": year,
        **result,
    }


@router.get("/audit/money-flow/national")
@_cached(key_prefix="money-flow:national", ttl=1800)
async def national_money_flow(
    year: str = Query(..., description="Fiscal year label, e.g. '2024/25'"),
    db: Session = Depends(get_db),
):
    """Aggregate money flow across all counties for a fiscal year."""
    period_ids = _resolve_periods(db, year)

    county_entities = (
        db.query(Entity).filter(Entity.type == EntityType.COUNTY).all()
    )
    if not county_entities:
        raise HTTPException(status_code=404, detail="No county entities found")

    entity_ids = [e.id for e in county_entities]

    # --- Aggregated budget data ---
    if not period_ids:
        allocated = None
        released = None
        spent = None
        source_doc_url = None
        flagged = None
    else:
        budget_q = db.query(BudgetLine).filter(
            BudgetLine.entity_id.in_(entity_ids),
            BudgetLine.period_id.in_(period_ids),
        )
        budget_lines = budget_q.all()

        if budget_lines:
            allocated = sum(float(b.allocated_amount or 0) for b in budget_lines)
            # Treat "no non-null spent rows" as data-unavailable (e.g.
            # projected-year budgets where CoB has not yet released the
            # execution figures). Returning 0 in that case lies by
            # omission — the waterfall would show 100% unspent.
            spent_vals = [b.actual_spent for b in budget_lines if b.actual_spent is not None]
            spent = sum(float(s) for s in spent_vals) if spent_vals else None
            committed = [b.committed_amount for b in budget_lines if b.committed_amount is not None]
            released = sum(float(c) for c in committed) if committed else None
            first_doc = budget_lines[0].source_document if budget_lines else None
            source_doc_url = first_doc.url if first_doc and hasattr(first_doc, "url") else None
        else:
            allocated = None
            released = None
            spent = None
            source_doc_url = None

        # --- Aggregated audit flags ---
        audit_q = db.query(func.sum(Audit.amount)).filter(
            Audit.entity_id.in_(entity_ids),
            Audit.period_id.in_(period_ids),
        )
        flagged_raw = audit_q.scalar()
        flagged = float(flagged_raw) if flagged_raw else None

    # --- Build stages ---
    stages = []

    stages.append(_build_stage(
        stage="Allocated",
        label="Budget Allocation",
        amount=allocated,
        source="CRA Allocation + Conditional Grants",
        source_doc=source_doc_url,
        data_unavailable=allocated is None,
    ))

    if released is not None and allocated is not None:
        gap = round(allocated - released, 2)
    else:
        gap = None
    stages.append(_build_stage(
        stage="Released",
        label="Funds Released",
        amount=released,
        gap_from_prev=gap,
        gap_label="Withheld/Delayed",
        data_unavailable=released is None,
    ))

    prev_for_spent = released if released is not None else allocated
    if spent is not None and prev_for_spent is not None:
        gap_spent = round(prev_for_spent - spent, 2)
    else:
        gap_spent = None
    stages.append(_build_stage(
        stage="Spent",
        label="Actual Expenditure",
        amount=spent,
        gap_from_prev=gap_spent,
        gap_label="Unspent Funds",
        data_unavailable=spent is None,
    ))

    stages.append(_build_stage(
        stage="Flagged",
        label="Auditor Flagged",
        amount=flagged,
        gap_from_prev=None,
        gap_label="Irregular/Unsupported Expenditure",
        data_unavailable=flagged is None,
    ))

    efficiency = None
    if spent is not None and allocated and allocated > 0:
        efficiency = round((spent / allocated) * 100, 2)

    return {
        "county_id": None,
        "county_name": "National (All Counties)",
        "fiscal_year": year,
        "county_count": len(county_entities),
        "stages": stages,
        "total_waste_estimate": flagged,
        "efficiency_score": efficiency,
    }


@router.get("/money-flow/all-counties")
@_cached(key_prefix="money-flow:all-counties", ttl=1800)
async def all_counties_money_flow(
    year: str = Query(..., description="Fiscal year label, e.g. '2024/25'"),
    db: Session = Depends(get_db),
):
    """Batch endpoint: money flow for every county in a single response.

    Replaces N individual /counties/{id}/money-flow calls with 3 SQL queries.
    """
    period_ids = _resolve_periods(db, year)

    # 1. All county entities in ONE query
    county_entities = (
        db.query(Entity.id, Entity.canonical_name)
        .filter(Entity.type == EntityType.COUNTY)
        .all()
    )
    if not county_entities:
        return []

    entity_map = {eid: name for eid, name in county_entities}
    entity_ids = list(entity_map.keys())

    # Short-circuit if no matching fiscal periods
    if not period_ids:
        no_data_stages = [
            _build_stage("Allocated", "Budget Allocation", None,
                         source="CRA Allocation + Conditional Grants", data_unavailable=True),
            _build_stage("Released", "Funds Released", None,
                         gap_label="Withheld/Delayed", data_unavailable=True),
            _build_stage("Spent", "Actual Expenditure", None,
                         gap_label="Unspent Funds", data_unavailable=True),
            _build_stage("Flagged", "Auditor Flagged", None,
                         gap_label="Irregular/Unsupported Expenditure", data_unavailable=True),
        ]
        return [
            {
                "county_id": eid,
                "county_name": name,
                "fiscal_year": year,
                "stages": no_data_stages,
                "total_waste_estimate": None,
                "efficiency_score": None,
            }
            for eid, name in county_entities
        ]

    # 2. Aggregate budget lines per entity in ONE query
    budget_rows = (
        db.query(
            BudgetLine.entity_id,
            func.sum(func.coalesce(BudgetLine.allocated_amount, 0)).label("allocated"),
            func.sum(func.coalesce(BudgetLine.actual_spent, 0)).label("spent"),
            func.sum(BudgetLine.committed_amount).label("committed"),
        )
        .filter(
            BudgetLine.entity_id.in_(entity_ids),
            BudgetLine.period_id.in_(period_ids),
        )
        .group_by(BudgetLine.entity_id)
        .all()
    )
    budget_map: Dict[int, Dict[str, Any]] = {}
    for eid, alloc, spent, committed in budget_rows:
        budget_map[eid] = {
            "allocated": float(alloc) if alloc else None,
            "spent": float(spent) if spent else None,
            "released": float(committed) if committed else None,
        }

    # 3. Aggregate audit flagged amounts per entity in ONE query
    audit_rows = (
        db.query(
            Audit.entity_id,
            func.sum(Audit.amount),
        )
        .filter(
            Audit.entity_id.in_(entity_ids),
            Audit.period_id.in_(period_ids),
        )
        .group_by(Audit.entity_id)
        .all()
    )
    flagged_map: Dict[int, float] = {
        eid: float(amt) for eid, amt in audit_rows if amt
    }

    # 4. Build response for every county
    results = []
    for eid, name in county_entities:
        b = budget_map.get(eid, {})
        allocated = b.get("allocated")
        released = b.get("released")
        spent = b.get("spent")
        flagged = flagged_map.get(eid)

        stages: List[Dict[str, Any]] = []

        stages.append(_build_stage(
            stage="Allocated", label="Budget Allocation", amount=allocated,
            source="CRA Allocation + Conditional Grants",
            data_unavailable=allocated is None,
        ))

        gap_rel = round(allocated - released, 2) if (released is not None and allocated is not None) else None
        stages.append(_build_stage(
            stage="Released", label="Funds Released", amount=released,
            gap_from_prev=gap_rel, gap_label="Withheld/Delayed",
            data_unavailable=released is None,
        ))

        prev = released if released is not None else allocated
        gap_spent = round(prev - spent, 2) if (spent is not None and prev is not None) else None
        stages.append(_build_stage(
            stage="Spent", label="Actual Expenditure", amount=spent,
            gap_from_prev=gap_spent, gap_label="Unspent Funds",
            data_unavailable=spent is None,
        ))

        stages.append(_build_stage(
            stage="Flagged", label="Auditor Flagged", amount=flagged,
            gap_from_prev=None, gap_label="Irregular/Unsupported Expenditure",
            data_unavailable=flagged is None,
        ))

        efficiency = None
        if spent is not None and allocated and allocated > 0:
            efficiency = round((spent / allocated) * 100, 2)

        results.append({
            "county_id": eid,
            "county_name": name,
            "fiscal_year": year,
            "stages": stages,
            "total_waste_estimate": flagged,
            "efficiency_score": efficiency,
        })

    return results
