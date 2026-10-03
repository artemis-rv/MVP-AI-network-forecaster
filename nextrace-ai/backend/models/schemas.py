"""
NEXTRACE AI — Pydantic Schemas / Data Models
All schemas shared across the backend.
"""
from __future__ import annotations
from typing import Any, Optional
from pydantic import BaseModel, Field


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
    direction: str = "outbound"
    classification: str = "benign"  # "benign" | "suspicious"
    payload_info: str = ""
    source_type: str = "synthetic"
    job_id: str = "default"


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
    # Optional runtime metadata
    partial: bool = False
    window_progress: float = 1.0
    source_type: str = "synthetic"
    job_id: str = "default"
    suspicion_score: float = 0.0


# ─── Session Status ───────────────────────────────────────────
class SessionStatus(BaseModel):
    """Current live session state returned by the API."""
    session_id: str
    running: bool
    source_type: str = "synthetic"
    interface: str = "1"
    mode: str = "benign"
    health_status: str = "STOPPED"  # STARTING, RUNNING, NO_TRAFFIC, DEGRADED, FAILED, STOPPING, STOPPED
    status_message: str = ""
    start_time: Optional[str] = None
    packet_count: int = 0
    bytes_captured: int = 0
    benign_count: int = 0
    suspicious_count: int = 0
    window_seconds: int = 15
    active_entities: list[str] = Field(default_factory=list)
    metrics: Optional[dict[str, Any]] = None


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
    provisional: bool = False


# ─── API Request / Response Bodies ────────────────────────────
class LiveStartRequest(BaseModel):
    source_type: str = "synthetic"  # "synthetic" | "live"
    interface: str = "1"            # Interface index / GUID / name
    bpf_filter: str = ""           # BPF capture filter
    mode: str = "benign"           # "benign" | "suspicious" (for synthetic)
    window_seconds: int = 15


class CaptureSelfTestRequest(BaseModel):
    interface_id: str = "1"
    duration_seconds: int = 5
    bpf_filter: str = ""


class CaptureSelfTestResponse(BaseModel):
    healthy: bool
    interface_id: str
    interface_name: str
    packets: int
    bytes: int
    duration_seconds: float
    packets_per_second: float
    mbps: float
    capture_drops: int
    stderr: str = ""
    error: Optional[str] = None


# ─── WebSocket Message Envelope ───────────────────────────────
class WSMessage(BaseModel):
    """Envelope for all WebSocket messages."""
    type: str  # "packet_event" | "temporal_state" | "session_status" | "forecast_update" | "self_test_result"
    data: dict
