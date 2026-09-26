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
import time
from datetime import datetime, timezone
from typing import Any, Optional
from collections import Counter

from backend.traffic.generator import generate_event
from backend.features.engineering import compute_temporal_state
from backend.forecasting.engine import RuleBasedForecastEngine
from backend.alerts.store import create_alert

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

        # Anti-flood & threshold tracking for live demo alerts
        self._last_alert_time: float = 0.0
        self._alerted_categories: set[str] = set()

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
        self._last_alert_time = 0.0
        self._alerted_categories = set()

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
        # Reset counters and entities for clean slate
        self.packet_count = 0
        self.benign_count = 0
        self.suspicious_count = 0
        self._entity_set = set()
        self._window_events = []
        self._last_alert_time = 0.0
        self._alerted_categories = set()
        # Reset forecasting state for next session
        self._forecast_engine.reset()
        self._current_forecast = self._default_forecast()
        # Broadcast final session status + reset forecast
        self._broadcast_status()
        self._broadcast({"type": "forecast_update", "data": self._current_forecast})

    # ─── Generator loop ───────────────────────────────────────

    async def _run_generator(self) -> None:
        """Produce events rapidly to simulate continuous network traffic (20-100 pkts/sec)."""
        try:
            while self.running:
                # Variable rate: continuous and high volume
                delay = random.uniform(0.01, 0.05) if self.mode == "suspicious" else random.uniform(0.02, 0.08)
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

                # Check and generate live alert when crossing threshold (anti-fatigue & anti-flood)
                self._check_and_generate_live_alert(state, events_snapshot)

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

    # ─── Threshold & Anti-Flood Alert Generation ──────────────

    def _check_and_generate_live_alert(self, state: dict, events: list[dict]) -> None:
        """
        Evaluate live traffic window against threat thresholds and generate
        a deduplicated, rate-limited alert to prevent alert fatigue and flood.
        """
        if not self.running or self.mode != "suspicious":
            return

        suspicious_events = [e for e in events if e.get("classification") == "suspicious"]
        if not suspicious_events:
            return

        suspicious_count = len(suspicious_events)
        suspicious_ratio = state.get("suspicious_ratio", 0.0)

        # ── Threshold check: must exceed minimum count and proportion ────────
        if suspicious_count < 15 or suspicious_ratio < 0.20:
            return

        # ── Cooldown check: prevent rapid flood / alert fatigue ──────────────
        now_ts = time.time()
        if self._last_alert_time > 0 and (now_ts - self._last_alert_time) < 30.0:
            return

        # Cap at 3 alerts per demo session to ensure zero alert fatigue
        if len(self._alerted_categories) >= 3:
            return

        # ── Pattern & Category identification ────────────────────────────────
        dst_ports = [e.get("dst_port") for e in suspicious_events]
        port_counts = Counter(dst_ports)
        unique_ports = len(set(dst_ports))

        # Determine best matching category based on traffic signatures
        candidate_category = "ANOMALY"
        if port_counts.get(22, 0) >= 5:
            candidate_category = "BRUTE_FORCE"
        elif any(port_counts.get(p, 0) >= 3 for p in (135, 445, 3389, 5985)):
            candidate_category = "LATERAL_MOVEMENT"
        elif unique_ports >= 5 or any(port_counts.get(p, 0) >= 3 for p in (4444, 8888, 31337, 1337)):
            candidate_category = "RECONNAISSANCE"
        elif any(port_counts.get(p, 0) >= 4 for p in (80, 443, 8443)):
            candidate_category = "EXFILTRATION"

        # If already alerted, choose an alternative unalerted category
        if candidate_category in self._alerted_categories:
            alternatives = []
            if port_counts.get(22, 0) > 0 and "BRUTE_FORCE" not in self._alerted_categories:
                alternatives.append("BRUTE_FORCE")
            if any(port_counts.get(p, 0) > 0 for p in (135, 445, 3389, 5985)) and "LATERAL_MOVEMENT" not in self._alerted_categories:
                alternatives.append("LATERAL_MOVEMENT")
            if unique_ports >= 3 and "RECONNAISSANCE" not in self._alerted_categories:
                alternatives.append("RECONNAISSANCE")
            if "EXFILTRATION" not in self._alerted_categories:
                alternatives.append("EXFILTRATION")
            if "ANOMALY" not in self._alerted_categories:
                alternatives.append("ANOMALY")

            if alternatives:
                candidate_category = alternatives[0]
            else:
                return  # All categories exhausted — no flood

        category = candidate_category
        self._alerted_categories.add(category)
        self._last_alert_time = now_ts

        # ── Entity & Metadata extraction ────────────────────────────────────
        src_counts = Counter(e["src_ip"] for e in suspicious_events)
        dst_counts = Counter(e["dst_ip"] for e in suspicious_events)
        source_ip = src_counts.most_common(1)[0][0] if src_counts else "10.0.0.5"
        dest_ip = dst_counts.most_common(1)[0][0] if dst_counts else "192.168.1.100"

        confidence = min(96, max(84, int(suspicious_ratio * 100) + random.randint(3, 8)))

        if category == "BRUTE_FORCE":
            title = "Automated SSH Credential Stuffing Surge"
            description = f"High-frequency authentication attempts from {source_ip} targeting SSH service on {dest_ip} crossed threshold."
            severity = "HIGH"
            evidence = [
                f"{suspicious_count} anomalous authentication packets within {self.window_seconds}s window",
                f"Target host {dest_ip}:22 responded with multiple TCP resets/failures",
                f"Anomaly confidence index: {confidence}%",
            ]
            tags = ["bruteforce", "ssh", "auth-failure", "live-detected"]

        elif category == "LATERAL_MOVEMENT":
            title = "Internal Lateral Movement via SMB / Remote RPC"
            description = f"Suspicious administrative RPC and SMB connection bursts from {source_ip} to internal asset {dest_ip}."
            severity = "CRITICAL"
            evidence = [
                f"Unusual SMB2/RPC activity ({suspicious_count} events) targeting internal assets",
                f"Destination asset {dest_ip} flagged as high-value target",
                "Behavior matches known credential-reuse pattern",
            ]
            tags = ["lateral-movement", "smb", "rpc", "live-detected"]

        elif category == "RECONNAISSANCE":
            title = "Network Port Sweep & Host Discovery Detected"
            description = f"Source {source_ip} initiating sequential SYN scans across {state.get('unique_dst_ports', 0)} ports on target subnets."
            severity = "HIGH"
            evidence = [
                f"Multi-port scan pattern detected across {state.get('unique_dst_ports', 0)} ports",
                f"Anomalous packet fan-out from source {source_ip}",
                f"Threshold breach: {suspicious_count} recon probes in {self.window_seconds}s",
            ]
            tags = ["recon", "port-scan", "syn-sweep", "live-detected"]

        elif category == "EXFILTRATION":
            title = "High-Volume Outbound Data Staging Spike"
            description = f"Unusual sustained outbound data flow observed from {source_ip} to external address {dest_ip}."
            severity = "CRITICAL"
            evidence = [
                f"Outbound transfer burst of {state.get('byte_count', 0):,} bytes",
                f"Ratio of suspicious payloads reached {int(suspicious_ratio * 100)}%",
                f"Target {dest_ip} is external endpoint",
            ]
            tags = ["exfiltration", "data-staging", "high-volume", "live-detected"]

        else:
            title = "High Velocity Anomalous Flow Pattern"
            description = f"Traffic pattern between {source_ip} and {dest_ip} breached baseline anomaly threshold."
            severity = "HIGH"
            evidence = [
                f"{suspicious_count} anomalous events ({int(suspicious_ratio * 100)}% of traffic)",
                f"Connection rate of {state.get('connection_rate', 0)} pkts/s exceeds baseline",
            ]
            tags = ["anomaly", "rate-burst", "live-detected"]

        try:
            alert_data = {
                "title": title,
                "description": description,
                "severity": severity,
                "status": "OPEN",
                "category": category,
                "source_ip": source_ip,
                "destination_ip": dest_ip,
                "protocol": "TCP",
                "event_count": suspicious_count,
                "confidence": confidence,
                "tags": tags,
                "evidence": evidence,
                "simulation": True,
            }
            new_alert = create_alert(alert_data)
            self._broadcast({"type": "new_alert", "data": new_alert})
        except Exception:
            pass

    # ─── Status helpers ───────────────────────────────────────

    def _broadcast_status(self) -> None:
        self._broadcast({"type": "session_status", "data": self.get_status()})

    def get_status(self) -> dict:
        return {
            "session_id":      self.session_id,
            "running":         self.running,
            "mode":            self.mode,
            "start_time":      self.start_time.isoformat().replace("+00:00", "") + "Z" if self.start_time else None,
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
