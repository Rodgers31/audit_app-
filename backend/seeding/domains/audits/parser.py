"""Normalize audit payloads."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Any, Dict, Iterable, List, Optional


@dataclass
class AuditRecord:
    entity_slug: str
    entity_name: str
    period_label: str
    start_date: date
    end_date: date
    finding_text: str
    severity: str
    recommended_action: Optional[str]
    reference: Optional[str]
    dataset_id: Optional[str]
    source_url: Optional[str]


def _iter_records(
    payload: Dict[str, Any] | List[Dict[str, Any]],
) -> Iterable[Dict[str, Any]]:
    # Handle direct JSON array format (real data)
    if isinstance(payload, list):
        for item in payload:
            if isinstance(item, dict):
                yield item
        return

    # Handle wrapped format (fixtures)
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


def _to_date(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.fromisoformat(str(value)).date()
    except ValueError:
        return None


def parse_audit_payload(
    payload: Dict[str, Any] | List[Dict[str, Any]],
) -> List[AuditRecord]:
    normalized: List[AuditRecord] = []

    for raw in _iter_records(payload):
        slug = raw.get("entity_slug") or raw.get("slug")
        entity_name = raw.get("entity") or raw.get("name")
        period_label = raw.get("period_label") or raw.get("fiscal_year")
        severity = raw.get("severity")
        finding_text = raw.get("finding") or raw.get("finding_text")
        start_date = _to_date(raw.get("start_date"))
        end_date = _to_date(raw.get("end_date"))

        if (
            not slug
            or not entity_name
            or not period_label
            or not severity
            or not finding_text
        ):
            continue
        if not start_date or not end_date:
            continue

        record = AuditRecord(
            entity_slug=str(slug).lower(),
            entity_name=str(entity_name),
            period_label=str(period_label),
            start_date=start_date,
            end_date=end_date,
            finding_text=str(finding_text),
            severity=str(severity),
            recommended_action=raw.get("recommended_action")
            or raw.get("recommendation"),
            reference=raw.get("reference") or raw.get("source_reference"),
            dataset_id=raw.get("dataset_id"),
            source_url=raw.get("source_url") or raw.get("url"),
        )
        normalized.append(record)

    return normalized


__all__ = ["AuditRecord", "parse_audit_payload"]
