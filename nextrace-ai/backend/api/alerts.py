"""
NEXTRACE AI — Alerts API Router (Phase 10)
"""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from backend.alerts.store import (
    list_alerts,
    get_alert,
    get_stats,
    update_alert,
    acknowledge_alert,
    resolve_alert,
)

router = APIRouter(prefix="/alerts", tags=["Alerts"])

# ── Request Models ─────────────────────────────────────────────────────────────

class UpdateAlertRequest(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[str] = None

# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
async def get_alerts_endpoint(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    source_ip: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
):
    """List alerts with filtering."""
    alerts = list_alerts()

    # Filtering
    if severity:
        alerts = [a for a in alerts if a.get("severity") == severity]
    if status:
        alerts = [a for a in alerts if a.get("status") == status]
    if category:
        alerts = [a for a in alerts if a.get("category") == category]
    if source_ip:
        alerts = [a for a in alerts if a.get("source_ip") == source_ip]
    if assigned_to:
        alerts = [a for a in alerts if a.get("assigned_to") == assigned_to]
    if search:
        s = search.lower()
        alerts = [
            a for a in alerts
            if s in str(a.get("id", "")).lower()
            or s in str(a.get("title", "")).lower()
            or s in str(a.get("source_ip", "")).lower()
            or s in str(a.get("destination_ip", "")).lower()
            or s in str(a.get("category", "")).lower()
        ]

    # Pagination
    alerts = alerts[offset: offset + limit]

    return {"alerts": alerts, "total": len(alerts)}


@router.get("/stats")
async def get_alerts_stats_endpoint():
    """Alert statistics."""
    return get_stats()


@router.get("/{alert_id}")
async def get_alert_endpoint(alert_id: str):
    """Get alert details."""
    alert = get_alert(alert_id)
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.patch("/{alert_id}")
async def update_alert_endpoint(alert_id: str, body: UpdateAlertRequest):
    """Update status/assignment."""
    try:
        updates = body.model_dump(exclude_unset=True)
        return update_alert(alert_id, updates)
    except KeyError:
        raise HTTPException(status_code=404, detail="Alert not found")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{alert_id}/acknowledge")
async def acknowledge_alert_endpoint(alert_id: str):
    """Acknowledge alert."""
    try:
        return acknowledge_alert(alert_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Alert not found")


@router.post("/{alert_id}/resolve")
async def resolve_alert_endpoint(alert_id: str):
    """Resolve alert."""
    try:
        return resolve_alert(alert_id)
    except KeyError:
        raise HTTPException(status_code=404, detail="Alert not found")
