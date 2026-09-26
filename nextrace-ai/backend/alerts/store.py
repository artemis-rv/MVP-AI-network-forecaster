"""
NEXTRACE AI — Alert Store

In-memory alert store.
Pre-seeded with demo alerts so /alerts is useful even when no live session is running.
"""
from __future__ import annotations

import time
import uuid
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone

from backend.alerts.models import Alert, AlertStats, SEVERITIES, STATUSES, CATEGORIES

# ── Demo Data Initialization ─────────────────────────────────────────────

def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()

def _create_demo_alerts() -> Dict[str, dict]:
    return {}

_ALERTS: Dict[str, dict] = _create_demo_alerts()

# ── Store Methods ─────────────────────────────────────────────────────────────

def list_alerts() -> List[dict]:
    """Return all alerts sorted by created_at (newest first)."""
    return sorted(list(_ALERTS.values()), key=lambda x: (x.get("created_at") or "", x.get("id") or ""), reverse=True)

def get_alert(alert_id: str) -> Optional[dict]:
    return _ALERTS.get(alert_id)

def get_stats() -> dict:
    alerts = _ALERTS.values()
    stats = AlertStats()
    stats.total = len(alerts)
    for a in alerts:
        status = a.get("status")
        severity = a.get("severity")
        if status == "OPEN": stats.open += 1
        elif status == "ACKNOWLEDGED": stats.acknowledged += 1
        elif status == "IN_PROGRESS": stats.in_progress += 1
        elif status == "RESOLVED": stats.resolved += 1
        
        if severity == "CRITICAL": stats.critical += 1
        elif severity == "HIGH": stats.high += 1
        elif severity == "MEDIUM": stats.medium += 1
        elif severity == "LOW": stats.low += 1
    return stats.model_dump()

def find_by_dedupe_key(key: str) -> Optional[dict]:
    """Return the alert previously created for this dedupe key (grouped-activity alerts are idempotent)."""
    for alert in _ALERTS.values():
        if alert.get("dedupe_key") == key:
            return alert
    return None

def create_alert(data: dict) -> dict:
    """Create and insert a new alert."""
    now = _now_iso()
    new_id = data.get("id")
    if not new_id:
        counter = len(_ALERTS) + 1
        new_id = f"ALT-{counter:04d}"
        while new_id in _ALERTS:
            counter += 1
            new_id = f"ALT-{counter:04d}"

    alert = {
        "id": new_id,
        "title": data.get("title", "Suspicious Activity Detected"),
        "description": data.get("description", "Automated threat detection trigger."),
        "severity": data.get("severity", "HIGH"),
        "status": data.get("status", "OPEN"),
        "category": data.get("category", "ANOMALY"),
        "source_ip": data.get("source_ip", "10.0.0.120"),
        "destination_ip": data.get("destination_ip", "10.0.0.5"),
        "protocol": data.get("protocol", "TCP"),
        "event_count": data.get("event_count", 1),
        "confidence": data.get("confidence", 85),
        "first_seen": data.get("first_seen", now),
        "last_seen": data.get("last_seen", now),
        "created_at": data.get("created_at", now),
        "assigned_to": data.get("assigned_to"),
        "acknowledged_at": None,
        "tags": data.get("tags", ["automated", "live"]),
        "evidence": data.get("evidence", ["Triggered by security rules"]),
        "simulation": data.get("simulation", False),
    }
    if data.get("dedupe_key"):
        alert["dedupe_key"] = data["dedupe_key"]
    _ALERTS[new_id] = alert
    return alert

def update_alert(alert_id: str, updates: dict) -> dict:
    """Update specific fields of an alert."""
    if alert_id not in _ALERTS:
        raise KeyError(f"Alert {alert_id} not found")
    
    alert = _ALERTS[alert_id]
    
    if "status" in updates:
        if updates["status"] not in STATUSES:
            raise ValueError(f"Invalid status. Must be one of {STATUSES}")
        alert["status"] = updates["status"]
        if updates["status"] == "RESOLVED":
            pass
        elif updates["status"] == "OPEN":
            alert["acknowledged_at"] = None
        
    if "assigned_to" in updates:
        alert["assigned_to"] = updates["assigned_to"]

    # Grouped-activity alerts: further packets update the same incident instead of creating new alerts
    for key in ("event_count", "last_seen", "confidence"):
        if updates.get(key) is not None:
            alert[key] = updates[key]

    return alert

def acknowledge_alert(alert_id: str, user_id: Optional[str] = None) -> dict:
    if alert_id not in _ALERTS:
        raise KeyError(f"Alert {alert_id} not found")
    alert = _ALERTS[alert_id]
    if alert["status"] == "OPEN":
        alert["status"] = "ACKNOWLEDGED"
        alert["acknowledged_at"] = _now_iso()
    if user_id:
        alert["assigned_to"] = user_id
    return alert

def resolve_alert(alert_id: str) -> dict:
    if alert_id not in _ALERTS:
        raise KeyError(f"Alert {alert_id} not found")
    alert = _ALERTS[alert_id]
    alert["status"] = "RESOLVED"
    return alert
