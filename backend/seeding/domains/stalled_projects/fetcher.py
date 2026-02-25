"""Fetch stalled projects fixture data."""

from __future__ import annotations

import json
import logging
import pathlib
from typing import Any

logger = logging.getLogger(__name__)
_HERE = pathlib.Path(__file__).resolve().parent
_DEFAULT_PATH = _HERE.parents[1] / "real_data" / "stalled_projects.json"


def fetch(settings: Any | None = None) -> list[dict]:
    """Return raw project records from the fixture file."""
    path = _DEFAULT_PATH
    if settings:
        url = getattr(settings, "stalled_projects_url", None) or ""
        if url.startswith("file://"):
            path = pathlib.Path(url.removeprefix("file://"))
        elif url:
            path = pathlib.Path(url)
    if not path.exists():
        logger.warning("Stalled projects fixture not found at %s", path)
        return []
    data = json.loads(path.read_text())
    projects = data.get("projects", data) if isinstance(data, dict) else data
    logger.info("Fetched %d stalled project records", len(projects))
    return projects
    projects = data.get("projects", data) if isinstance(data, dict) else data
    logger.info("Fetched %d stalled project records", len(projects))
    return projects
