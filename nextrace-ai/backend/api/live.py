"""NEXTRACE AI — Live Session REST API (per-user, keyed by X-Client-Id header)"""
from __future__ import annotations

from fastapi import APIRouter, Header, HTTPException

from backend.models.schemas import LiveStartRequest
from backend.services.session_manager import session_manager

router = APIRouter()

_VALID_MODES   = {"benign", "suspicious"}
_VALID_WINDOWS = {5, 10, 15, 30, 60}


def _require_client_id(client_id: str | None) -> str:
    """Validate and return the client_id from the X-Client-Id header."""
    if not client_id or len(client_id) > 128:
        raise HTTPException(
            status_code=400,
            detail="Missing or invalid X-Client-Id header. "
                   "Generate a UUID in the browser and send it with every request.",
        )
    return client_id


@router.get("/live/status")
async def live_status(x_client_id: str | None = Header(default=None)) -> dict:
    """Return the current live-session state for this client."""
    cid = _require_client_id(x_client_id)
    entry = await session_manager.get_or_create(cid)
    if entry is None:
        raise HTTPException(status_code=503, detail="Server at session capacity. Try again later.")
    return entry.session.get_status()


@router.post("/live/start")
async def live_start(body: LiveStartRequest, x_client_id: str | None = Header(default=None)) -> dict:
    """Start a live demo session for this client."""
    cid = _require_client_id(x_client_id)
    if body.mode not in _VALID_MODES:
        raise HTTPException(status_code=422, detail=f"Invalid mode '{body.mode}'. Use: {_VALID_MODES}")
    if body.window_seconds not in _VALID_WINDOWS:
        raise HTTPException(status_code=422, detail=f"Invalid window. Use: {sorted(_VALID_WINDOWS)}")

    entry = await session_manager.get_or_create(cid)
    if entry is None:
        raise HTTPException(status_code=503, detail="Server at session capacity. Try again later.")

    if entry.session.running:
        return {"message": "Session already running", "status": entry.session.get_status()}

    entry.session.start(mode=body.mode, window_seconds=body.window_seconds)
    return {"message": "Live demo session started", "status": entry.session.get_status()}


@router.post("/live/stop")
async def live_stop(x_client_id: str | None = Header(default=None)) -> dict:
    """Stop the current live demo session for this client."""
    cid = _require_client_id(x_client_id)
    entry = await session_manager.get(cid)
    if entry is None or not entry.session.running:
        return {"message": "No session is running"}

    entry.session.stop()
    return {"message": "Live demo session stopped", "status": entry.session.get_status()}


@router.post("/live/reset")
async def live_reset(x_client_id: str | None = Header(default=None)) -> dict:
    """Reset the live demo session for this client."""
    cid = _require_client_id(x_client_id)
    entry = await session_manager.get(cid)
    if entry:
        entry.session.stop()
    return {"message": "Live demo session reset"}


@router.get("/live/summary")
async def live_summary(x_client_id: str | None = Header(default=None)) -> dict:
    """Return aggregated traffic information for the current session."""
    cid = _require_client_id(x_client_id)
    entry = await session_manager.get_or_create(cid)
    if entry is None:
        raise HTTPException(status_code=503, detail="Server at session capacity. Try again later.")
    return entry.session.get_status()
