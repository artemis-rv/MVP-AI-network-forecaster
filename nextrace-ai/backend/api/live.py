"""
NEXTRACE AI — Live Session REST API
===================================
Endpoints for managing real live capture and synthetic demo sessions,
querying network capture interfaces, performing automated capture self-tests,
and inspecting live session health and performance metrics.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from backend.models.schemas import (
    LiveStartRequest,
    CaptureSelfTestRequest,
    CaptureSelfTestResponse,
)
from backend.services.live_session import live_session
from backend.traffic.discovery import (
    discover_network_interfaces,
    get_recommended_interface,
    get_environment_info,
)
from backend.traffic.dumpcap_capture import run_dumpcap_self_test

router = APIRouter()

_VALID_SOURCES = {"synthetic", "live"}
_VALID_MODES = {"benign", "suspicious"}
_VALID_WINDOWS = {5, 10, 15, 30, 60}


@router.get("/live/interfaces")
async def list_capture_interfaces() -> dict:
    """
    Discover and return all available network capture interfaces on host
    along with active link status and capture environment metadata.
    """
    env_info = get_environment_info()
    return {
        "interfaces": env_info["interfaces"],
        "count": env_info["interface_count"],
        "default_interface": env_info["recommended_interface"],
        "recommended": env_info["recommended_interface"],
        "npcap_available": env_info["npcap_available"],
        "dumpcap_available": env_info["dumpcap_available"],
        "dumpcap_path": env_info["dumpcap_path"],
        "os": env_info["os"],
    }


@router.post("/live/self-test", response_model=CaptureSelfTestResponse)
async def capture_self_test(body: CaptureSelfTestRequest) -> dict:
    """
    Execute an automated live capture self-test on the target interface.
    Captures raw packets to a temporary PCAPNG file for duration_seconds and reports stats.
    """
    duration = max(2, min(body.duration_seconds, 15))
    result = run_dumpcap_self_test(
        interface_id=body.interface_id,
        duration_seconds=duration,
        bpf_filter=body.bpf_filter,
    )
    return result


@router.get("/live/status")
async def live_status() -> dict:
    """Return the current live-session state and metrics."""
    return live_session.get_status()


@router.get("/live/metrics")
async def live_metrics() -> dict:
    """Return real-time performance, throughput, and capture drop metrics."""
    return live_session.get_metrics()


@router.post("/live/start")
async def live_start(body: LiveStartRequest) -> dict:
    """Start a new live capture or synthetic demo session."""
    source_type = body.source_type if body.source_type in _VALID_SOURCES else "synthetic"
    if body.mode not in _VALID_MODES:
        raise HTTPException(status_code=422, detail=f"Invalid mode '{body.mode}'. Use: {_VALID_MODES}")
    if body.window_seconds not in _VALID_WINDOWS:
        raise HTTPException(status_code=422, detail=f"Invalid window. Use: {sorted(_VALID_WINDOWS)}")

    if live_session.running:
        live_session.stop()

    # Determine target network interface for real live capture
    target_interface = body.interface
    if source_type == "live":
        ifaces = discover_network_interfaces()
        rec = get_recommended_interface(ifaces)
        if not target_interface or target_interface == "1":
            target_interface = rec

    live_session.start(
        source_type=source_type,
        interface=target_interface,
        bpf_filter=body.bpf_filter,
        mode=body.mode,
        window_seconds=body.window_seconds,
    )
    return {
        "message": f"Live {source_type} session started successfully",
        "status": live_session.get_status(),
    }


@router.post("/live/stop")
async def live_stop() -> dict:
    """Stop the current live session."""
    if not live_session.running:
        return {"message": "No session is running", "status": live_session.get_status()}

    live_session.stop()
    return {"message": "Live session stopped", "status": live_session.get_status()}


@router.post("/live/reset")
async def live_reset() -> dict:
    """Reset the live session and all accumulated statistics."""
    live_session.stop()
    return {"message": "Live session reset", "status": live_session.get_status()}


@router.get("/live/summary")
async def live_summary() -> dict:
    """Return current aggregated traffic information for the session."""
    return live_session.get_status()
