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
    now = _now_iso()
    alerts = [
        {
            "id": "ALT-0001",
            "title": "Potential Port Scan Detected",
            "description": "Sequential connection attempts across multiple ports observed from a single source.",
            "severity": "HIGH",
            "status": "OPEN",
            "category": "RECONNAISSANCE",
            "source_ip": "192.168.1.20",
            "destination_ip": "10.0.0.15",
            "protocol": "TCP",
            "event_count": 42,
            "confidence": 87,
            "first_seen": now,
            "last_seen": now,
            "created_at": now,
            "assigned_to": None,
            "acknowledged_at": None,
            "tags": ["recon", "scan", "tcp"],
            "evidence": ["Connection attempts to ports 22, 23, 80, 443, 8080", "High connection rate (>100/s)"],
            "simulation": False,
        },
        {
            "id": "ALT-0002",
            "title": "Repeated Authentication Failures",
            "description": "Multiple failed SSH login attempts detected in a short time window.",
            "severity": "HIGH",
            "status": "OPEN",
            "category": "BRUTE_FORCE",
            "source_ip": "10.0.0.50",
            "destination_ip": "10.0.0.5",
            "protocol": "TCP",
            "event_count": 150,
            "confidence": 92,
            "first_seen": now,
            "last_seen": now,
            "created_at": now,
            "assigned_to": None,
            "acknowledged_at": None,
            "tags": ["bruteforce", "ssh"],
            "evidence": ["150 failed attempts in 2 minutes", "Source IP is internal"],
            "simulation": False,
        },
        {
            "id": "ALT-0003",
            "title": "Large Outbound Transfer",
            "description": "Unusually large data transfer to an external IP address.",
            "severity": "CRITICAL",
            "status": "OPEN",
            "category": "EXFILTRATION",
            "source_ip": "10.0.0.100",
            "destination_ip": "203.0.113.42",
            "protocol": "TCP",
            "event_count": 5,
            "confidence": 95,
            "first_seen": now,
            "last_seen": now,
            "created_at": now,
            "assigned_to": "usr-002",
            "acknowledged_at": now,
            "tags": ["exfiltration", "data_transfer"],
            "evidence": ["Transfer size exceeds 5GB", "Destination IP is known bad actor"],
            "simulation": False,
        },
        {
            "id": "ALT-0004",
            "title": "ICMP Traffic Anomaly",
            "description": "High volume of ICMP Echo Requests (ping) detected.",
            "severity": "MEDIUM",
            "status": "IN_PROGRESS",
            "category": "ANOMALY",
            "source_ip": "192.168.1.10",
            "destination_ip": "10.0.0.1",
            "protocol": "ICMP",
            "event_count": 500,
            "confidence": 65,
            "first_seen": now,
            "last_seen": now,
            "created_at": now,
            "assigned_to": "usr-003",
            "acknowledged_at": now,
            "tags": ["icmp", "flood"],
            "evidence": ["500 packets/sec ICMP traffic"],
            "simulation": False,
        },
        {
            "id": "ALT-0005",
            "title": "Unusual Packet Rate",
            "description": "General increase in network traffic rate from source.",
            "severity": "LOW",
            "status": "RESOLVED",
            "category": "ANOMALY",
            "source_ip": "192.168.1.15",
            "destination_ip": "10.0.0.2",
            "protocol": "UDP",
            "event_count": 1200,
            "confidence": 40,
            "first_seen": now,
            "last_seen": now,
            "created_at": now,
            "assigned_to": None,
            "acknowledged_at": now,
            "tags": ["rate", "udp"],
            "evidence": ["Rate spike observed"],
            "simulation": False,
        }
    ]
    return {a["id"]: a for a in alerts}

_ALERTS: Dict[str, dict] = _create_demo_alerts()

# ── Store Methods ─────────────────────────────────────────────────────────────

def list_alerts() -> List[dict]:
    """Return all alerts sorted by created_at (newest first)."""
    # For demo, just sort by ID descending or created_at
    return sorted(list(_ALERTS.values()), key=lambda x: x["created_at"], reverse=True)

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

def update_alert(alert_id: str, updates: dict) -> dict:
    """Update specific fields of an alert."""
    if alert_id not in _ALERTS:
        raise KeyError(f"Alert {alert_id} not found")
    
    alert = _ALERTS[alert_id]
    
    if "status" in updates:
        if updates["status"] not in STATUSES:
            raise ValueError(f"Invalid status. Must be one of {STATUSES}")
        alert["status"] = updates["status"]
        
    if "assigned_to" in updates:
        alert["assigned_to"] = updates["assigned_to"]
        
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
