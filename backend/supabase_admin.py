"""
Thin client for the Supabase Auth Admin REST API.

We deliberately don't take a dependency on ``supabase-py`` for this —
the admin endpoints we need are a handful of simple REST calls and
the project doesn't otherwise use the SDK. ``httpx`` is already a
transitive dep of FastAPI, so this is zero-cost.

Auth model
----------
Every call sends two headers: ``apikey`` and
``Authorization: Bearer <key>``. Both must be the **service role key**
(not the anon key). Supabase will accept either header on its own in
some endpoints and both in others; sending both keeps things uniform.

The service role key bypasses RLS and can read/modify any user, so it
must NEVER be exposed to the browser. It is read from the environment
on first use and cached in a module-level variable.
"""

from __future__ import annotations

import os
from typing import Any, Optional

import httpx

_ENV_URL = "SUPABASE_URL"
_ENV_SERVICE_KEY = "SUPABASE_SERVICE_ROLE_KEY"


class SupabaseAdminError(RuntimeError):
    """Wraps non-2xx responses from the Supabase Auth Admin API."""

    def __init__(self, status_code: int, body: Any):
        super().__init__(f"Supabase admin API returned {status_code}: {body}")
        self.status_code = status_code
        self.body = body


def _config() -> tuple[str, str]:
    url = os.getenv(_ENV_URL)
    key = os.getenv(_ENV_SERVICE_KEY)
    if not url or not key:
        raise SupabaseAdminError(
            500,
            f"{_ENV_URL} and {_ENV_SERVICE_KEY} must both be set",
        )
    return url.rstrip("/"), key


def _headers() -> dict:
    _, key = _config()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }


def _admin_url(path: str) -> str:
    base, _ = _config()
    return f"{base}/auth/v1/admin{path}"


def _request(method: str, path: str, **kwargs) -> dict:
    """Make an authenticated request and unwrap the JSON or raise."""
    with httpx.Client(timeout=15.0) as client:
        resp = client.request(method, _admin_url(path), headers=_headers(), **kwargs)
        if resp.status_code >= 400:
            try:
                body = resp.json()
            except Exception:
                body = resp.text
            raise SupabaseAdminError(resp.status_code, body)
        if resp.status_code == 204 or not resp.content:
            return {}
        return resp.json()


# ── Public API ──────────────────────────────────────────────────────────


def list_users(*, page: int = 1, per_page: int = 50) -> dict:
    """List Supabase auth users. Returns the raw {users: [...], aud, ...} payload."""
    return _request("GET", "/users", params={"page": page, "per_page": per_page})


def get_user(user_id: str) -> dict:
    """Fetch a single user by Supabase UUID."""
    return _request("GET", f"/users/{user_id}")


def update_user(user_id: str, body: dict) -> dict:
    """
    Update a user. Body fields supported by Supabase include
    ``email``, ``password``, ``email_confirm``, ``ban_duration``,
    ``app_metadata``, ``user_metadata``. Pass only the fields you
    intend to change.
    """
    return _request("PUT", f"/users/{user_id}", json=body)


def delete_user(user_id: str) -> dict:
    """Permanently delete a user. The associated ``profiles`` row
    cascades via the FK + ON DELETE CASCADE that Supabase sets up
    by default in its starter migrations."""
    return _request("DELETE", f"/users/{user_id}")


def generate_recovery_link(email: str, redirect_to: Optional[str] = None) -> dict:
    """
    Generate a password-recovery link for ``email``. Useful for the
    "send the user a reset email on their behalf" admin action.

    Returns the raw response which includes ``action_link`` (the URL
    the user would click in the email) and ``email_otp`` etc. We
    return the whole thing so callers can decide what to do — but
    the typical UX is to let Supabase email it: pass
    ``redirect_to`` and Supabase fires the email automatically.
    """
    body: dict = {"type": "recovery", "email": email}
    if redirect_to:
        body["redirect_to"] = redirect_to
    return _request("POST", "/generate_link", json=body)
