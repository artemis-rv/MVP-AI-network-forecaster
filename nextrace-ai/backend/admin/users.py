"""
NEXTRACE AI — Admin User Store (Phase 9)

DEMO ONLY — lightweight in-memory user management.
No passwords. No credentials. No real authentication.
Pre-seeded with prototype SOC analyst accounts for demonstration.

Roles from project requirements:
  admin        — Full admin access
  soc_analyst  — SOC analyst (primary user role)
  readonly     — Read-only observer

This module is completely isolated from live, historical,
forensic, simulator, and report state.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

# ── Allowed roles (from project requirements only) ────────────────────────────
ALLOWED_ROLES = {"admin", "soc_analyst", "readonly"}
ALLOWED_STATUSES = {"active", "disabled"}

# ── Pre-seeded demo user store ─────────────────────────────────────────────────
# DEMO DATA — no passwords, no credentials stored.
_USERS: dict[str, dict[str, Any]] = {
    "usr-001": {
        "user_id":    "usr-001",
        "name":       "Admin User",
        "username":   "admin",
        "email":      "admin@nextrace.demo",
        "role":       "admin",
        "status":     "active",
        "created_at": 1_700_000_000.0,
        "updated_at": 1_700_000_000.0,
        "demo_note":  "Pre-seeded demo admin. No real credentials stored.",
    },
    "usr-002": {
        "user_id":    "usr-002",
        "name":       "Alice Chen",
        "username":   "alice.chen",
        "email":      "alice.chen@nextrace.demo",
        "role":       "soc_analyst",
        "status":     "active",
        "created_at": 1_700_001_000.0,
        "updated_at": 1_700_001_000.0,
        "demo_note":  "Pre-seeded demo SOC analyst.",
    },
    "usr-003": {
        "user_id":    "usr-003",
        "name":       "Bob Kumar",
        "username":   "bob.kumar",
        "email":      "bob.kumar@nextrace.demo",
        "role":       "soc_analyst",
        "status":     "active",
        "created_at": 1_700_002_000.0,
        "updated_at": 1_700_002_000.0,
        "demo_note":  "Pre-seeded demo SOC analyst.",
    },
    "usr-004": {
        "user_id":    "usr-004",
        "name":       "Carol Reyes",
        "username":   "carol.reyes",
        "email":      "carol.reyes@nextrace.demo",
        "role":       "readonly",
        "status":     "active",
        "created_at": 1_700_003_000.0,
        "updated_at": 1_700_003_000.0,
        "demo_note":  "Pre-seeded demo read-only user.",
    },
}


def list_users() -> list[dict[str, Any]]:
    """Return all users sorted by created_at."""
    return sorted(_USERS.values(), key=lambda u: u["created_at"])


def get_user(user_id: str) -> dict[str, Any] | None:
    return _USERS.get(user_id)


def add_user(
    name: str,
    username: str,
    email: str,
    role: str,
) -> dict[str, Any]:
    """
    Add a new demo user.
    DEMO ONLY — no password stored.
    """
    if role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role '{role}'. Allowed: {sorted(ALLOWED_ROLES)}")

    now = time.time()
    user_id = f"usr-{str(uuid.uuid4())[:6].upper()}"
    user = {
        "user_id":    user_id,
        "name":       name.strip(),
        "username":   username.strip().lower(),
        "email":      email.strip().lower(),
        "role":       role,
        "status":     "active",
        "created_at": now,
        "updated_at": now,
        "demo_note":  "Created via demo Admin panel. No real credentials stored.",
    }
    _USERS[user_id] = user
    return user


def update_user(
    user_id: str,
    *,
    name: str | None = None,
    role: str | None = None,
    status: str | None = None,
    email: str | None = None,
) -> dict[str, Any]:
    """
    Update an existing demo user's name, role, status, or email.
    DEMO ONLY.
    """
    user = _USERS.get(user_id)
    if not user:
        raise KeyError(f"User '{user_id}' not found.")

    if role is not None and role not in ALLOWED_ROLES:
        raise ValueError(f"Invalid role '{role}'. Allowed: {sorted(ALLOWED_ROLES)}")
    if status is not None and status not in ALLOWED_STATUSES:
        raise ValueError(f"Invalid status '{status}'. Allowed: {sorted(ALLOWED_STATUSES)}")

    if name is not None:
        user["name"] = name.strip()
    if role is not None:
        user["role"] = role
    if status is not None:
        user["status"] = status
    if email is not None:
        user["email"] = email.strip().lower()

    user["updated_at"] = time.time()
    return user


def get_stats() -> dict[str, int]:
    users = list(_USERS.values())
    return {
        "total":    len(users),
        "active":   sum(1 for u in users if u["status"] == "active"),
        "disabled": sum(1 for u in users if u["status"] == "disabled"),
        "admins":   sum(1 for u in users if u["role"] == "admin"),
        "analysts": sum(1 for u in users if u["role"] == "soc_analyst"),
        "readonly": sum(1 for u in users if u["role"] == "readonly"),
    }
