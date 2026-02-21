"""Parser for fiscal summary data."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("seeding.fiscal_summary.parser")


@dataclass
class FiscalSummaryRecord:
    """One fiscal year of national fiscal data."""

    fiscal_year: str  # "FY 2024/25"
    appropriated_budget: float | None
    total_revenue: float | None
    tax_revenue: float | None
    non_tax_revenue: float | None
    total_borrowing: float | None
    borrowing_pct_of_budget: float | None
    debt_service_cost: float | None
    debt_service_per_shilling: float | None
    debt_ceiling: float | None
    actual_debt: float | None
    debt_ceiling_usage_pct: float | None
    development_spending: float | None
    recurrent_spending: float | None
    county_allocation: float | None


def _safe_float(val: Any) -> float | None:
    if val is None:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def parse_fiscal_summary_payload(payload: dict[str, Any]) -> list[FiscalSummaryRecord]:
    """Parse fiscal summary JSON payload into records."""
    fiscal_years = payload.get("fiscal_years", [])
    if not fiscal_years:
        logger.warning("No fiscal_years entries found in payload")
        return []

    records: list[FiscalSummaryRecord] = []
    for fy in fiscal_years:
        label = fy.get("fiscal_year")
        if not label:
            logger.warning("Skipping fiscal entry without fiscal_year label")
            continue

        records.append(
            FiscalSummaryRecord(
                fiscal_year=label,
                appropriated_budget=_safe_float(fy.get("appropriated_budget")),
                total_revenue=_safe_float(fy.get("total_revenue")),
                tax_revenue=_safe_float(fy.get("tax_revenue")),
                non_tax_revenue=_safe_float(fy.get("non_tax_revenue")),
                total_borrowing=_safe_float(fy.get("total_borrowing")),
                borrowing_pct_of_budget=_safe_float(fy.get("borrowing_pct_of_budget")),
                debt_service_cost=_safe_float(fy.get("debt_service_cost")),
                debt_service_per_shilling=_safe_float(
                    fy.get("debt_service_per_shilling")
                ),
                debt_ceiling=_safe_float(fy.get("debt_ceiling")),
                actual_debt=_safe_float(fy.get("actual_debt")),
                debt_ceiling_usage_pct=_safe_float(fy.get("debt_ceiling_usage_pct")),
                development_spending=_safe_float(fy.get("development_spending")),
                recurrent_spending=_safe_float(fy.get("recurrent_spending")),
                county_allocation=_safe_float(fy.get("county_allocation")),
            )
        )

    logger.info(f"Parsed {len(records)} fiscal summary records")
    return records
