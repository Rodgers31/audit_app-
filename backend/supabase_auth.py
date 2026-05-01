"""
Supabase JWT authentication for FastAPI admin endpoints.

The legacy ``backend/auth.py`` is HS256 against a local SECRET_KEY and
is no longer in use — the frontend authenticates against Supabase
directly. This module verifies the JWTs Supabase issues so that
admin endpoints have real auth (not the env-gated no-op the existing
admin routers had via ``ADMIN_API_AUTH_REQUIRED``).

How it works
------------
Supabase signs access tokens with HS256 against the project's
``SUPABASE_JWT_SECRET`` (visible in the dashboard under Settings →
API). We verify the token, pull the user's ``sub`` claim (their UUID),
then query the ``profiles`` table for their ``roles`` array to
authorise. The frontend's ``AuthProvider`` reads roles from the same
column, so the two stay in sync.

Why we don't trust roles in the JWT itself
------------------------------------------
Supabase's default JWT only carries a ``role`` claim of
``"authenticated"`` (the Postgres role). App-level roles like
``"admin"`` live in our own ``profiles.roles`` column. We could
mirror them into ``app_metadata`` and read from the JWT, but that
adds a write path that has to stay synchronised with the DB. One
source of truth is simpler.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from typing import List, Optional

from database import get_db
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from sqlalchemy import text
from sqlalchemy.orm import Session

_security = HTTPBearer(auto_error=True)


def _supabase_jwt_secret() -> str:
    secret = os.getenv("SUPABASE_JWT_SECRET")
    if not secret:
        # Configuration error, surfaced as 500 — never want to silently
        # fall back to an unauthenticated path on admin endpoints.
        raise HTTPException(
            status_code=500,
            detail="SUPABASE_JWT_SECRET is not configured on the server",
        )
    return secret


@dataclass
class AdminUser:
    """Minimal representation of an authenticated admin caller."""

    id: str  # Supabase user UUID (the JWT ``sub``)
    email: Optional[str]
    roles: List[str]


def _decode_supabase_jwt(token: str) -> dict:
    """Verify the Supabase JWT and return its claims, or raise 401."""
    try:
        return jwt.decode(
            token,
            _supabase_jwt_secret(),
            algorithms=["HS256"],
            # Supabase issues tokens with ``aud=authenticated``; verifying
            # the audience guards against a token from a different
            # Supabase project being accepted.
            audience="authenticated",
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {e}",
            headers={"WWW-Authenticate": "Bearer"},
        )


def _fetch_roles(db: Session, user_id: str) -> tuple[Optional[str], List[str]]:
    """
    Look up the caller's email + roles array from ``profiles``.

    The profiles table lives in the public schema of the same Postgres
    database the FastAPI backend connects to (Supabase pooler). Using
    a raw SQL query rather than an SQLAlchemy model because we don't
    own the schema — Supabase migrations create it.
    """
    row = db.execute(
        text("SELECT email, roles FROM profiles WHERE id = :id"),
        {"id": user_id},
    ).fetchone()
    if row is None:
        return None, []
    email, roles = row
    return email, list(roles or [])


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_security),
    db: Session = Depends(get_db),
) -> AdminUser:
    """
    Resolve the calling user from the Bearer token. Raises 401 if the
    token is missing/invalid; raises 403 if the user has no profile
    row (which would be unusual but means we can't authorise them).
    """
    claims = _decode_supabase_jwt(credentials.credentials)
    user_id = claims.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has no subject",
        )

    email, roles = _fetch_roles(db, user_id)
    return AdminUser(id=user_id, email=email or claims.get("email"), roles=roles)


def require_admin(current_user: AdminUser = Depends(get_current_user)) -> AdminUser:
    """FastAPI dependency that 403s anyone without ``admin`` in roles."""
    if "admin" not in current_user.roles:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin role required",
        )
    return current_user
