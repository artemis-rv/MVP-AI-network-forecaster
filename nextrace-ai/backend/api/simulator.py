"""
NEXTRACE AI — Simulator API Router

SAFETY: This router exposes simulation controls only.
No endpoint accepts arbitrary target IPs and acts on them.
All simulation targets come from the fixed synthetic entity map.
No real packets are transmitted.

Endpoints:
  POST /api/simulator/start
  GET  /api/simulator/list
  POST /api/simulator/{id}/pause
  POST /api/simulator/{id}/resume
  POST /api/simulator/{id}/stop
  POST /api/simulator/{id}/reset
  POST /api/simulator/{id}/next
  GET  /api/simulator/{id}/status
  GET  /api/simulator/{id}/result
"""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from backend.simulator.models import (
    K_MIN, K_MAX, DEFAULT_K, DEFAULT_WINDOW_SECONDS, DEFAULT_SPEED,
    DEFAULT_SCENARIO, SIMULATION_DISCLAIMER,
)
from backend.simulator.scenarios import SCENARIOS
from backend.simulator import engine

router = APIRouter(prefix="/simulator", tags=["Attack Simulator"])


# ── Request models ─────────────────────────────────────────────────────────────

class StartRequest(BaseModel):
    scenario: str = DEFAULT_SCENARIO
    k: int = Field(DEFAULT_K, ge=K_MIN, le=K_MAX)
    window_seconds: int = Field(DEFAULT_WINDOW_SECONDS)
    speed: float = Field(DEFAULT_SPEED)


# ── Helper ─────────────────────────────────────────────────────────────────────

def _state_to_dict(state: Any) -> dict:
    """Convert SimulatorState to JSON-serialisable dict."""
    current_event = state.generated_events[-1].to_dict() if state.generated_events else None
    current_forecast = state.forecast_snapshots[-1].to_dict() if state.forecast_snapshots else None

    return {
        "simulation_id":      state.simulation_id,
        "scenario":           state.scenario,
        "scenario_label":     SCENARIOS.get(state.scenario, state.scenario),
        "k":                  state.k,
        "status":             state.status,
        "current_step":       state.current_step,
        "total_steps":        state.total_steps,
        "stage_sequence":     state.stage_sequence,
        "current_stage":      state.generated_events[-1].stage if state.generated_events else None,
        "current_event":      current_event,
        "current_forecast":   current_forecast,
        "completed_steps":    len(state.generated_events),
        "disclaimer":         SIMULATION_DISCLAIMER,
    }


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/start")
async def start_simulation(body: StartRequest) -> JSONResponse:
    """
    Start a new Fixed-K attack progression simulation.
    All events are synthetic — no real network activity.
    """
    err = engine.validate_config(
        body.scenario, body.k, body.window_seconds, body.speed,
    )
    if err:
        raise HTTPException(status_code=422, detail=err)

    state = engine.start_simulation(
        scenario=body.scenario,
        k=body.k,
        window_seconds=body.window_seconds,
        speed=body.speed,
    )
    return JSONResponse(_state_to_dict(state), status_code=201)


@router.get("/list")
async def list_simulations() -> JSONResponse:
    """List all simulation sessions (summaries only)."""
    return JSONResponse({"simulations": engine.list_simulations()})


@router.get("/scenarios")
async def get_scenarios() -> JSONResponse:
    """Return available scenarios."""
    return JSONResponse({
        "scenarios": [
            {"id": k, "description": v}
            for k, v in SCENARIOS.items()
        ],
        "k_range": {"min": K_MIN, "max": K_MAX},
        "valid_window_seconds": [5, 10, 15, 30],
        "valid_speeds": [0.5, 1.0, 2.0, 4.0],
    })


@router.get("/{simulation_id}/status")
async def get_status(simulation_id: str) -> JSONResponse:
    """Poll current simulation status."""
    try:
        state = engine.get_state(simulation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found.")
    return JSONResponse(_state_to_dict(state))


@router.post("/{simulation_id}/pause")
async def pause_simulation(simulation_id: str) -> JSONResponse:
    try:
        state = engine.pause_simulation(simulation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found.")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return JSONResponse(_state_to_dict(state))


@router.post("/{simulation_id}/resume")
async def resume_simulation(simulation_id: str) -> JSONResponse:
    try:
        state = engine.resume_simulation(simulation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found.")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return JSONResponse(_state_to_dict(state))


@router.post("/{simulation_id}/stop")
async def stop_simulation(simulation_id: str) -> JSONResponse:
    try:
        state = engine.stop_simulation(simulation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found.")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return JSONResponse(_state_to_dict(state))


@router.post("/{simulation_id}/reset")
async def reset_simulation(simulation_id: str) -> JSONResponse:
    try:
        state = engine.reset_simulation(simulation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found.")
    return JSONResponse(_state_to_dict(state))


@router.post("/{simulation_id}/next")
async def next_step(simulation_id: str) -> JSONResponse:
    """
    Manually advance one simulation step.
    Returns 409 if simulation is completed or stopped.
    """
    try:
        state = engine.advance_step(simulation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found.")
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return JSONResponse(_state_to_dict(state))


@router.get("/{simulation_id}/result")
async def get_result(simulation_id: str) -> JSONResponse:
    """Return complete simulation result including all events, features, and forecast snapshots."""
    try:
        result = engine.get_result(simulation_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Simulation '{simulation_id}' not found.")
    return JSONResponse(result)
