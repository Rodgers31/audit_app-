"""Post-ingestion quick summary.

Runs a lightweight summary over the database via DatabaseLoader
and prints a compact JSON with key counts and the latest document info.
"""

from __future__ import annotations

import asyncio
import json

try:
    # When executed as a module (python -m etl.post_ingestion_check)
    from .database_loader import DatabaseLoader  # type: ignore
except Exception:
    # Fallback for direct script execution
    from etl.database_loader import DatabaseLoader  # type: ignore


async def main():
    loader = DatabaseLoader()
    summary = await loader.get_data_summary()
    print(json.dumps(summary, indent=2, default=str))


if __name__ == "__main__":
    asyncio.run(main())
