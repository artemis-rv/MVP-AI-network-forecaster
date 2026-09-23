"""
NEXTRACE AI — Pydantic Schemas / Data Models
All schemas shared across the backend.
"""
from __future__ import annotations
from typing import Optional
from pydantic import BaseModel


# ─── Packet Event ─────────────────────────────────────────────
class PacketEvent(BaseModel):
    """A single simulated demo packet/flow record."""
    timestamp: str
    protocol: str
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    packet_size: int
    direction: str
    classification: str  # "benign" | "suspicious"


# ─── Temporal State ───────────────────────────────────────────
class TemporalState(BaseModel):
    """Aggregated features for one temporal window."""
    window_start: str
    window_end: str
    window_seconds: int
    # Counts
    packet_count: int
    byte_count: int
    flow_count: int
    benign_count: int
    suspicious_count: int
    # IP diversity
    unique_src_ips: int
    unique_dst_ips: int
    unique_dst_ports: int
    # Protocol breakdown
    tcp_count: int
    udp_count: int
    icmp_count: int
    dns_count: int
    http_count: int
    # Derived features
    mean_packet_size: float
    connection_rate: float   # packets per second
    suspicious_ratio: float  # suspicious / total


# ─── Session Status ───────────────────────────────────────────
class SessionStatus(BaseModel):
    """Current live session state returned by the API."""
    session_id: str
    running: bool
    mode: str
    start_time: Optional[str] = None
    packet_count: int
    benign_count: int
    suspicious_count: int
    window_seconds: int
    active_entities: list[str]


# ─── Forecast schemas ─────────────────────────────────────────
class StageProbability(BaseModel):
    stage: str
    probability: float


class FeatureContribution(BaseModel):
    feature: str
    value: float
    weight: float


class StateSequenceEntry(BaseModel):
    timestamp: float
    stage: str
    window_end: object   # float (unix) or str ISO


class ForecastResult(BaseModel):
    """Output of the forecasting engine — returned by /api/forecast/current."""
    current_stage: str
    predicted_next_stage: str
    confidence: float                        # 0.0 – 1.0
    time_window: str
    target: str
    supporting_features: list[str]
    feature_contributions: list[FeatureContribution]
    state_sequence: list[StateSequenceEntry]
    is_benign: bool
    demo_label: str
    stage_probabilities: list[StageProbability]


# ─── API Request Bodies ───────────────────────────────────────
class LiveStartRequest(BaseModel):
    mode: str = "benign"
    window_seconds: int = 15


# ─── WebSocket Message Envelope ───────────────────────────────
class WSMessage(BaseModel):
    """Envelope for all WebSocket messages."""
    type: str                    # "packet_event" | "temporal_state" | "session_status" | "forecast_update"
    data: dict
