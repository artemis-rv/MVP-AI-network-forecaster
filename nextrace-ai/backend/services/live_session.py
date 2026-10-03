"""
NEXTRACE AI — Unified Live Session Service
==========================================
Manages real live packet capture and synthetic demo sessions with pluggable TrafficSource adapters.
Decouples capture from window aggregation, feature engineering, attack forecasting, and WebSocket streaming.
"""
from __future__ import annotations

import asyncio
import copy
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Optional

from backend.traffic.contract import CanonicalPacket, TrafficSource, TrafficSourceMetrics
from backend.traffic.synthetic_source import SyntheticSource
from backend.traffic.live_capture_source import LiveCaptureSource, get_network_interfaces
from backend.traffic.discovery import get_recommended_interface
from backend.features.engineering import compute_temporal_state
from backend.forecasting.engine import RuleBasedForecastEngine

logger = logging.getLogger(__name__)
Queue = asyncio.Queue

PARTIAL_TICK_SECONDS = 1.0
PROVISIONAL_FORECAST_AFTER = 3.0


class LiveSession:
    """Singleton live traffic session manager."""

    def __init__(self) -> None:
        self.session_id: str = "LIVE-001"
        self.running: bool = False
        self.source_type: str = "synthetic"  # "synthetic" | "live"
        self.interface: str = "5"
        self.interface_name: str = "Wi-Fi"
        self.bpf_filter: str = ""
        self.mode: str = "benign"
        self.window_seconds: int = 15
        self.start_time: Optional[datetime] = None

        # Rolling event buffer for current temporal window
        self._window_events: list[dict[str, Any]] = []
        self._window_start: Optional[datetime] = None

        # Lifetime counters
        self.packet_count: int = 0
        self.bytes_captured: int = 0
        self.benign_count: int = 0
        self.suspicious_count: int = 0
        self._entity_set: set[str] = set()

        # WebSocket queues
        self._client_queues: list[Queue] = []

        # Traffic source instance
        self._source: Optional[TrafficSource] = None

        # Forecasting engine
        self._forecast_engine: RuleBasedForecastEngine = RuleBasedForecastEngine()
        self._current_forecast: dict[str, Any] = self._default_forecast()

        # Background async tasks
        self._consumer_task: Optional[asyncio.Task] = None
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
                pass  # Drop slow clients without blocking capture

    # ─── Start / Stop ─────────────────────────────────────────

    def start(
        self,
        source_type: str = "synthetic",
        interface: str = "",
        bpf_filter: str = "",
        mode: str = "benign",
        window_seconds: int = 15,
    ) -> None:
        if self.running:
            self.stop()

        self.source_type = source_type if source_type in ("synthetic", "live") else "synthetic"
        
        # Discover and resolve active interface
        ifaces = get_network_interfaces()
        rec_id = get_recommended_interface(ifaces)
        
        if not interface or interface == "1":
            # Pick recommended active physical interface (e.g. Wi-Fi / Ethernet)
            target_iface = rec_id
        else:
            target_iface = str(interface)

        self.interface = target_iface
        found_iface = next((i for i in ifaces if str(i["index"]) == str(target_iface) or i["id"] == str(target_iface)), None)
        self.interface_name = found_iface["name"] if found_iface else str(target_iface)

        self.bpf_filter = bpf_filter
        self.mode = mode if mode in ("benign", "suspicious") else "benign"
        self.window_seconds = max(5, min(window_seconds, 60))
        
        # Unique session ID for isolation
        self.session_id = f"LIVE-{int(time.time() * 1000) % 1000000:06d}"
        
        self.running = True
        self.start_time = datetime.now(timezone.utc)
        self._window_start = self.start_time
        self._window_events = []
        self.packet_count = 0
        self.bytes_captured = 0
        self.benign_count = 0
        self.suspicious_count = 0
        self._entity_set = set()

        # Instantiate selected TrafficSource adapter
        if self.source_type == "live":
            self._source = LiveCaptureSource(
                interface=self.interface,
                bpf_filter=self.bpf_filter,
                job_id=self.session_id,
            )
        else:
            self._source = SyntheticSource(
                mode=self.mode,
                job_id=self.session_id,
            )

        self._source.start()

        # Launch consumer and window aggregation timer
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)

        self._consumer_task = loop.create_task(self._run_consumer())
        self._window_task = loop.create_task(self._run_window_timer())
        self._broadcast_status()

    def stop(self) -> None:
        self.running = False

        if self._source:
            try:
                self._source.stop()
            except Exception:
                pass
            self._source = None

        if self._consumer_task and not self._consumer_task.done():
            self._consumer_task.cancel()
        if self._window_task and not self._window_task.done():
            self._window_task.cancel()

        self._consumer_task = None
        self._window_task = None

        self._forecast_engine.reset()
        self._current_forecast = self._default_forecast()

        self._broadcast_status()
        self._broadcast({"type": "forecast_update", "data": self._current_forecast})

    # ─── Consumer Loop ─────────────────────────────────────────

    async def _run_consumer(self) -> None:
        """Continuously consume normalized CanonicalPackets from the active TrafficSource."""
        try:
            while self.running and self._source and self._source.is_running():
                pkt: Optional[CanonicalPacket] = await self._source.get_packet()
                if pkt is None:
                    await asyncio.sleep(0.01)
                    continue

                event_dict = pkt.to_event_dict()
                self._window_events.append(event_dict)
                self.packet_count += 1
                self.bytes_captured += pkt.packet_size

                if pkt.classification == "suspicious":
                    self.suspicious_count += 1
                else:
                    self.benign_count += 1

                if pkt.src_ip not in ("0.0.0.0", ""):
                    self._entity_set.add(pkt.src_ip)
                if pkt.dst_ip not in ("0.0.0.0", ""):
                    self._entity_set.add(pkt.dst_ip)

                self._broadcast({"type": "packet_event", "data": event_dict})

        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.error("Consumer loop exception: %s", exc)

    # ─── Temporal window timer ────────────────────────────────

    async def _run_window_timer(self) -> None:
        """Pushes partial temporal state every second and finalized window + forecast upon expiry."""
        provisional_sent = False
        try:
            while self.running:
                await asyncio.sleep(PARTIAL_TICK_SECONDS)
                if not self.running:
                    break

                now = datetime.now(timezone.utc)
                window_start = self._window_start or now
                elapsed = (now - window_start).total_seconds()

                if elapsed < self.window_seconds:
                    partial = compute_temporal_state(self._window_events[:], window_start, now, self.window_seconds)
                    partial["partial"] = True
                    partial["window_progress"] = round(min(1.0, elapsed / self.window_seconds), 3)
                    partial["source_type"] = self.source_type
                    self._broadcast({"type": "temporal_state", "data": partial})

                    if not provisional_sent and elapsed >= PROVISIONAL_FORECAST_AFTER and self._window_events:
                        provisional_sent = True
                        self._broadcast_provisional_forecast(partial)
                    continue

                self._close_window(window_start, now)
                provisional_sent = False

        except asyncio.CancelledError:
            pass

    def _close_window(self, window_start: datetime, window_end: datetime) -> None:
        events_snapshot = self._window_events[:]
        state = compute_temporal_state(events_snapshot, window_start, window_end, self.window_seconds)
        state["partial"] = False
        state["window_progress"] = 1.0
        state["source_type"] = self.source_type

        # Reset for next window
        self._window_events = []
        self._window_start = window_end

        self._broadcast({"type": "temporal_state", "data": state})

        try:
            forecast = self._forecast_engine.predict(state, self.mode, self._observed_target(events_snapshot))
            self._current_forecast = forecast
            self._broadcast({"type": "forecast_update", "data": forecast})
        except Exception as exc:
            logger.error("Forecasting engine predict error: %s", exc)

        self._broadcast_status()

    @staticmethod
    def _observed_target(events: list[dict]) -> Optional[str]:
        suspicious_dsts = [e["dst_ip"] for e in events if e.get("classification") == "suspicious"]
        return max(set(suspicious_dsts), key=suspicious_dsts.count) if suspicious_dsts else None

    def _broadcast_provisional_forecast(self, partial: dict) -> None:
        try:
            engine = copy.deepcopy(self._forecast_engine)
            forecast = engine.predict(partial, self.mode, self._observed_target(self._window_events[:]))
            forecast["provisional"] = True
            self._current_forecast = forecast
            self._broadcast({"type": "forecast_update", "data": forecast})
            self._broadcast_status()
        except Exception:
            pass

    def broadcast_alert(self, alert: dict) -> None:
        self._broadcast({"type": "new_alert", "data": alert})

    # ─── Status & Metrics ─────────────────────────────────────

    def _broadcast_status(self) -> None:
        self._broadcast({"type": "session_status", "data": self.get_status()})

    def get_status(self) -> dict[str, Any]:
        source_metrics = self._source.get_metrics().model_dump() if self._source else None
        health_status = "STOPPED"
        status_msg = "No session active"

        if self.running:
            if self._source:
                health_status = self._source.get_metrics().health_status
                status_msg = self._source.get_metrics().status_message
            else:
                health_status = "RUNNING"
                status_msg = f"Session active ({self.packet_count} packets)"

        return {
            "session_id": self.session_id,
            "running": self.running,
            "source_type": self.source_type,
            "interface": self.interface,
            "interface_name": self.interface_name,
            "mode": self.mode,
            "health_status": health_status,
            "status_message": status_msg,
            "start_time": self.start_time.isoformat().replace("+00:00", "") + "Z" if self.start_time else None,
            "packet_count": self.packet_count,
            "bytes_captured": self.bytes_captured,
            "benign_count": self.benign_count,
            "suspicious_count": self.suspicious_count,
            "window_seconds": self.window_seconds,
            "active_entities": list(self._entity_set),
            "metrics": source_metrics,
        }

    def get_metrics(self) -> dict[str, Any]:
        if self._source:
            return self._source.get_metrics().model_dump()
        return TrafficSourceMetrics(source_type=self.source_type, job_id=self.session_id).model_dump()

    # ─── Default / placeholder forecast ──────────────────────────
    @staticmethod
    def _default_forecast() -> dict:
        return {
            "current_stage": "No Active Session",
            "predicted_next_stage": "N/A",
            "confidence": 0.0,
            "time_window": "N/A",
            "target": "N/A",
            "supporting_features": ["Start a live session to generate forecasts."],
            "feature_contributions": [],
            "state_sequence": [],
            "is_benign": True,
            "demo_label": "Deterministic prediction engine",
            "stage_probabilities": [
                {"stage": "Reconnaissance", "probability": 0.0},
                {"stage": "Initial Access", "probability": 0.0},
                {"stage": "Lateral Movement", "probability": 0.0},
                {"stage": "Data Exfiltration", "probability": 0.0},
            ],
        }

    def get_current_forecast(self) -> dict:
        return self._current_forecast


# Module-level singleton
live_session = LiveSession()
