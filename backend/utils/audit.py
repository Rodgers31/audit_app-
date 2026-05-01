"""
Helper for writing rows to ``admin_audit_log``.

Why a helper, not a FastAPI dependency
--------------------------------------
A dependency would record the action at request *start*, before we
know whether the action succeeded. That produces noisy logs of
attempted-but-failed mutations and forces every endpoint to either
add a "rollback this audit row" path on failure or accept the
inaccuracy.

Calling ``record_admin_action`` explicitly *after* the action
succeeds keeps the log honest: every row in ``admin_audit_log``
represents a mutation that actually committed.

Failures are swallowed
----------------------
A failure to write the audit log must never roll back the
underlying admin action. The action already happened — failing the
request would be a worse outcome than a missing log row. We log the
exception to the application logger so a missing-audit incident is
still investigable.
"""

from __future__ import annotations

import logging
from typing import Any, Mapping, Optional

from models import AdminAuditLog
from sqlalchemy.orm import Session

from supabase_auth import AdminUser

logger = logging.getLogger(__name__)


def record_admin_action(
    db: Session,
    *,
    actor: AdminUser,
    action: str,
    target_type: Optional[str] = None,
    target_id: Optional[str] = None,
    payload: Optional[Mapping[str, Any]] = None,
) -> None:
    """
    Append a row to ``admin_audit_log``.

    Always commits within its own savepoint so a partial outer
    transaction can't lose the log row, and is best-effort: any
    exception is swallowed and logged rather than re-raised.
    """
    try:
        row = AdminAuditLog(
            actor_id=actor.id,
            actor_email=actor.email,
            action=action,
            target_type=target_type,
            target_id=target_id,
            payload=dict(payload) if payload else {},
        )
        db.add(row)
        db.commit()
    except Exception:
        logger.exception(
            "Failed to write admin_audit_log row",
            extra={
                "actor_id": actor.id,
                "action": action,
                "target_type": target_type,
                "target_id": target_id,
            },
        )
        # Do not re-raise; see module docstring.
        try:
            db.rollback()
        except Exception:
            pass
