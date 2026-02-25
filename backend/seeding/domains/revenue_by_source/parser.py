"""Normalize revenue-by-source payloads into structured records."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, List, Optional


@dataclass
class RevenueBySourceRecord:
    fiscal_year: str
    revenue_type: str
    category: str
    amount_billion_kes: Optional[Decimal]
    target_billion_kes: Optional[Decimal]
    performance_pct: Optional[Decimal]
    share_of_total_pct: Optional[Decimal]
    yoy_growth_pct: Optional[Decimal]
    source_url: Optional[str]
    metadata: Dict[str, Any] = field(default_factory=dict)


def _to_decimal(value: Any) -> Optional[Decimal]:
    if value is None:
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def parse_revenue_payload(payload: List[Dict[str, Any]]) -> List[RevenueBySourceRecord]:
    """Parse raw JSON records into typed dataclass records."""
    records: List[RevenueBySourceRecord] = []

    for item in payload:
        if not isinstance(item, dict):
            continue

        fiscal_year = item.get("fiscal_year")
        revenue_type = item.get("revenue_type")

        if not fiscal_year or not revenue_type:
            continue

        record = RevenueBySourceRecord(
            fiscal_year=str(fiscal_year).strip(),
            revenue_type=str(revenue_type).strip(),
            category=str(item.get("category", "tax")).strip(),
            amount_billion_kes=_to_decimal(item.get("amount_billion_kes")),
            target_billion_kes=_to_decimal(item.get("target_billion_kes")),
            performance_pct=_to_decimal(item.get("performance_pct")),
            share_of_total_pct=_to_decimal(item.get("share_of_total_pct")),
            yoy_growth_pct=_to_decimal(item.get("yoy_growth_pct")),
            source_url=item.get("source_url"),
            metadata={k: v for k, v in item.items() if k in ("notes",)},
        )
        records.append(record)

    return records
