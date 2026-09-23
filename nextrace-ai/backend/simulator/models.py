"""
NEXTRACE AI — Simulator Data Models

SAFETY: All entities are synthetic. Reserved/documentation IPs only.
No real network targets. No real attack generation.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

# ── Simulator constants ───────────────────────────────────────────────────────
K_MIN = 3
K_MAX = 8
DEFAULT_K = 5
DEFAULT_WINDOW_SECONDS = 15
DEFAULT_SPEED = 1.0
DEFAULT_SCENARIO = "controlled_attack_progression"

VALID_SPEEDS = {0.5, 1.0, 2.0, 4.0}  # allowed speed multipliers

# ── Synthetic entity map ──────────────────────────────────────────────────────
# RFC 5737 TEST-NET-3 (198.51.100.0/24) + RFC 1918 private ranges.
# These are documentation/reserved ranges — not real targets.
SYNTHETIC_ENTITIES: dict[str, str] = {
    "workstation":  "10.10.1.10",   # Simulated internal workstation
    "server":       "10.10.2.20",   # Simulated internal server
    "database":     "10.10.3.30",   # Simulated internal database
    "external":     "198.51.100.20", # Simulated external endpoint (RFC 5737)
}

ENTITY_LABELS: dict[str, str] = {
    "10.10.1.10":    "Workstation",
    "10.10.2.20":    "Internal Server",
    "10.10.3.30":    "Database",
    "198.51.100.20": "Simulated External",
}

SIMULATION_DISCLAIMER = (
    "SIMULATION DATA — NOT REAL NETWORK TRAFFIC. "
    "All entities, events, and observations are synthetically generated in-memory. "
    "No packets were transmitted. No real hosts were contacted."
)


# ── Stage profile model ───────────────────────────────────────────────────────

@dataclass
class StageProfile:
    """
    Deterministic synthetic feature profile for one attack stage.
    No randomness — all values are fixed per stage.
    """
    name: str
    description: str
    # Entity flow direction
    src_entity: str          # key into SYNTHETIC_ENTITIES
    dst_entity: str          # key into SYNTHETIC_ENTITIES
    protocol: str
    src_port: int
    dst_port: int
    # Synthetic feature values
    packet_count: int
    byte_count: int
    connection_count: int
    unique_src_ips: int
    unique_dst_ips: int
    unique_dst_ports: int
    tcp_count: int
    udp_count: int
    icmp_count: int
    connection_rate: float
    suspicious_ratio: float
    # Narrative
    feature_narrative: list[str]


# ── Simulator event model ─────────────────────────────────────────────────────

@dataclass
class SimEvent:
    """One synthetic simulation event (one stage step)."""
    step: int
    stage: str
    timestamp: float          # simulated Unix timestamp (not wall-clock)
    source: str               # IP
    destination: str          # IP
    source_label: str
    destination_label: str
    protocol: str
    source_port: int
    destination_port: int
    packet_count: int
    byte_count: int
    connection_count: int
    synthetic_feature_profile: dict[str, Any]
    disclaimer: str = SIMULATION_DISCLAIMER

    def to_dict(self) -> dict[str, Any]:
        return {
            "step":                     self.step,
            "stage":                    self.stage,
            "timestamp":                self.timestamp,
            "source":                   self.source,
            "destination":              self.destination,
            "source_label":             self.source_label,
            "destination_label":        self.destination_label,
            "protocol":                 self.protocol,
            "source_port":              self.source_port,
            "destination_port":         self.destination_port,
            "packet_count":             self.packet_count,
            "byte_count":               self.byte_count,
            "connection_count":         self.connection_count,
            "synthetic_feature_profile":self.synthetic_feature_profile,
            "disclaimer":               self.disclaimer,
        }


# ── Forecast snapshot model ───────────────────────────────────────────────────

@dataclass
class ForecastSnapshot:
    """Simulator-isolated forecast for one simulation step."""
    step: int
    current_stage: str
    predicted_next_stage: str
    confidence: int           # deterministic 0-100
    supporting_features: list[str]
    time_window: str
    target_entity: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "step":                  self.step,
            "current_stage":         self.current_stage,
            "predicted_next_stage":  self.predicted_next_stage,
            "confidence":            self.confidence,
            "supporting_features":   self.supporting_features,
            "time_window":           self.time_window,
            "target_entity":         self.target_entity,
        }


# ── Simulator state ───────────────────────────────────────────────────────────

@dataclass
class SimulatorState:
    """Complete mutable state for one simulation run."""
    simulation_id: str
    scenario: str
    k: int
    window_seconds: int
    speed: float
    status: str               # idle|running|paused|completed|stopped
    current_step: int         # 0-indexed, -1 = not started
    total_steps: int          # == k
    stage_sequence: list[str]
    generated_events: list[SimEvent] = field(default_factory=list)
    forecast_snapshots: list[ForecastSnapshot] = field(default_factory=list)
    sim_base_ts: float = 1_700_000_000.0   # fixed simulated epoch start
    error: str | None = None
