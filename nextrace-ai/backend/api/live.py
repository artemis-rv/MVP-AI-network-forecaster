"""NEXTRACE AI — Live Session REST API"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.models.schemas import LiveStartRequest
from backend.services.live_session import live_session

router = APIRouter()

_VALID_MODES   = {"benign", "suspicious"}
_VALID_WINDOWS = {5, 10, 15, 30, 60}


@router.get("/live/status")
async def live_status() -> dict:
    """Return the current live-session state."""
    return live_session.get_status()


@router.post("/live/start")
async def live_start(body: LiveStartRequest) -> dict:
    """Start a new live demo session."""
    if body.mode not in _VALID_MODES:
        raise HTTPException(status_code=422, detail=f"Invalid mode '{body.mode}'. Use: {_VALID_MODES}")
    if body.window_seconds not in _VALID_WINDOWS:
        raise HTTPException(status_code=422, detail=f"Invalid window. Use: {sorted(_VALID_WINDOWS)}")

    if live_session.running:
        return {"message": "Session already running", "status": live_session.get_status()}

    live_session.start(mode=body.mode, window_seconds=body.window_seconds)
    return {"message": "Live demo session started", "status": live_session.get_status()}


@router.post("/live/stop")
async def live_stop() -> dict:
    """Stop the current live demo session."""
    if not live_session.running:
        return {"message": "No session is running", "status": live_session.get_status()}

    live_session.stop()
    return {"message": "Live demo session stopped", "status": live_session.get_status()}


@router.post("/live/reset")
async def live_reset() -> dict:
    """Reset the live demo session and all accumulated statistics."""
    live_session.stop()
    return {"message": "Live demo session reset", "status": live_session.get_status()}


@router.get("/live/summary")
async def live_summary() -> dict:
    """Return current aggregated traffic information for the session."""
    return live_session.get_status()
