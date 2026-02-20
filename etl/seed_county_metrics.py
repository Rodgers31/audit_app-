from __future__ import annotations

import asyncio

try:
    from .database_loader import DatabaseLoader  # type: ignore
except Exception:
    from etl.database_loader import DatabaseLoader  # type: ignore


async def main():
    loader = DatabaseLoader()
    # Ensure country exists
    country_id = await loader.ensure_country_exists("KEN")

    # Open a session and update county entities' meta with placeholder metrics
    db = loader.get_db_session()
    try:
        # Lazy import models from backend
        from models import Entity, EntityType  # type: ignore

        counties = db.query(Entity).filter(Entity.type == EntityType.COUNTY).all()
        updates = 0
        for e in counties:
            meta = (e.meta or {}).copy()
            metrics = meta.get("metrics", {}).copy()
            # Only set if missing to avoid clobbering real values later
            fy_key = "FY2024/25"
            if fy_key not in metrics:
                metrics[fy_key] = {
                    "population": 0,
                    "budget_2025": 0,
                    "financial_health_score": 0,
                    "audit_rating": "pending",
                    "source_note": "placeholder-seed",
                }
                meta["metrics"] = metrics
                e.meta = meta
                updates += 1
        if updates:
            db.commit()
        print(f"Updated metrics for {updates} counties (placeholders where missing)")
    finally:
        db.close()


if __name__ == "__main__":
    asyncio.run(main())
