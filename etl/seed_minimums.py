from __future__ import annotations

import asyncio

try:
    from .database_loader import DatabaseLoader  # type: ignore
except Exception:
    from etl.database_loader import DatabaseLoader  # type: ignore


async def main():
    loader = DatabaseLoader()
    await loader.load_sample_kenya_data()


if __name__ == "__main__":
    asyncio.run(main())
