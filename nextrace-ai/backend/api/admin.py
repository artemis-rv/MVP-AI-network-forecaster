"""
NEXTRACE AI — Admin API Router (Phase 9)

Endpoints:
  GET   /api/admin/users
  POST  /api/admin/users
  PATCH /api/admin/users/{user_id}
  GET   /api/admin/health
  GET   /api/admin/data-sources

ISOLATION:
  - Reads live_session.running, _HIST_JOBS, _FORENSIC_JOBS,
    engine._SIMULATIONS, _REPORTS for STATUS/COUNTS only.
  - NEVER starts/stops live session, triggers analysis,
    advances simulation, or generates reports.
  - NEVER exposes raw PCAP content.
  - Admin user state is completely separate from all other state.

DEMO BOUNDARY:
  - No real authentication.
  - No passwords stored.
  - Clearly labelled prototype admin controls.
"""
from __future__ import annotations

import time
from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.admin.users import (
    list_users, add_user, update_user, get_stats,
    ALLOWED_ROLES, ALLOWED_STATUSES,
)

router = APIRouter(prefix="/admin", tags=["Admin"])

DEMO_DISCLAIMER = (
    "DEMO ADMIN PANEL — No real authentication or credential storage. "
    "All user data is in-memory prototype data."
)


# ── Request models ──────────────────────────────────────────────────────────

class AddUserRequest(BaseModel):
    name:     str = Field(..., min_length=2, max_length=80)
    username: str = Field(..., min_length=2, max_length=40)
    email:    str = Field(..., min_length=5, max_length=120)
    role:     str = Field("soc_analyst")


class UpdateUserRequest(BaseModel):
    name:   str | None = None
    email:  str | None = None
    role:   str | None = None
    status: str | None = None


# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("/users")
async def get_users() -> JSONResponse:
    """List all demo admin users."""
    return JSONResponse({
        "users":      list_users(),
        "stats":      get_stats(),
        "disclaimer": DEMO_DISCLAIMER,
    })


@router.post("/users")
async def create_user(body: AddUserRequest) -> JSONResponse:
    """Add a new demo user (DEMO ONLY — no real credentials)."""
    if body.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role '{body.role}'. Allowed: {sorted(ALLOWED_ROLES)}",
        )
    try:
        user = add_user(
            name=body.name,
            username=body.username,
            email=body.email,
            role=body.role,
        )
        return JSONResponse({
            "user":       user,
            "disclaimer": DEMO_DISCLAIMER,
        }, status_code=201)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.patch("/users/{user_id}")
async def patch_user(user_id: str, body: UpdateUserRequest) -> JSONResponse:
    """Update a demo user's name, role, email, or status."""
    if body.role is not None and body.role not in ALLOWED_ROLES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid role '{body.role}'. Allowed: {sorted(ALLOWED_ROLES)}",
        )
    if body.status is not None and body.status not in ALLOWED_STATUSES:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid status '{body.status}'. Allowed: {sorted(ALLOWED_STATUSES)}",
        )
    try:
        user = update_user(
            user_id,
            name=body.name,
            email=body.email,
            role=body.role,
            status=body.status,
        )
        return JSONResponse({
            "user":       user,
            "disclaimer": DEMO_DISCLAIMER,
        })
    except KeyError:
        raise HTTPException(status_code=404, detail=f"User '{user_id}' not found.")
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/health")
async def get_health() -> JSONResponse:
    """
    Aggregate service health across all NEXTRACE AI prototype modules.
    READ-ONLY — never mutates any module state.
    """
    # ── Frontend (always healthy if backend is responding) ────────────────────
    services: list[dict[str, Any]] = [
        {
            "service": "FastAPI Backend",
            "status":  "healthy",
            "note":    "Responding normally",
            "checked_at": time.time(),
        },
        {
            "service": "Frontend (Vite/React)",
            "status":  "healthy",
            "note":    "Served by Vite dev server",
            "checked_at": time.time(),
        },
    ]

    # ── Live monitoring ────────────────────────────────────────────────────────
    try:
        from backend.services.live_session import live_session
        live_status = "active" if live_session.running else "idle"
        live_note   = f"Session running since {live_session.start_time}" if live_session.running else "No active session"
        services.append({
            "service":    "Live Monitoring",
            "status":     "healthy",
            "sub_status": live_status,
            "note":       live_note,
            "checked_at": time.time(),
        })
    except Exception as exc:
        services.append({
            "service": "Live Monitoring",
            "status":  "error",
            "note":    str(exc),
            "checked_at": time.time(),
        })

    # ── Historical processing ──────────────────────────────────────────────────
    try:
        from backend.api.historical import _JOBS as _HIST_JOBS
        running_hist = sum(1 for j in _HIST_JOBS.values() if j.get("status") == "processing")
        services.append({
            "service":     "Historical PCAP Processing",
            "status":      "healthy",
            "sub_status":  "processing" if running_hist else "idle",
            "jobs_total":  len(_HIST_JOBS),
            "jobs_active": running_hist,
            "note":        f"{len(_HIST_JOBS)} job(s) total, {running_hist} active",
            "checked_at":  time.time(),
        })
    except Exception as exc:
        services.append({
            "service": "Historical PCAP Processing",
            "status":  "error",
            "note":    str(exc),
            "checked_at": time.time(),
        })

    # ── Forensic analysis ──────────────────────────────────────────────────────
    try:
        from backend.api.forensic import _FORENSIC_JOBS
        running_fa = sum(1 for j in _FORENSIC_JOBS.values() if j.get("status") == "processing")
        services.append({
            "service":     "Forensic Analysis",
            "status":      "healthy",
            "sub_status":  "processing" if running_fa else "idle",
            "jobs_total":  len(_FORENSIC_JOBS),
            "jobs_active": running_fa,
            "note":        f"{len(_FORENSIC_JOBS)} forensic job(s), {running_fa} active",
            "checked_at":  time.time(),
        })
    except Exception as exc:
        services.append({
            "service": "Forensic Analysis",
            "status":  "error",
            "note":    str(exc),
            "checked_at": time.time(),
        })

    # ── Forecasting ────────────────────────────────────────────────────────────
    try:
        from backend.forecasting.engine import RuleBasedForecastEngine
        services.append({
            "service":    "Forecasting Engine",
            "status":     "healthy",
            "sub_status": "idle",
            "note":       "Rule-based forecasting engine loaded",
            "checked_at": time.time(),
        })
    except Exception as exc:
        services.append({
            "service": "Forecasting Engine",
            "status":  "error",
            "note":    str(exc),
            "checked_at": time.time(),
        })

    # ── Simulator ─────────────────────────────────────────────────────────────
    try:
        from backend.simulator import engine as sim_engine
        sims = sim_engine.list_simulations()
        running_sims = sum(1 for s in sims if s.get("status") == "running")
        services.append({
            "service":      "Attack Simulator",
            "status":       "healthy",
            "sub_status":   "running" if running_sims else "idle",
            "sims_total":   len(sims),
            "sims_active":  running_sims,
            "note":         f"{len(sims)} simulation(s), {running_sims} running",
            "checked_at":   time.time(),
        })
    except Exception as exc:
        services.append({
            "service": "Attack Simulator",
            "status":  "error",
            "note":    str(exc),
            "checked_at": time.time(),
        })

    # ── Reporting ─────────────────────────────────────────────────────────────
    try:
        from backend.reports.report_builder import list_reports
        reports = list_reports()
        services.append({
            "service":       "Report Generation",
            "status":        "healthy",
            "sub_status":    "idle",
            "reports_total": len(reports),
            "note":          f"{len(reports)} generated report(s) in store",
            "checked_at":    time.time(),
        })
    except Exception as exc:
        services.append({
            "service": "Report Generation",
            "status":  "error",
            "note":    str(exc),
            "checked_at": time.time(),
        })

    # ── WebSocket ─────────────────────────────────────────────────────────────
    services.append({
        "service":    "WebSocket (Live Feed)",
        "status":     "healthy",
        "sub_status": "idle",
        "note":       "ws://localhost:8000/ws — available when live session is active",
        "checked_at": time.time(),
    })

    healthy_count = sum(1 for s in services if s.get("status") == "healthy")
    return JSONResponse({
        "services":      services,
        "healthy_count": healthy_count,
        "total_count":   len(services),
        "checked_at":    time.time(),
    })


@router.get("/data-sources")
async def get_data_sources() -> JSONResponse:
    """
    Return metadata about currently supported data sources.
    READ-ONLY — never mutates source state.
    """
    # Gather live status read-only
    live_running = False
    live_note    = "No active session"
    try:
        from backend.services.live_session import live_session
        live_running = live_session.running
        live_note    = "Session active" if live_running else "Session idle"
    except Exception:
        pass

    # Historical job count
    hist_count = 0
    try:
        from backend.api.historical import _JOBS as _HIST_JOBS
        hist_count = len(_HIST_JOBS)
    except Exception:
        pass

    # Simulation count
    sim_count = 0
    try:
        from backend.simulator import engine as sim_engine
        sim_count = len(sim_engine.list_simulations())
    except Exception:
        pass

    sources = [
        {
            "id":            "src-live",
            "name":          "Live Network Traffic (Scapy Demo)",
            "type":          "live_capture",
            "category":      "DEMO",
            "status":        "active" if live_running else "idle",
            "last_activity": live_note,
            "description":   "Synthetic demo traffic stream generated by Scapy-based generator. Not real network capture.",
            "is_real":       False,
            "is_demo":       True,
            "is_simulation": False,
            "protocols":     ["TCP", "UDP", "ICMP"],
            "note":          "DEMO DATA — synthetically generated packets, not real network traffic.",
        },
        {
            "id":            "src-historical",
            "name":          "Historical PCAP Upload",
            "type":          "pcap_upload",
            "category":      "REAL / DEMO",
            "status":        "available",
            "last_activity": f"{hist_count} job(s) processed" if hist_count else "No jobs yet",
            "description":   "Upload real or demo PCAP files for historical analysis. Real PCAPs produce real evidence.",
            "is_real":       True,
            "is_demo":       True,
            "is_simulation": False,
            "protocols":     ["Any captured protocol"],
            "note":          "Real PCAP = real evidence. Demo PCAP = synthetic evidence clearly labelled.",
        },
        {
            "id":            "src-demo-pcap",
            "name":          "Synthetic / Demo PCAP",
            "type":          "synthetic_pcap",
            "category":      "DEMO",
            "status":        "available",
            "last_activity": "Available on demand",
            "description":   "Built-in demo PCAP with synthetically generated network traffic for prototype demonstration.",
            "is_real":       False,
            "is_demo":       True,
            "is_simulation": False,
            "protocols":     ["TCP", "UDP", "ICMP"],
            "note":          "SIMULATED EVIDENCE — all data is synthetic. Does not represent a real incident.",
        },
        {
            "id":            "src-simulator",
            "name":          "Fixed-K Attack Progression Simulator",
            "type":          "simulation",
            "category":      "SIMULATION",
            "status":        "active" if sim_count > 0 else "idle",
            "last_activity": f"{sim_count} simulation(s) run" if sim_count else "No simulations yet",
            "description":   "Synthetic attack stage progression engine. All entities and events are in-memory only.",
            "is_real":       False,
            "is_demo":       False,
            "is_simulation": True,
            "protocols":     ["Synthetic TCP/UDP"],
            "note":          "SIMULATION ONLY — NO REAL NETWORK TRAFFIC. All data is synthetic.",
        },
    ]

    return JSONResponse({
        "sources":  sources,
        "total":    len(sources),
        "disclaimer": (
            "Data source metadata only. Admin panel does not expose raw PCAP content. "
            "Clearly distinguish DEMO/SIMULATION sources from real evidence."
        ),
    })
