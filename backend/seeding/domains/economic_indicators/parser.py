"""Normalize economic indicator payloads into structured records."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from decimal import Decimal, InvalidOperation
from typing import Any, Dict, Iterable, List, Optional


@dataclass
class EconomicIndicatorRecord:
    indicator_type: str
    indicator_date: datetime
    value: Decimal
    unit: Optional[str]
    entity_slug: Optional[str]
    entity_name: Optional[str]
    dataset_id: Optional[str]
    source_url: Optional[str]
    metadata: Dict[str, Any] = field(default_factory=dict)


def _iter_items(payload: Any) -> Iterable[Dict[str, Any]]:
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                yield item
    elif isinstance(payload, dict):
        records = payload.get("records")
        if isinstance(records, list):
            for item in records:
                if isinstance(item, dict):
                    fields = item.get("fields")
                    if isinstance(fields, dict):
                        yield fields
                    else:
                        yield item
        else:
            yield payload


def _to_datetime(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, tz=timezone.utc)
    text = str(value)
    for fmt in (None, "%Y-%m-%d", "%Y-%m", "%Y"):
        try:
            parsed = (
                datetime.fromisoformat(text)
                if fmt is None
                else datetime.strptime(text, fmt)
            )
            if parsed.tzinfo is None:
                parsed = parsed.replace(tzinfo=timezone.utc)
            return parsed
        except ValueError:
            continue
    return None


def _to_decimal(value: Any) -> Optional[Decimal]:
    if value in (None, "", "NaN"):
        return None
    try:
        return Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError):
        return None


def parse_economic_payload(payload: Any) -> List[EconomicIndicatorRecord]:
    normalized: List[EconomicIndicatorRecord] = []

    for raw in _iter_items(payload):
        indicator_type = raw.get("indicator_type") or raw.get("type")
        indicator_date = _to_datetime(raw.get("indicator_date") or raw.get("date"))
        value = _to_decimal(raw.get("value"))

        if not indicator_type or indicator_date is None or value is None:
            continue

        normalized.append(
            EconomicIndicatorRecord(
                indicator_type=str(indicator_type).lower().replace(" ", "_"),
                indicator_date=indicator_date,
                value=value,
                unit=(str(raw.get("unit")) if raw.get("unit") else None),
                entity_slug=(
                    str(raw.get("entity_slug") or raw.get("county_slug") or "").lower()
                    or None
                ),
                entity_name=(
                    str(raw.get("entity") or raw.get("county") or "").strip() or None
                ),
                dataset_id=raw.get("dataset_id"),
                source_url=raw.get("source_url") or raw.get("url"),
                metadata={
                    k: v
                    for k, v in raw.items()
                    if k
                    not in {
                        "indicator_type",
                        "type",
                        "indicator_date",
                        "date",
                        "value",
                        "unit",
                        "entity_slug",
                        "county_slug",
                        "entity",
                        "county",
                        "dataset_id",
                        "source_url",
                        "url",
                    }
                },
            )
        )

    return normalized


__all__ = ["EconomicIndicatorRecord", "parse_economic_payload"]
