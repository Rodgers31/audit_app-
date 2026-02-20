"""Top-level access to backend seeding utilities."""

from __future__ import annotations

import importlib
import sys
from pathlib import Path

_BACKEND_ROOT = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

_backend_module = importlib.import_module("backend.seeding")
for _submodule in (
    "config",
    "domains",
    "http_client",
    "logging",
    "rate_limiter",
    "registries",
    "storage",
    "types",
    "utils",
):
    sys.modules.setdefault(
        f"seeding.{_submodule}",
        importlib.import_module(f"backend.seeding.{_submodule}"),
    )

from backend.seeding import *  # noqa: F401,F403,E402

try:  # pragma: no cover - passthrough metadata
    __all__ = list(_backend_module.__all__)  # type: ignore[attr-defined]
except AttributeError:  # pragma: no cover - best effort
    __all__ = [name for name in globals() if not name.startswith("_")]
