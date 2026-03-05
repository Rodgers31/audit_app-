"""Alert notification service.

Calls the Supabase `notify_watchers()` PostgreSQL function to fan out
data-change alerts to every user watching the affected item.

Usage from any backend route or ETL job::

    from services.alert_service import notify_watchers

    # After new audit report is ingested for county 047
    notify_watchers(
        db=db,
        item_type="county",
        item_id="047",
        alert_type="new_audit",
        title="New audit report for Nairobi County",
        body="The OAG has published the FY 2024/25 audit report.",
    )
"""

from __future__ import annotations

import logging
from typing import Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


def notify_watchers(
    db: Session,
    *,
    item_type: str,
    item_id: str,
    alert_type: str,
    title: str,
    body: Optional[str] = None,
) -> int:
    """Fan out an alert to all users watching *item_type/item_id*.

    Delegates to the ``public.notify_watchers()`` Postgres function
    defined in the Supabase migration ``20260228_alert_generation.sql``.

    Returns the number of alerts created (i.e. watchers notified).
    """
    try:
        result = db.execute(
            text(
                "SELECT public.notify_watchers(:item_type, :item_id, :alert_type, :title, :body)"
            ),
            {
                "item_type": item_type,
                "item_id": item_id,
                "alert_type": alert_type,
                "title": title,
                "body": body or "",
            },
        )
        count = result.scalar() or 0
        db.commit()
        if count:
            logger.info(
                "Notified %d watchers for %s/%s (%s)",
                count,
                item_type,
                item_id,
                alert_type,
            )
        return count
    except Exception:
        db.rollback()
        logger.exception("Failed to notify watchers for %s/%s", item_type, item_id)
        return 0
