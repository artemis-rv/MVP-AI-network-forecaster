"""
NEXTRACE AI — Live Session Service
Manages exactly one demo live session at a time.
Runs the packet generator as an asyncio background task,
accumulates events, computes temporal windows, and
broadcasts to registered WebSocket clients.

This session namespace is intentionally isolated from future
historical-PCAP processing (see SRS §6 — Data Isolation).
"""
from __future__ import annotations

import asyncio
import json
import uuid
import random
from datetime import datetime, timezone
from typing import Any, Optional

from backend.traffic.generator import generate_event
from backend.features.engineering import compute_temporal_state
from backend.forecasting.engine import RuleBasedForecastEngine

# ─── Type alias for WebSocket client queues ───────────────────
Queue = asyncio.Queue


class LiveSession:
    """Singleton live-demo session."""

    def __init__(self) -> None:
        self.session_id: str = "live_demo_001"
        self.running: bool = False
        self.mode: str = "benign"
        self.window_seconds: int = 15
        self.start_time: Optional[datetime] = None

        # Rolling event buffer (current window)
        self._window_events: list[dict] = []
        self._window_start: Optional[datetime] = None

        # Lifetime totals
        self.packet_count: int = 0
        self.benign_count: int = 0
        self.suspicious_count: int = 0

        # Active entities (IP addresses seen)
        self._entity_set: set[str] = set()

        # WebSocket broadcast queue (one per connected client)
        self._client_queues: list[Queue] = []

        # Forecasting
        self._forecast_engine: RuleBasedForecastEngine = RuleBasedForecastEngine()
        self._current_forecast: dict = self._default_forecast()

        # Background tasks
        self._gen_task: Optional[asyncio.Task] = None
        self._window_task: Optional[asyncio.Task] = None

    # ─── Client management ────────────────────────────────────

    def register_client(self) -> Queue:
        q: Queue = asyncio.Queue(maxsize=500)
        self._client_queues.append(q)
        return q

    def unregister_client(self, q: Queue) -> None:
        self._client_queues = [c for c in self._client_queues if c is not q]

    def _broadcast(self, msg: dict) -> None:
        data = json.dumps(msg)
        for q in self._client_queues:
            try:
                q.put_nowait(data)
            except asyncio.QueueFull:
                pass  # Drop if client is too slow — never block the generator

    # ─── Start / Stop ─────────────────────────────────────────

    def start(self, mode: str, window_seconds: int) -> None:
        if self.running:
            return
        self.mode = mode
        self.window_seconds = max(5, min(window_seconds, 60))
        self.running = True
        self.start_time = datetime.now(timezone.utc)
        self._window_start = self.start_time
        self._window_events = []
        self.packet_count = 0
        self.benign_count = 0
        self.suspicious_count = 0
        self._entity_set = set()

        # Kick off async generator + window timer
        loop = asyncio.get_event_loop()
        self._gen_task    = loop.create_task(self._run_generator())
        self._window_task = loop.create_task(self._run_window_timer())

    def stop(self) -> None:
        self.running = False
        if self._gen_task and not self._gen_task.done():
            self._gen_task.cancel()
        if self._window_task and not self._window_task.done():
            self._window_task.cancel()
        self._gen_task = None
        self._window_task = None
        # Reset forecasting state for next session
        self._forecast_engine.reset()
        self._current_forecast = self._default_forecast()
        # Broadcast final session status + reset forecast
        self._broadcast_status()
        self._broadcast({"type": "forecast_update", "data": self._current_forecast})

    # ─── Generator loop ───────────────────────────────────────

    async def _run_generator(self) -> None:
        """Produce one event every ~100–400 ms."""
        try:
            while self.running:
                # Variable rate: suspicious mode is noisier
                delay = random.uniform(0.08, 0.30) if self.mode == "suspicious" else random.uniform(0.15, 0.45)
                await asyncio.sleep(delay)

                event = generate_event(self.mode)

                # Accumulate in window
                self._window_events.append(event)
                self.packet_count += 1
                if event["classification"] == "suspicious":
                    self.suspicious_count += 1
                else:
                    self.benign_count += 1

                # Track entities
                self._entity_set.add(event["src_ip"])
                self._entity_set.add(event["dst_ip"])

                # Broadcast individual packet event
                self._broadcast({"type": "packet_event", "data": event})

        except asyncio.CancelledError:
            pass

    # ─── Temporal window timer ────────────────────────────────

    async def _run_window_timer(self) -> None:
        """Every window_seconds, aggregate events and broadcast temporal state."""
        try:
            while self.running:
                await asyncio.sleep(self.window_seconds)
                if not self.running:
                    break

                window_end = datetime.now(timezone.utc)
                events_snapshot = self._window_events[:]
                window_start = self._window_start or window_end

                # Feature engineering
                state = compute_temporal_state(
                    events_snapshot,
                    window_start,
                    window_end,
                    self.window_seconds,
                )
                # Reset for next window
                self._window_events = []
                self._window_start = window_end

                self._broadcast({"type": "temporal_state", "data": state})

                # Run forecast engine
                try:
                    forecast = self._forecast_engine.predict(state, self.mode)
                    self._current_forecast = forecast
                    self._broadcast({"type": "forecast_update", "data": forecast})
                except Exception:
                    pass  # Never let forecasting crash the generator loop

                # Also broadcast updated session status
                self._broadcast_status()

        except asyncio.CancelledError:
            pass

    # ─── Status helpers ───────────────────────────────────────

    def _broadcast_status(self) -> None:
        self._broadcast({"type": "session_status", "data": self.get_status()})

    def get_status(self) -> dict:
        return {
            "session_id":      self.session_id,
            "running":         self.running,
            "mode":            self.mode,
            "start_time":      self.start_time.isoformat() + "Z" if self.start_time else None,
            "packet_count":    self.packet_count,
            "benign_count":    self.benign_count,
            "suspicious_count": self.suspicious_count,
            "window_seconds":  self.window_seconds,
            "active_entities": list(self._entity_set),
        }


    # ─── Default / placeholder forecast ──────────────────────────
    @staticmethod
    def _default_forecast() -> dict:
        """Returned when no session is active or engine has not run yet."""
        return {
            "current_stage":        "No Active Session",
            "predicted_next_stage": "N/A",
            "confidence":           0.0,
            "time_window":          "N/A",
            "target":               "N/A",
            "supporting_features": ["Start a live demo session to generate forecasts."],
            "feature_contributions": [],
            "state_sequence":        [],
            "is_benign":             True,
            "demo_label":           "Deterministic demo prediction — not a trained ML model",
            "stage_probabilities": [
                {"stage": "Reconnaissance",   "probability": 0.0},
                {"stage": "Initial Access",   "probability": 0.0},
                {"stage": "Lateral Movement", "probability": 0.0},
                {"stage": "Data Exfiltration","probability": 0.0},
            ],
        }

    def get_current_forecast(self) -> dict:
        return self._current_forecast


# ─── Module-level singleton ───────────────────────────────────
live_session = LiveSession()
