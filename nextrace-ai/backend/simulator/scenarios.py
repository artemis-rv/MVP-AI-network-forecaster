"""
NEXTRACE AI — Simulator Scenarios & Stage Profiles

Defines deterministic stage profiles and K-selection logic.

SAFETY: Pure in-memory synthetic data. No real network activity.
No randomness — all values are fixed and deterministic.
"""
from __future__ import annotations

from backend.simulator.models import (
    StageProfile, ForecastSnapshot, SYNTHETIC_ENTITIES, ENTITY_LABELS,
    SIMULATION_DISCLAIMER,
)

# ── All possible stage profiles (pool) ────────────────────────────────────────
# Ordered by typical attack progression. K-selection slices from this.

_WS  = SYNTHETIC_ENTITIES["workstation"]
_SRV = SYNTHETIC_ENTITIES["server"]
_DB  = SYNTHETIC_ENTITIES["database"]
_EXT = SYNTHETIC_ENTITIES["external"]

_ALL_STAGE_PROFILES: list[StageProfile] = [

    # Stage A — Reconnaissance
    StageProfile(
        name="Reconnaissance",
        description="Systematic probing of destination ports to discover services.",
        src_entity="external", dst_entity="server",
        protocol="TCP", src_port=49001, dst_port=80,
        packet_count=156, byte_count=18720, connection_count=32,
        unique_src_ips=1, unique_dst_ips=3, unique_dst_ports=32,
        tcp_count=144, udp_count=8, icmp_count=4,
        connection_rate=10.4, suspicious_ratio=0.31,
        feature_narrative=[
            "32 unique destination ports contacted from single source",
            "Elevated connection rate (10.4 pkt/s)",
            "ICMP probe packets observed",
            "Low byte volume consistent with probing (not data transfer)",
        ],
    ),

    # Stage B — Initial Access
    StageProfile(
        name="Initial Access",
        description="Repeated authentication attempts against discovered services.",
        src_entity="external", dst_entity="server",
        protocol="TCP", src_port=49002, dst_port=22,
        packet_count=89, byte_count=12460, connection_count=14,
        unique_src_ips=1, unique_dst_ips=1, unique_dst_ports=2,
        tcp_count=89, udp_count=0, icmp_count=0,
        connection_rate=5.9, suspicious_ratio=0.38,
        feature_narrative=[
            "14 repeated TCP connection attempts to port 22 (SSH)",
            "Narrow destination port diversity (focused targeting)",
            "Elevated suspicious ratio (0.38)",
            "No UDP/ICMP — pure TCP service targeting",
        ],
    ),

    # Stage C — Internal Discovery
    StageProfile(
        name="Internal Discovery",
        description="Post-access internal host and service enumeration.",
        src_entity="server", dst_entity="database",
        protocol="TCP", src_port=49010, dst_port=5432,
        packet_count=67, byte_count=9380, connection_count=8,
        unique_src_ips=1, unique_dst_ips=4, unique_dst_ports=8,
        tcp_count=55, udp_count=9, icmp_count=3,
        connection_rate=4.5, suspicious_ratio=0.22,
        feature_narrative=[
            "4 unique internal destination IPs contacted",
            "8 unique destination ports (internal service discovery)",
            "Mixed protocol activity (TCP/UDP/ICMP)",
            "Moderate connection rate",
        ],
    ),

    # Stage D — Lateral Movement
    StageProfile(
        name="Lateral Movement",
        description="Suspicious internal-to-internal communication between hosts.",
        src_entity="server", dst_entity="database",
        protocol="TCP", src_port=49020, dst_port=1433,
        packet_count=112, byte_count=78400, connection_count=11,
        unique_src_ips=2, unique_dst_ips=3, unique_dst_ports=4,
        tcp_count=112, udp_count=0, icmp_count=0,
        connection_rate=7.5, suspicious_ratio=0.29,
        feature_narrative=[
            "Elevated internal-to-internal byte volume (78.4 KB)",
            "2 source IPs communicating with 3 destinations",
            "Connection to database port 1433 (MSSQL)",
            "Sustained TCP sessions",
        ],
    ),

    # Stage E — Command & Control (used for K≥6)
    StageProfile(
        name="Command & Control",
        description="Periodic low-volume beaconing to external endpoint.",
        src_entity="server", dst_entity="external",
        protocol="TCP", src_port=49030, dst_port=443,
        packet_count=42, byte_count=5880, connection_count=6,
        unique_src_ips=1, unique_dst_ips=1, unique_dst_ports=1,
        tcp_count=42, udp_count=0, icmp_count=0,
        connection_rate=2.8, suspicious_ratio=0.15,
        feature_narrative=[
            "Periodic low-volume outbound connections to single external endpoint",
            "Narrow destination (port 443 only)",
            "Low connection rate consistent with beaconing interval",
            "Consistent TCP flow pattern",
        ],
    ),

    # Stage F — Data Exfiltration
    StageProfile(
        name="Data Exfiltration",
        description="Elevated outbound byte volume to external endpoint.",
        src_entity="database", dst_entity="external",
        protocol="TCP", src_port=49040, dst_port=443,
        packet_count=55, byte_count=520000, connection_count=4,
        unique_src_ips=1, unique_dst_ips=1, unique_dst_ports=1,
        tcp_count=55, udp_count=0, icmp_count=0,
        connection_rate=3.7, suspicious_ratio=0.42,
        feature_narrative=[
            "Elevated outbound byte count (520 KB in single flow)",
            "Low destination port diversity (single external endpoint)",
            "High suspicious ratio (0.42)",
            "Sustained TCP session to external host",
        ],
    ),

    # Stage G — Persistence (used for K=7)
    StageProfile(
        name="Persistence",
        description="Internal communication establishing persistent access mechanism.",
        src_entity="server", dst_entity="workstation",
        protocol="TCP", src_port=49050, dst_port=4444,
        packet_count=33, byte_count=4620, connection_count=3,
        unique_src_ips=1, unique_dst_ips=1, unique_dst_ports=1,
        tcp_count=33, udp_count=0, icmp_count=0,
        connection_rate=2.2, suspicious_ratio=0.55,
        feature_narrative=[
            "Unusual port (4444) communication between internal hosts",
            "High suspicious ratio (0.55)",
            "Low volume but sustained session",
            "Non-standard internal service port",
        ],
    ),

    # Stage H — Impact (used for K=8)
    StageProfile(
        name="Impact",
        description="Elevated activity across all observed entities.",
        src_entity="external", dst_entity="server",
        protocol="TCP", src_port=49060, dst_port=80,
        packet_count=240, byte_count=960000, connection_count=18,
        unique_src_ips=2, unique_dst_ips=4, unique_dst_ports=6,
        tcp_count=230, udp_count=8, icmp_count=2,
        connection_rate=16.0, suspicious_ratio=0.60,
        feature_narrative=[
            "Highest observed packet rate (16.0 pkt/s)",
            "Highest outbound byte volume (960 KB)",
            "Multiple source/destination entities involved",
            "Elevated suspicious ratio (0.60)",
        ],
    ),
]

# Ordered stage pool (index matters for K-selection)
_STAGE_POOL = _ALL_STAGE_PROFILES  # A=0, B=1, C=2, D=3, E=4, F=5, G=6, H=7


# ── K-stage selection ─────────────────────────────────────────────────────────

# Fixed deterministic mapping: K → indices into _STAGE_POOL
_K_STAGE_MAP: dict[int, list[int]] = {
    3: [0, 1, 3],       # Recon → Initial Access → Lateral Movement
    4: [0, 1, 2, 3],    # + Internal Discovery
    5: [0, 1, 2, 3, 5], # + Data Exfiltration
    6: [0, 1, 2, 3, 4, 5],  # + C2
    7: [0, 1, 2, 3, 4, 5, 6],  # + Persistence
    8: [0, 1, 2, 3, 4, 5, 6, 7],  # + Impact
}


def get_stage_sequence(k: int) -> list[StageProfile]:
    """Return the ordered list of StageProfile objects for a given K."""
    indices = _K_STAGE_MAP.get(k, _K_STAGE_MAP[5])
    return [_STAGE_POOL[i] for i in indices]


def get_stage_names(k: int) -> list[str]:
    """Return stage names only for a given K."""
    return [p.name for p in get_stage_sequence(k)]


# ── Per-step forecast snapshot builder ────────────────────────────────────────

# Deterministic confidence per step (increases as progression matures)
_STEP_CONFIDENCE = {
    0: 72,   # first step — moderate confidence
    1: 78,
    2: 81,
    3: 85,
    4: 88,
    5: 86,
    6: 84,
    7: 82,
}


def build_forecast_snapshot(
    step: int,
    profile: StageProfile,
    next_profile: StageProfile | None,
    sim_base_ts: float,
    window_seconds: int,
) -> ForecastSnapshot:
    """
    Build a deterministic forecast snapshot for a given step.
    Uses the current and next stage profiles to form prediction.
    """
    confidence = _STEP_CONFIDENCE.get(step, 75)
    predicted_next = next_profile.name if next_profile else "Simulation Complete"
    t_start = sim_base_ts + step * window_seconds
    t_end   = t_start + window_seconds

    return ForecastSnapshot(
        step=step,
        current_stage=profile.name,
        predicted_next_stage=predicted_next,
        confidence=confidence,
        supporting_features=profile.feature_narrative[:3],
        time_window=f"T+{step * window_seconds}s – T+{(step + 1) * window_seconds}s",
        target_entity=ENTITY_LABELS.get(
            SYNTHETIC_ENTITIES.get(profile.dst_entity, ""), profile.dst_entity
        ),
    )


# ── Scenario registry ─────────────────────────────────────────────────────────

SCENARIOS: dict[str, str] = {
    "controlled_attack_progression": (
        "Controlled Attack Progression — Demonstrates a deterministic K-stage attack "
        "progression from initial reconnaissance through data exfiltration. "
        "All observations are synthetically generated."
    ),
    "recon_to_exfiltration": (
        "Reconnaissance to Exfiltration — A focused scenario showing the path from "
        "initial network probing to outbound data transfer. "
        "All observations are synthetically generated."
    ),
}

# recon_to_exfiltration uses same stage pool, same K mapping
# (scenarios differ in narrative/description, not structure, for this prototype)
