"""Normalize budgets payloads into structured records."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional


@dataclass
class BudgetRecord:
    entity_slug: str
    entity_name: str
    period_label: str
    start_date: date
    end_date: date
    category: str
    subcategory: Optional[str]
    allocated_amount: Optional[Decimal]
    actual_amount: Optional[Decimal]
    currency: str
    dataset_id: Optional[str]
    source_url: Optional[str]


def _iter_records(payload: Any) -> Iterable[Dict[str, Any]]:
    # Handle direct list (real budget data format)
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                yield item
        return

    # Handle wrapped format with "records" key (fixture format)
    if not isinstance(payload, dict):
        return

    records = payload.get("records")
    if isinstance(records, list):
        for item in records:
            if isinstance(item, dict):
                fields = (
                    item.get("fields") if isinstance(item.get("fields"), dict) else item
                )
                if isinstance(fields, dict):
                    yield fields
    elif isinstance(payload, dict):
        yield payload


def _to_decimal(value: Any) -> Optional[Decimal]:
    if value in (None, "", "NaN"):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return None


def _to_date(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, (datetime, date)):
        return value.date() if isinstance(value, datetime) else value
    try:
        return datetime.fromisoformat(str(value)).date()
    except ValueError:
        return None


def parse_budget_payload(payload: Dict[str, Any]) -> List[BudgetRecord]:
    normalized: List[BudgetRecord] = []

    for raw in _iter_records(payload):
        slug = raw.get("entity_slug") or raw.get("slug")
        name = raw.get("entity") or raw.get("name")
        period_label = raw.get("period_label") or raw.get("fiscal_year")
        start = _to_date(raw.get("start_date"))
        end = _to_date(raw.get("end_date"))
        category = raw.get("category")

        if (
            not slug
            or not name
            or not period_label
            or not category
            or not start
            or not end
        ):
            continue

        record = BudgetRecord(
            entity_slug=str(slug).lower(),
            entity_name=str(name),
            period_label=str(period_label),
            start_date=start,
            end_date=end,
            category=str(category),
            subcategory=(str(raw["subcategory"]) if raw.get("subcategory") else None),
            allocated_amount=_to_decimal(
                raw.get("allocated_amount") or raw.get("allocated")
            ),
            actual_amount=_to_decimal(raw.get("actual_amount") or raw.get("actual")),
            currency=str(raw.get("currency") or "KES"),
            dataset_id=raw.get("dataset_id"),
            source_url=raw.get("source_url") or raw.get("url"),
        )
        normalized.append(record)

    return normalized


__all__ = ["BudgetRecord", "parse_budget_payload"]
