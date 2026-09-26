"""
NEXTRACE AI — Attack Forecasting Engine
========================================

Architecture:
    ForecastEngine (abstract)
        └── RuleBasedForecastEngine   ← current implementation
        └── LSTMForecastEngine        ← future replacement (same interface)

The frontend only interacts with the dict output of predict().
Swapping the engine requires no frontend changes.
"""
from __future__ import annotations

import random
import time
from abc import ABC, abstractmethod
from typing import Any

# ─── Attack stage definitions ─────────────────────────────────────────────────
STAGES = [
    "Reconnaissance",
    "Initial Access",
    "Lateral Movement",
    "Data Exfiltration",
]

STAGE_IDX = {s: i for i, s in enumerate(STAGES)}

# ─── Abstract base ────────────────────────────────────────────────────────────
class ForecastEngine(ABC):
    """
    All forecast engines must implement predict().

    Input : temporal_state dict  (matches TemporalState schema)
    Output: forecast dict        (matches ForecastResult schema)
    """

    @abstractmethod
    def predict(self, temporal_state: dict[str, Any], mode: str = "benign",
                observed_target: str | None = None) -> dict[str, Any]:
        """Return a ForecastResult dict for the given temporal state."""
        ...

    @abstractmethod
    def reset(self) -> None:
        """Reset internal state — called when a session ends."""
        ...


# ─── Rule-based engine ────────────────────────────────────────────────────────
class RuleBasedForecastEngine(ForecastEngine):
    """
    Deterministic heuristic forecasting engine for the NEXTRACE AI demo.

    Design principles:
    - Benign mode → stays at "Normal Activity" (no false positives)
    - Suspicious mode → progresses through stages across windows
    - Stage advances smoothly; does NOT jump immediately to Data Exfiltration
    - All outputs are clearly labelled as demo / simulated

    Thresholds are intentionally generous — this is a prototype demo.
    """

    # ── Thresholds ────────────────────────────────────────────────────────────
    # Recon signals
    _ICMP_RECON_MIN   = 2     # icmp packets in window
    _SUSP_RATIO_LOW   = 0.05  # low suspicious ratio

    # Initial Access signals
    _SUSP_RATIO_IA    = 0.15  # suspicious ratio threshold
    _DST_PORTS_IA     = 5     # unique destination ports

    # Lateral Movement signals
    _SUSP_RATIO_LM    = 0.25
    _UNIQUE_DST_LM    = 6     # multiple internal destinations

    # Data Exfiltration signals
    _SUSP_RATIO_EX    = 0.40
    _BYTE_HIGH        = 40_000  # high outbound bytes

    # How many consecutive windows at a stage before considering advancement
    _WINDOWS_TO_ADVANCE = 2

    def __init__(self) -> None:
        self._state_sequence: list[dict[str, Any]] = []   # rolling last-10
        self._window_counts: dict[str, int] = {}          # stage → consecutive windows
        self._current_stage_idx: int = -1                 # -1 = benign/normal
        self._locked_target: str | None = None

    def reset(self) -> None:
        self._state_sequence = []
        self._window_counts = {}
        self._current_stage_idx = -1
        self._locked_target = None

    def predict(self, temporal_state: dict[str, Any], mode: str = "benign",
                observed_target: str | None = None) -> dict[str, Any]:
        """Return a ForecastResult dict.

        observed_target: the host most targeted by suspicious traffic in this window, so the
        forecast names a host that was actually observed rather than an arbitrary address.
        """
        ts = time.time()

        # ── Benign mode → Normal Activity ─────────────────────────
        if mode == "benign":
            entry = {
                "timestamp": ts,
                "stage": "Normal Activity",
                "window_end": temporal_state.get("window_end", ts),
            }
            self._state_sequence = (self._state_sequence + [entry])[-10:]
            return self._benign_result(temporal_state)

        # ── Suspicious mode → heuristic classification ─────────────
        classified_stage = self._classify(temporal_state)

        # Only advance if we've seen the stage enough times
        if classified_stage not in self._window_counts:
            self._window_counts[classified_stage] = 0
        self._window_counts[classified_stage] += 1

        # Cap advancement: don't skip stages
        classified_idx = STAGE_IDX.get(classified_stage, 0)

        if classified_idx <= self._current_stage_idx + 1:
            # Allow natural progression or staying at current
            consecutive = self._window_counts.get(classified_stage, 0)
            if classified_idx == self._current_stage_idx + 1 and consecutive >= self._WINDOWS_TO_ADVANCE:
                self._current_stage_idx = classified_idx
            elif self._current_stage_idx == -1:
                self._current_stage_idx = 0   # start at Recon

        effective_idx = max(0, self._current_stage_idx)
        current_stage = STAGES[effective_idx]

        # Predicted next: one ahead, capped at last stage
        next_idx = min(effective_idx + 1, len(STAGES) - 1)
        predicted_next = STAGES[next_idx]

        # Lock target on the first observed suspicious destination
        if self._locked_target is None and observed_target:
            self._locked_target = observed_target

        # Build state sequence entry
        entry = {
            "timestamp": ts,
            "stage": current_stage,
            "window_end": temporal_state.get("window_end", ts),
        }
        self._state_sequence = (self._state_sequence + [entry])[-10:]

        # Confidence based on stage signals
        confidence = self._compute_confidence(temporal_state, effective_idx)

        # Supporting features
        features, contributions = self._explain(temporal_state, effective_idx)

        return {
            "current_stage":      current_stage,
            "predicted_next_stage": predicted_next,
            "confidence":         confidence,
            "time_window":        self._time_window(effective_idx),
            "target":             self._locked_target or "None detected",
            "supporting_features": features,
            "feature_contributions": contributions,
            "state_sequence":     self._state_sequence[-10:],
            "is_benign":          False,
            "demo_label":         "Deterministic demo prediction — not a trained ML model",
            "stage_probabilities": self._stage_probabilities(temporal_state),
        }

    # ── Classification ────────────────────────────────────────────────────────
    def _classify(self, t: dict) -> str:
        susp_ratio   = t.get("suspicious_ratio", 0.0)
        byte_count   = t.get("byte_count", 0)
        unique_dst   = t.get("unique_dst_ips", 0)
        dst_ports    = t.get("unique_dst_ports", 0)
        icmp_count   = t.get("icmp_count", 0)

        if susp_ratio >= self._SUSP_RATIO_EX and byte_count >= self._BYTE_HIGH:
            return "Data Exfiltration"
        if susp_ratio >= self._SUSP_RATIO_LM and unique_dst >= self._UNIQUE_DST_LM:
            return "Lateral Movement"
        if susp_ratio >= self._SUSP_RATIO_IA or dst_ports >= self._DST_PORTS_IA:
            return "Initial Access"
        if icmp_count >= self._ICMP_RECON_MIN or susp_ratio >= self._SUSP_RATIO_LOW:
            return "Reconnaissance"
        return "Reconnaissance"   # default start

    def _compute_confidence(self, t: dict, stage_idx: int) -> float:
        susp_ratio = t.get("suspicious_ratio", 0.0)
        # Base: proportion of suspicious ratio scaled to stage
        base = 0.35 + susp_ratio * 0.9
        # Clamp and add small random jitter for realism
        jitter = random.uniform(-0.03, 0.03)
        return round(min(0.97, max(0.30, base + jitter + stage_idx * 0.04)), 2)

    def _time_window(self, stage_idx: int) -> str:
        windows = ["60–120 seconds", "30–60 seconds", "15–30 seconds", "5–15 seconds"]
        return windows[min(stage_idx, len(windows) - 1)]

    def _explain(self, t: dict, stage_idx: int) -> tuple[list[str], list[dict]]:
        """Return (supporting_features, feature_contributions)."""
        susp_ratio  = t.get("suspicious_ratio", 0.0)
        conn_rate   = t.get("connection_rate", 0.0)
        unique_dst  = t.get("unique_dst_ips", 0)
        dst_ports   = t.get("unique_dst_ports", 0)
        icmp_count  = t.get("icmp_count", 0)
        byte_count  = t.get("byte_count", 0)

        features: list[str] = []
        contribs: list[dict] = []

        if susp_ratio > 0.05:
            features.append(f"Suspicious traffic ratio elevated ({susp_ratio:.1%})")
            contribs.append({"feature": "Suspicious Ratio", "value": round(susp_ratio * 100, 1), "weight": min(1.0, susp_ratio * 2.5)})

        if conn_rate > 2:
            features.append(f"High connection rate ({conn_rate:.1f} pkt/s)")
            contribs.append({"feature": "Connection Rate", "value": round(conn_rate, 1), "weight": min(1.0, conn_rate / 15)})

        if unique_dst > 3:
            features.append(f"Multiple destination hosts observed ({unique_dst})")
            contribs.append({"feature": "Unique Destinations", "value": unique_dst, "weight": min(1.0, unique_dst / 20)})

        if dst_ports > 4:
            features.append(f"Destination port diversity increased ({dst_ports} ports)")
            contribs.append({"feature": "Port Diversity", "value": dst_ports, "weight": min(1.0, dst_ports / 20)})

        if icmp_count > 1:
            features.append(f"ICMP probe packets detected ({icmp_count})")
            contribs.append({"feature": "ICMP Probes", "value": icmp_count, "weight": min(1.0, icmp_count / 10)})

        if byte_count > 20_000:
            features.append(f"Elevated outbound data volume ({byte_count // 1024} KB)")
            contribs.append({"feature": "Byte Volume", "value": byte_count, "weight": min(1.0, byte_count / 80_000)})

        if not features:
            features.append("Early-stage reconnaissance pattern observed")
            contribs.append({"feature": "Baseline Deviation", "value": 1, "weight": 0.2})

        return features, contribs

    def _stage_probabilities(self, t: dict) -> list[dict]:
        susp = t.get("suspicious_ratio", 0.0)
        conn = t.get("connection_rate", 0.0) / 15.0   # normalise
        dst  = t.get("unique_dst_ips", 0) / 20.0
        byte = t.get("byte_count", 0) / 80_000.0

        recon  = round(max(0.1, min(0.95, 0.2 + susp * 0.5)), 2)
        ia     = round(max(0.0, min(0.95, susp * 1.2 + conn * 0.3 - 0.1)), 2)
        lm     = round(max(0.0, min(0.95, susp * 1.5 + dst  * 0.5 - 0.25)), 2)
        ex     = round(max(0.0, min(0.95, susp * 1.8 + byte * 0.6 - 0.45)), 2)

        return [
            {"stage": "Reconnaissance",   "probability": recon},
            {"stage": "Initial Access",   "probability": ia},
            {"stage": "Lateral Movement", "probability": lm},
            {"stage": "Data Exfiltration","probability": ex},
        ]

    # ── Benign result ─────────────────────────────────────────────────────────
    def _benign_result(self, t: dict) -> dict:
        ts = time.time()
        return {
            "current_stage":        "Normal Activity",
            "predicted_next_stage": "Normal Activity",
            "confidence":           0.95,
            "time_window":          "N/A",
            "target":               "None detected",
            "supporting_features": [
                "Traffic patterns within normal baseline",
                "Suspicious ratio below detection threshold",
                "No unusual port scanning detected",
                "No lateral movement indicators",
            ],
            "feature_contributions": [
                {"feature": "Baseline Adherence", "value": 95, "weight": 0.95},
                {"feature": "Suspicious Ratio",   "value": round(t.get("suspicious_ratio", 0) * 100, 1), "weight": t.get("suspicious_ratio", 0)},
            ],
            "state_sequence": self._state_sequence[-10:],
            "is_benign":      True,
            "demo_label":     "Deterministic demo prediction — not a trained ML model",
            "stage_probabilities": [
                {"stage": "Reconnaissance",   "probability": 0.08},
                {"stage": "Initial Access",   "probability": 0.03},
                {"stage": "Lateral Movement", "probability": 0.02},
                {"stage": "Data Exfiltration","probability": 0.01},
            ],
        }


# ─── Module singleton ─────────────────────────────────────────────────────────
rule_engine = RuleBasedForecastEngine()
