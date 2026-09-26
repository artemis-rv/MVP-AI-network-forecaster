"""
NEXTRACE AI — Alerts API Router (Phase 10)
"""
from __future__ import annotations

from typing import Annotated, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field, StringConstraints, field_validator

from backend.alerts.models import SEVERITIES, STATUSES, CATEGORIES

from backend.alerts.store import (
    list_alerts,
    get_alert,
    get_stats,
    create_alert,
    find_by_dedupe_key,
    update_alert,
    acknowledge_alert,
    resolve_alert,
)

router = APIRouter(prefix="/alerts", tags=["Alerts"])

# ── Request Models ─────────────────────────────────────────────────────────────
# Every field is bounded: the alert store is in memory and alerts are rendered in every open tab,
# so oversized or malformed input is rejected here rather than stored and broadcast.

ShortText = Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)]
LongText  = Annotated[str, StringConstraints(strip_whitespace=True, max_length=2000)]
Line      = Annotated[str, StringConstraints(strip_whitespace=True, max_length=500)]
HostRef   = Annotated[str, StringConstraints(strip_whitespace=True, max_length=64, pattern=r"^[0-9A-Za-z.:_-]+$")]
Stamp     = Annotated[str, StringConstraints(strip_whitespace=True, max_length=40, pattern=r"^[0-9T:.+\-Z ]+$")]
Tag       = Annotated[str, StringConstraints(strip_whitespace=True, max_length=64)]


class UpdateAlertRequest(BaseModel):
    status: Optional[str] = None
    assigned_to: Optional[ShortText] = None
    # Grouped-activity alerts grow as more packets join the activity
    event_count: Optional[int] = Field(None, ge=0, le=10_000_000)
    last_seen: Optional[Stamp] = None
    confidence: Optional[int] = Field(None, ge=0, le=100)
    affected_assets: Optional[List[Line]] = Field(None, max_length=50)

    @field_validator("status")
    @classmethod
    def _status(cls, v: Optional[str]) -> Optional[str]:
        if v is not None and v not in STATUSES:
            raise ValueError(f"status must be one of {sorted(STATUSES)}")
        return v


class CreateAlertRequest(BaseModel):
    title: ShortText = "Suspicious Network Anomaly"
    description: Optional[LongText] = "High-confidence anomalous telemetry flagged by AI detector."
    severity: str = "HIGH"
    status: str = "OPEN"
    category: str = "ANOMALY"
    source_ip: Optional[HostRef] = "192.168.1.105"
    destination_ip: Optional[HostRef] = "10.0.0.1"
    protocol: Optional[Annotated[str, StringConstraints(max_length=32)]] = "TCP"
    event_count: int = Field(15, ge=0, le=10_000_000)
    confidence: int = Field(88, ge=0, le=100)
    first_seen: Optional[Stamp] = None
    last_seen: Optional[Stamp] = None
    tags: Optional[List[Tag]] = Field(None, max_length=20)
    evidence: Optional[List[Line]] = Field(None, max_length=30)
    simulation: bool = False
    # SOC context produced by the grouping layer (src/lib/socPlaybook.ts)
    activity_id: Optional[Tag] = None
    affected_assets: Optional[List[Line]] = Field(None, max_length=50)
    recommended_actions: Optional[List[Line]] = Field(None, max_length=20)
    explanation: Optional[LongText] = None
    # Grouped-activity alerts: repeated submissions with the same key return the existing alert
    dedupe_key: Optional[Annotated[str, StringConstraints(max_length=200)]] = None

    @field_validator("severity")
    @classmethod
    def _severity(cls, v: str) -> str:
        if v not in SEVERITIES:
            raise ValueError(f"severity must be one of {sorted(SEVERITIES)}")
        return v

    @field_validator("status")
    @classmethod
    def _status(cls, v: str) -> str:
        if v not in STATUSES:
            raise ValueError(f"status must be one of {sorted(STATUSES)}")
        return v

    @field_validator("category")
    @classmethod
    def _category(cls, v: str) -> str:
        if v not in CATEGORIES:
            raise ValueError(f"category must be one of {sorted(CATEGORIES)}")
        return v

# ── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
async def get_alerts_endpoint(
    severity: Optional[str] = None,
    status: Optional[str] = None,
    category: Optional[str] = None,
    search: Optional[str] = None,
    source_ip: Optional[str] = None,
    assigned_to: Optional[str] = None,
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
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

    total_matching = len(alerts)
    # Pagination
    alerts = alerts[offset: offset + limit]

    return {"alerts": alerts, "total": total_matching}


@router.post("")
async def create_alert_endpoint(body: CreateAlertRequest):
    """Create a new alert (idempotent when a dedupe_key is supplied)."""
    if body.dedupe_key:
        existing = find_by_dedupe_key(body.dedupe_key)
        if existing:
            return existing
    alert = create_alert(body.model_dump(exclude_none=True))
    # Push to every connected live client so all open views show the same popup / notification
    from backend.services.live_session import live_session
    if live_session.running:
        live_session.broadcast_alert(alert)
    return alert


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


@router.post("/{alert_id}/reopen")
async def reopen_alert_endpoint(alert_id: str):
    """Reopen a resolved alert."""
    try:
        return update_alert(alert_id, {"status": "OPEN"})
    except KeyError:
        raise HTTPException(status_code=404, detail="Alert not found")
