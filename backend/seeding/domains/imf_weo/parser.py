"""Parse IMF DataMapper JSON into ``ImfWeoObservation`` row dicts.

Input shape (per indicator):
    {"values": {"GGXWDG_NGDP": {"KEN": {"2024": 67.3, "2025": 69.3, ...}}}}

Output: a flat list of dicts suitable for bulk upsert:
    [
      {
        "country_code": "KEN",
        "indicator": "GGXWDG_NGDP",
        "year": 2024,
        "value": 67.3,
        "is_projection": False,
        "vintage": <datetime>,
        "source": "imf_datamapper",
      },
      ...
    ]

``is_projection`` uses the current calendar year as the cutoff —
anything ``year >= now.year`` is treated as an IMF forecast rather
than a historical observation. That matches how WEO itself labels
rows (the latest historical year shifts each April/October vintage).
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, Iterable, List

logger = logging.getLogger("seeding.imf_weo.parser")


def parse_imf_weo(
    payload: Dict[str, Dict[str, Any]], vintage: datetime
) -> List[Dict[str, Any]]:
    """Flatten IMF responses into per-(country, indicator, year) rows."""
    rows: List[Dict[str, Any]] = []
    projection_cutoff = vintage.year
    for indicator, response in payload.items():
        values = response.get("values", {}).get(indicator, {})
        if not isinstance(values, dict):
            logger.warning(
                "IMF response for %s has unexpected shape; skipping", indicator
            )
            continue
        for country_code, year_vals in values.items():
            if not isinstance(year_vals, dict):
                continue
            for year_str, raw in year_vals.items():
                try:
                    year = int(year_str)
                except (TypeError, ValueError):
                    continue
                value = _coerce_numeric(raw)
                rows.append(
                    {
                        "country_code": country_code,
                        "indicator": indicator,
                        "year": year,
                        "value": value,
                        "is_projection": year >= projection_cutoff,
                        "vintage": vintage,
                        "source": "imf_datamapper",
                    }
                )
    return rows


def _coerce_numeric(raw: Any) -> float | None:
    """Return a float or None. IMF sometimes ships strings / nulls."""
    if raw is None:
        return None
    try:
        return float(raw)
    except (TypeError, ValueError):
        return None


__all__ = ["parse_imf_weo"]
