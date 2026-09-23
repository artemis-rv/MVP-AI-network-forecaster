"""
NEXTRACE AI — Simulator Engine

Manages Fixed-K simulation state and step progression.
Operates entirely in-memory — no sockets, no real packets, no network calls.

SAFETY:
- generate_event() is never called from this module
- No Scapy, no socket, no subprocess
- All events are synthetic dataclass instances
- Targets are from fixed synthetic entity map only
"""
from __future__ import annotations

import time
import uuid
from typing import Any

from backend.simulator.models import (
    K_MIN, K_MAX, DEFAULT_K, DEFAULT_WINDOW_SECONDS, DEFAULT_SPEED,
    DEFAULT_SCENARIO, VALID_SPEEDS,
    SYNTHETIC_ENTITIES, ENTITY_LABELS, SIMULATION_DISCLAIMER,
    SimEvent, ForecastSnapshot, SimulatorState,
)
from backend.simulator.scenarios import (
    get_stage_sequence, get_stage_names, build_forecast_snapshot,
    SCENARIOS,
)


# ── In-memory simulator registry ──────────────────────────────────────────────
# Keyed by simulation_id. NEVER shared with live_session or historical _JOBS.
_SIMULATIONS: dict[str, SimulatorState] = {}


def get_simulation(simulation_id: str) -> SimulatorState | None:
    return _SIMULATIONS.get(simulation_id)


def list_simulations() -> list[dict[str, Any]]:
    return [_sim_summary(s) for s in _SIMULATIONS.values()]


def _sim_summary(state: SimulatorState) -> dict[str, Any]:
    return {
        "simulation_id": state.simulation_id,
        "scenario":      state.scenario,
        "k":             state.k,
        "status":        state.status,
        "current_step":  state.current_step,
        "total_steps":   state.total_steps,
    }


# ── Validation ─────────────────────────────────────────────────────────────────

def validate_config(
    scenario: str,
    k: int,
    window_seconds: int,
    speed: float,
) -> str | None:
    """Return error message string if invalid, None if OK."""
    if scenario not in SCENARIOS:
        valid = ", ".join(SCENARIOS.keys())
        return f"Unknown scenario '{scenario}'. Valid: {valid}"
    if not (K_MIN <= k <= K_MAX):
        return f"K must be between {K_MIN} and {K_MAX} (got {k})."
    if window_seconds not in {5, 10, 15, 30}:
        return "window_seconds must be one of: 5, 10, 15, 30."
    if speed not in VALID_SPEEDS:
        return f"speed must be one of: {sorted(VALID_SPEEDS)}."
    return None


# ── Engine operations ──────────────────────────────────────────────────────────

def start_simulation(
    scenario: str = DEFAULT_SCENARIO,
    k: int = DEFAULT_K,
    window_seconds: int = DEFAULT_WINDOW_SECONDS,
    speed: float = DEFAULT_SPEED,
) -> SimulatorState:
    """
    Create and start a new simulation.
    Returns the initial SimulatorState (step=-1, status=running).
    """
    simulation_id = f"SIM-{str(uuid.uuid4())[:8].upper()}"
    stage_names = get_stage_names(k)

    state = SimulatorState(
        simulation_id=simulation_id,
        scenario=scenario,
        k=k,
        window_seconds=window_seconds,
        speed=speed,
        status="running",
        current_step=-1,          # -1 = not yet advanced to step 0
        total_steps=k,
        stage_sequence=stage_names,
    )
    _SIMULATIONS[simulation_id] = state

    # Auto-advance to step 0 on start
    _advance(state)
    return state


def pause_simulation(simulation_id: str) -> SimulatorState:
    state = _get_or_raise(simulation_id)
    if state.status not in ("running",):
        raise ValueError(f"Cannot pause simulation in status '{state.status}'.")
    state.status = "paused"
    return state


def resume_simulation(simulation_id: str) -> SimulatorState:
    state = _get_or_raise(simulation_id)
    if state.status != "paused":
        raise ValueError(f"Cannot resume simulation in status '{state.status}'.")
    state.status = "running"
    return state


def stop_simulation(simulation_id: str) -> SimulatorState:
    state = _get_or_raise(simulation_id)
    if state.status in ("completed", "stopped"):
        raise ValueError(f"Simulation already in terminal status '{state.status}'.")
    state.status = "stopped"
    return state


def reset_simulation(simulation_id: str) -> SimulatorState:
    """Reset to step -1, re-creating the state in place."""
    state = _get_or_raise(simulation_id)
    stage_names = get_stage_names(state.k)

    # Re-initialise all mutable fields
    state.status = "running"
    state.current_step = -1
    state.stage_sequence = stage_names
    state.generated_events = []
    state.forecast_snapshots = []
    state.error = None

    # Auto-advance to step 0
    _advance(state)
    return state


def advance_step(simulation_id: str) -> SimulatorState:
    """Advance simulation by one step (manual 'Next Step' action)."""
    state = _get_or_raise(simulation_id)
    if state.status == "completed":
        raise ValueError("Simulation already completed — cannot advance further.")
    if state.status == "stopped":
        raise ValueError("Simulation is stopped. Reset to continue.")
    if state.status == "paused":
        # Allow manual advance while paused (pause doesn't block manual control)
        pass
    _advance(state)
    return state


def get_state(simulation_id: str) -> SimulatorState:
    return _get_or_raise(simulation_id)


def get_result(simulation_id: str) -> dict[str, Any]:
    state = _get_or_raise(simulation_id)
    profiles = get_stage_sequence(state.k)

    return {
        "simulation_id":   state.simulation_id,
        "scenario":        state.scenario,
        "scenario_label":  SCENARIOS.get(state.scenario, state.scenario),
        "k":               state.k,
        "status":          state.status,
        "current_step":    state.current_step,
        "total_steps":     state.total_steps,
        "stage_sequence":  state.stage_sequence,
        "generated_events":[e.to_dict() for e in state.generated_events],
        "forecast_snapshots": [f.to_dict() for f in state.forecast_snapshots],
        "stage_profiles":  [
            {
                "step":               i,
                "name":               p.name,
                "description":        p.description,
                "feature_narrative":  p.feature_narrative,
                "packet_count":       p.packet_count,
                "byte_count":         p.byte_count,
                "connection_count":   p.connection_count,
                "unique_dst_ports":   p.unique_dst_ports,
                "connection_rate":    p.connection_rate,
                "suspicious_ratio":   p.suspicious_ratio,
            }
            for i, p in enumerate(profiles)
        ],
        "disclaimer": SIMULATION_DISCLAIMER,
    }


# ── Internal helpers ───────────────────────────────────────────────────────────

def _get_or_raise(simulation_id: str) -> SimulatorState:
    state = _SIMULATIONS.get(simulation_id)
    if state is None:
        raise KeyError(f"Simulation '{simulation_id}' not found.")
    return state


def _advance(state: SimulatorState) -> None:
    """Generate the next step's event and forecast snapshot."""
    next_step = state.current_step + 1

    if next_step >= state.total_steps:
        state.status = "completed"
        return

    profiles = get_stage_sequence(state.k)
    profile  = profiles[next_step]
    next_profile = profiles[next_step + 1] if next_step + 1 < len(profiles) else None

    # Simulated timestamp (not wall-clock — synthetic progression)
    sim_ts = state.sim_base_ts + next_step * state.window_seconds

    src_ip  = SYNTHETIC_ENTITIES.get(profile.src_entity, profile.src_entity)
    dst_ip  = SYNTHETIC_ENTITIES.get(profile.dst_entity, profile.dst_entity)
    src_lbl = ENTITY_LABELS.get(src_ip, src_ip)
    dst_lbl = ENTITY_LABELS.get(dst_ip, dst_ip)

    # Synthetic feature profile dict (mirrors temporal window schema)
    feature_profile = {
        "window_index":       next_step,
        "window_start":       sim_ts,
        "window_end":         sim_ts + state.window_seconds,
        "packet_count":       profile.packet_count,
        "byte_count":         profile.byte_count,
        "flow_count":         profile.connection_count,
        "unique_src_ips":     profile.unique_src_ips,
        "unique_dst_ips":     profile.unique_dst_ips,
        "unique_dst_ports":   profile.unique_dst_ports,
        "tcp_count":          profile.tcp_count,
        "udp_count":          profile.udp_count,
        "icmp_count":         profile.icmp_count,
        "mean_packet_size":   round(profile.byte_count / profile.packet_count, 1) if profile.packet_count else 0,
        "connection_rate":    profile.connection_rate,
        "suspicious_ratio":   profile.suspicious_ratio,
    }

    event = SimEvent(
        step=next_step,
        stage=profile.name,
        timestamp=sim_ts,
        source=src_ip,
        destination=dst_ip,
        source_label=src_lbl,
        destination_label=dst_lbl,
        protocol=profile.protocol,
        source_port=profile.src_port,
        destination_port=profile.dst_port,
        packet_count=profile.packet_count,
        byte_count=profile.byte_count,
        connection_count=profile.connection_count,
        synthetic_feature_profile=feature_profile,
    )
    state.generated_events.append(event)

    # Forecast snapshot
    snapshot = build_forecast_snapshot(
        step=next_step,
        profile=profile,
        next_profile=next_profile,
        sim_base_ts=state.sim_base_ts,
        window_seconds=state.window_seconds,
    )
    state.forecast_snapshots.append(snapshot)

    state.current_step = next_step

    # Mark completed when last step reached
    if state.current_step == state.total_steps - 1:
        state.status = "completed"
