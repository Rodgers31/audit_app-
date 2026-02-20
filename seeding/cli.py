"""CLI shim that exposes backend.seeding.cli at the repository root."""

from __future__ import annotations

from backend.seeding.cli import build_parser, main, run_seed_command

from . import _BACKEND_ROOT  # noqa: F401  # ensure side effect of path injection

__all__ = ["build_parser", "main", "run_seed_command"]


if __name__ == "__main__":  # pragma: no cover - CLI entrypoint
    main()
