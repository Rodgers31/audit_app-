"""Parser for debt timeline data."""

from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger("seeding.debt_timeline.parser")


@dataclass
class DebtTimelineRecord:
    """One year of public debt composition."""

    year: int
    external: float  # Billions KES
    domestic: float  # Billions KES
    total: float  # Billions KES
    gdp: float | None  # Billions KES
    gdp_ratio: float | None  # e.g. 77.6


def parse_debt_timeline_payload(payload: dict[str, Any]) -> list[DebtTimelineRecord]:
    """Parse debt timeline JSON payload into records."""
    timeline = payload.get("timeline", [])
    if not timeline:
        logger.warning("No timeline entries found in payload")
        return []

    records: list[DebtTimelineRecord] = []
    for entry in timeline:
        try:
            records.append(
                DebtTimelineRecord(
                    year=int(entry["year"]),
                    external=float(entry["external"]),
                    domestic=float(entry["domestic"]),
                    total=float(entry["total"]),
                    gdp=float(entry["gdp"]) if entry.get("gdp") else None,
                    gdp_ratio=(
                        float(entry["gdp_ratio"]) if entry.get("gdp_ratio") else None
                    ),
                )
            )
        except (KeyError, ValueError, TypeError) as exc:
            logger.warning(f"Skipping malformed timeline entry: {exc}")
            continue

    logger.info(f"Parsed {len(records)} debt timeline records")
    return records
