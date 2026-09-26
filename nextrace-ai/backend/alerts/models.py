"""NEXTRACE AI — Alert Models"""
from __future__ import annotations

from typing import Any, List, Optional
from pydantic import BaseModel, Field

# ── Allowed values ─────────────────────────────────────────────────────────────

SEVERITIES = {"LOW", "MEDIUM", "HIGH", "CRITICAL"}
STATUSES   = {"OPEN", "ACKNOWLEDGED", "IN_PROGRESS", "RESOLVED"}
CATEGORIES = {
    "RECONNAISSANCE",
    "BRUTE_FORCE",
    "LATERAL_MOVEMENT",
    "EXFILTRATION",
    "ANOMALY",
    "C2",
    "POLICY",
    "OTHER",
}

# ── Alert Model ─────────────────────────────────────────────────────────────

class Alert(BaseModel):
    id: str = Field(..., description="Unique alert identifier")
    title: str = Field(...)
    description: str = Field(...)
    severity: str = Field(..., description="LOW, MEDIUM, HIGH, CRITICAL")
    status: str = Field(..., description="OPEN, ACKNOWLEDGED, IN_PROGRESS, RESOLVED")
    category: str = Field(...)
    source_ip: Optional[str] = None
    destination_ip: Optional[str] = None
    protocol: Optional[str] = None
    event_count: int = Field(0)
    confidence: int = Field(0, description="0-100 percentage")
    first_seen: str = Field(...)
    last_seen: str = Field(...)
    created_at: str = Field(...)
    assigned_to: Optional[str] = None
    acknowledged_at: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    evidence: List[str] = Field(default_factory=list)
    simulation: bool = Field(False)
    activity_id: Optional[str] = None
    affected_assets: List[str] = Field(default_factory=list)
    recommended_actions: List[str] = Field(default_factory=list)
    explanation: Optional[str] = None

class AlertStats(BaseModel):
    total: int = 0
    open: int = 0
    acknowledged: int = 0
    in_progress: int = 0
    resolved: int = 0
    critical: int = 0
    high: int = 0
    medium: int = 0
    low: int = 0
