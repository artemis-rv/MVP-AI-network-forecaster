"""
NEXTRACE AI — Per-User Session Manager
=======================================
Replaces the module-level `live_session` singleton with a thread-safe
registry that maps `client_id` → `LiveSession`.

Design decisions
----------------
* **Anonymous session tokens**: The browser generates a UUID once per tab
  and stores it in `sessionStorage`.  No authentication is required —
  this is a demo product.  The UUID gives each tab its own isolated stream.

* **Lazy creation**: A `LiveSession` is created on first contact
  (WebSocket upgrade or REST call) and destroyed automatically when the
  client disconnects and all tasks finish, or after `TTL_IDLE_SECONDS`
  of inactivity.

* **Async-safe**: A single `asyncio.Lock` guards `_sessions`.  All public
  methods are async to allow awaiting the lock without blocking the event
  loop.

* **Bounded**: At most `MAX_SESSIONS` may exist simultaneously; further
  connections receive HTTP 503.  This prevents unbounded memory growth.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Optional

from backend.services.live_session import LiveSession

log = logging.getLogger(__name__)

# ── Tunables ──────────────────────────────────────────────────────────────────
MAX_SESSIONS      = 50          # hard cap; tune to available RAM
TTL_IDLE_SECONDS  = 600         # 10 min: session reaped after last WebSocket disconnects
CLEANUP_INTERVAL  = 120         # how often the reaper wakes up (seconds)


class _SessionEntry:
    """Internal wrapper around a `LiveSession` with lifecycle metadata."""

    __slots__ = ("session", "last_active", "ws_refs")

    def __init__(self, client_id: str) -> None:
        self.session      = LiveSession(session_id=client_id)
        self.last_active  = time.monotonic()
        self.ws_refs: int = 0          # number of active WebSocket connections

    def touch(self) -> None:
        self.last_active = time.monotonic()


class SessionManager:
    """
    Central registry of all live per-user sessions.

    Usage (FastAPI):
        manager = SessionManager()
        # mounted as app.state.session_manager = manager

    WebSocket:
        entry = await manager.acquire(client_id)   # increments ws_refs
        ...
        await manager.release(client_id)            # decrements; may destroy

    REST:
        entry = await manager.get_or_create(client_id)
        entry.touch()
    """

    def __init__(self) -> None:
        self._sessions: dict[str, _SessionEntry] = {}
        self._lock     = asyncio.Lock()
        self._reaper_task: Optional[asyncio.Task] = None

    # ── Lifecycle ─────────────────────────────────────────────────────────────

    def start(self) -> None:
        """Start the background reaper.  Call once from FastAPI `startup`."""
        loop = asyncio.get_event_loop()
        self._reaper_task = loop.create_task(self._reaper(), name="session-reaper")
        log.info("SessionManager started (max=%d, ttl=%ds)", MAX_SESSIONS, TTL_IDLE_SECONDS)

    async def shutdown(self) -> None:
        """Stop all sessions and the reaper.  Call from FastAPI `shutdown`."""
        if self._reaper_task and not self._reaper_task.done():
            self._reaper_task.cancel()
        async with self._lock:
            for entry in list(self._sessions.values()):
                try:
                    entry.session.stop()
                except Exception:
                    pass
            self._sessions.clear()
        log.info("SessionManager shut down")

    # ── Public API ────────────────────────────────────────────────────────────

    async def get_or_create(self, client_id: str) -> Optional[_SessionEntry]:
        """
        Return the session entry for *client_id*, creating it if absent.
        Returns ``None`` when the server is at capacity (caller should 503).
        """
        if not client_id or len(client_id) > 128:
            return None

        async with self._lock:
            if client_id in self._sessions:
                entry = self._sessions[client_id]
                entry.touch()
                return entry

            if len(self._sessions) >= MAX_SESSIONS:
                log.warning("Session cap reached (%d); rejecting %s", MAX_SESSIONS, client_id)
                return None

            entry = _SessionEntry(client_id)
            self._sessions[client_id] = entry
            log.debug("Created session for %s (total=%d)", client_id, len(self._sessions))
            return entry

    async def acquire(self, client_id: str) -> Optional[_SessionEntry]:
        """Increment WebSocket ref-count for *client_id*.  Creates if needed."""
        entry = await self.get_or_create(client_id)
        if entry is None:
            return None
        async with self._lock:
            entry.ws_refs += 1
            entry.touch()
        return entry

    async def release(self, client_id: str) -> None:
        """Decrement WebSocket ref-count.  Session is idle-reaped later, not destroyed immediately."""
        async with self._lock:
            entry = self._sessions.get(client_id)
            if entry is None:
                return
            entry.ws_refs = max(0, entry.ws_refs - 1)
            entry.touch()   # last-activity reset -> gives the TTL window before reap

    async def get(self, client_id: str) -> Optional[_SessionEntry]:
        """Return an existing session entry or ``None`` (does NOT create)."""
        async with self._lock:
            return self._sessions.get(client_id)

    async def active_count(self) -> int:
        async with self._lock:
            return len(self._sessions)

    # ── Background reaper ─────────────────────────────────────────────────────

    async def _reaper(self) -> None:
        """Periodically evict sessions that have no WebSocket connections and have been idle."""
        try:
            while True:
                await asyncio.sleep(CLEANUP_INTERVAL)
                await self._evict_idle()
        except asyncio.CancelledError:
            pass

    async def _evict_idle(self) -> None:
        now = time.monotonic()
        async with self._lock:
            to_remove = [
                cid for cid, entry in self._sessions.items()
                if entry.ws_refs == 0 and (now - entry.last_active) >= TTL_IDLE_SECONDS
            ]
            for cid in to_remove:
                entry = self._sessions.pop(cid)
                try:
                    entry.session.stop()
                except Exception:
                    pass
                log.info("Reaped idle session %s", cid)


# ── Module-level singleton ────────────────────────────────────────────────────
# Imported by FastAPI startup and all routers.
session_manager = SessionManager()
