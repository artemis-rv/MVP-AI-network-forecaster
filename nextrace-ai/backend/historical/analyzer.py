"""
NEXTRACE AI — Historical Analyzer
Deterministic heuristic detection and activity timeline building.
Orchestrates the full historical analysis pipeline.

NOTE: All detections are DEMO HEURISTICS for prototype purposes.
They are NOT a production IDS or threat intelligence system.
"""
from __future__ import annotations

import datetime
import uuid
from collections import Counter, defaultdict
from typing import Any

from backend.historical.parser import parse_pcap
from backend.historical.flow_builder import build_flows
from backend.historical.feature_engineering import aggregate_temporal_windows


# ── Heuristic thresholds (demo values) ───────────────────────────────────────
class HeuristicConfig:
    PORT_SCAN_UNIQUE_PORTS   = 20    # unique dst_ports from one src → recon indicator
    BRUTE_FORCE_REPEATS      = 10    # repeated connections to same dst_port (22/3389)
    ICMP_VOLUME_THRESHOLD    = 30    # ICMP packets per window → ICMP anomaly indicator
    BEACON_INTERVAL_VARIANCE = 0.15  # low jitter in connection intervals → C2 indicator
    LARGE_TRANSFER_BYTES     = 500_000  # bytes per flow → exfiltration indicator
    DOS_PACKET_RATE          = 150   # packets/second in a window → DoS indicator


AUTH_PORTS = {22, 3389, 23, 21, 25, 110, 143, 1433, 3306, 5432}


def run_analysis(
    path: str,
    window_seconds: float = 15.0,
    progress_callback: Any = None,
) -> dict[str, Any]:
    """
    Full historical analysis pipeline.
    Args:
        path: Absolute path to validated PCAP file.
        window_seconds: Temporal window size.
        progress_callback: Optional callable(stage: str, pct: float).
    Returns:
        Complete HistoricalResult dict.
    """
    def _progress(stage: str, pct: float) -> None:
        if progress_callback:
            progress_callback(stage, pct)

    # 1 — Parse
    _progress("parsing", 5.0)
    packets = parse_pcap(path)
    _progress("parsing", 30.0)

    if not packets:
        raise ValueError("No IP packets found in the PCAP file.")

    # 2 — Build flows
    _progress("building_flows", 35.0)
    flows = build_flows(packets)
    _progress("building_flows", 55.0)

    # 3 — Feature engineering
    _progress("feature_engineering", 60.0)
    windows = aggregate_temporal_windows(packets, flows, window_seconds)
    _progress("feature_engineering", 75.0)

    # 4 — Heuristic detection
    _progress("detection", 78.0)
    suspicious_events = _detect_suspicious_activity(packets, flows, windows)
    _progress("detection", 90.0)

    # 5 — Timeline + stage observations
    _progress("timeline", 92.0)
    activity_timeline = _build_activity_timeline(suspicious_events, windows)
    _progress("timeline", 95.0)

    # 6 — Entity relationships
    entity_relationships = _build_entity_relationships(flows)

    # 7 — Metadata
    ts_values = [p["timestamp"] for p in packets]
    t_start = min(ts_values)
    t_end   = max(ts_values)
    duration = t_end - t_start

    protocol_counts = Counter(p["protocol"] for p in packets)
    src_ip_counts   = Counter(p["src_ip"]   for p in packets)
    dst_ip_counts   = Counter(p["dst_ip"]   for p in packets)
    dst_port_counts = Counter(p["dst_port"] for p in packets)

    _progress("completed", 100.0)

    return {
        "packet_count":         len(packets),
        "flow_count":           len(flows),
        "duration_seconds":     round(duration, 2),
        "start_timestamp":      t_start,
        "end_timestamp":        t_end,
        "window_seconds":       window_seconds,
        "protocol_distribution": [
            {"protocol": k, "count": v} for k, v in protocol_counts.most_common()
        ],
        "top_src_ips": [
            {"ip": k, "count": v} for k, v in src_ip_counts.most_common(10)
        ],
        "top_dst_ips": [
            {"ip": k, "count": v} for k, v in dst_ip_counts.most_common(10)
        ],
        "top_dst_ports": [
            {"port": k, "count": v} for k, v in dst_port_counts.most_common(10)
        ],
        "temporal_windows":     windows,
        "suspicious_events":    suspicious_events,
        "activity_timeline":    activity_timeline,
        "entity_relationships": entity_relationships,
    }


# ── Heuristic Detectors ───────────────────────────────────────────────────────

def _detect_suspicious_activity(
    packets: list[dict],
    flows: list[dict],
    windows: list[dict],
) -> list[dict]:
    events: list[dict] = []
    seen_ids: set[str] = set()

    def _add_event(etype: str, ts: float, src: str, dst: str, proto: str,
                   severity: str, reason: str, port: int = 0) -> None:
        eid = f"{etype}:{src}:{dst}:{int(ts)}"
        if eid in seen_ids:
            return
        seen_ids.add(eid)
        events.append({
            "event_id":   str(uuid.uuid4()),
            "type":       etype,
            "timestamp":  ts,
            "src_ip":     src,
            "dst_ip":     dst,
            "port":       port,
            "protocol":   proto,
            "severity":   severity,
            "reason":     reason,
            "demo_label": "DEMO HEURISTIC — not confirmed attack evidence",
        })

    # ── Per-source port scan detection ────────────────────────────────────────
    src_dst_ports: dict[str, set[int]] = defaultdict(set)
    src_dst_ips:   dict[str, set[str]] = defaultdict(set)
    for pkt in packets:
        src_dst_ports[pkt["src_ip"]].add(pkt["dst_port"])
        src_dst_ips[pkt["src_ip"]].add(pkt["dst_ip"])

    for src_ip, dst_ports in src_dst_ports.items():
        if len(dst_ports) >= HeuristicConfig.PORT_SCAN_UNIQUE_PORTS:
            earliest = min(
                (p["timestamp"] for p in packets if p["src_ip"] == src_ip),
                default=0,
            )
            _add_event(
                "port_scan_indicator", earliest, src_ip, "multiple", "TCP",
                "medium",
                f"Suspicious Indicator: {len(dst_ports)} unique destination ports contacted from {src_ip}. "
                f"May indicate reconnaissance/port scan. (Demo heuristic)",
            )

    # ── Brute-force on auth ports ─────────────────────────────────────────────
    auth_key_counts: Counter = Counter()
    auth_key_first: dict = {}
    for flow in flows:
        if flow["dst_port"] in AUTH_PORTS and flow["packet_count"] >= HeuristicConfig.BRUTE_FORCE_REPEATS:
            key = f"{flow['src_ip']}→{flow['dst_ip']}:{flow['dst_port']}"
            auth_key_counts[key] += 1
            if key not in auth_key_first:
                auth_key_first[key] = flow["first_seen"] or 0

    for key, cnt in auth_key_counts.items():
        src, rest = key.split("→")
        dst, port_str = rest.rsplit(":", 1)
        port = int(port_str)
        _add_event(
            "brute_force_indicator", auth_key_first.get(key, 0), src, dst, "TCP",
            "high",
            f"Suspicious Indicator: {cnt} repeated connection attempts to port {port} from {src}. "
            f"May indicate brute-force attempt on authentication service. (Demo heuristic)",
            port=port,
        )

    # ── ICMP anomaly per window ───────────────────────────────────────────────
    for win in windows:
        if win["icmp_count"] >= HeuristicConfig.ICMP_VOLUME_THRESHOLD:
            icmp_pkts = [
                p for p in packets
                if p["protocol"] in ("ICMP", "ICMPv6")
                and win["window_start"] <= p["timestamp"] < win["window_end"]
            ]
            src = icmp_pkts[0]["src_ip"] if icmp_pkts else "unknown"
            dst = icmp_pkts[0]["dst_ip"] if icmp_pkts else "unknown"
            _add_event(
                "icmp_anomaly", win["window_start"], src, dst, "ICMP",
                "medium",
                f"Suspicious Indicator: {win['icmp_count']} ICMP packets in 15s window. "
                f"May indicate network scanning or ICMP-based reconnaissance. (Demo heuristic)",
            )

    # ── Large transfer (exfiltration indicator) ───────────────────────────────
    for flow in flows:
        if flow["byte_count"] >= HeuristicConfig.LARGE_TRANSFER_BYTES:
            _add_event(
                "large_transfer_indicator", flow["first_seen"] or 0,
                flow["src_ip"], flow["dst_ip"], flow["protocol"],
                "high",
                f"Suspicious Indicator: {flow['byte_count']:,} bytes in single flow "
                f"({flow['src_ip']} → {flow['dst_ip']}). "
                f"May indicate large data transfer / exfiltration pattern. (Demo heuristic)",
                port=flow["dst_port"],
            )

    # ── High packet rate (DoS indicator) ─────────────────────────────────────
    for win in windows:
        if win["connection_rate"] >= HeuristicConfig.DOS_PACKET_RATE:
            pkts_in_win = [
                p for p in packets
                if win["window_start"] <= p["timestamp"] < win["window_end"]
            ]
            src = pkts_in_win[0]["src_ip"] if pkts_in_win else "unknown"
            dst = pkts_in_win[0]["dst_ip"] if pkts_in_win else "unknown"
            _add_event(
                "high_rate_indicator", win["window_start"], src, dst, "TCP",
                "critical",
                f"Suspicious Indicator: {win['connection_rate']:.1f} packets/sec in window. "
                f"May indicate DoS-style or flood activity. (Demo heuristic)",
            )

    events.sort(key=lambda e: e["timestamp"])
    return events


# ── Activity Timeline Builder ─────────────────────────────────────────────────

_STAGE_MAPPING = {
    "port_scan_indicator":      ("Reconnaissance",    "Observed Activity"),
    "brute_force_indicator":    ("Initial Access",    "Suspicious Indicator"),
    "icmp_anomaly":             ("Reconnaissance",    "Observed Activity"),
    "large_transfer_indicator": ("Data Exfiltration", "Suspicious Indicator"),
    "high_rate_indicator":      ("Lateral Movement",  "Suspicious Indicator"),
}

_SEVERITY_ORDER = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def _build_activity_timeline(
    suspicious_events: list[dict],
    windows: list[dict],
) -> list[dict]:
    """
    Merge suspicious events + temporal window observations into a chronological
    activity timeline with stage labels.
    """
    timeline: list[dict] = []

    for event in suspicious_events:
        stage, label = _STAGE_MAPPING.get(event["type"], ("Unknown", "Observed Activity"))
        timeline.append({
            "entry_type":  "suspicious",
            "timestamp":   event["timestamp"],
            "stage":       stage,
            "label":       label,
            "description": event["reason"],
            "severity":    event["severity"],
            "src_ip":      event["src_ip"],
            "dst_ip":      event["dst_ip"],
            "protocol":    event["protocol"],
            "demo_label":  "DEMO HEURISTIC — not confirmed attack stage",
        })

    # Add a normal-activity entry per window where no suspicious event was detected
    sus_windows = {
        int((e["timestamp"] - (windows[0]["window_start"] if windows else 0)) / (windows[0]["window_end"] - windows[0]["window_start"] + 0.001))
        for e in suspicious_events
    } if windows else set()

    for win in windows:
        if not any(
            win["window_start"] <= e["timestamp"] < win["window_end"]
            for e in suspicious_events
        ):
            timeline.append({
                "entry_type":  "normal",
                "timestamp":   win["window_start"],
                "stage":       "Normal Activity",
                "label":       "Observed Activity",
                "description": f"Window {win['window_index']}: {win['packet_count']} packets, "
                               f"{win['flow_count']} flows, {win['connection_rate']} pkt/s",
                "severity":    "low",
                "src_ip":      "",
                "dst_ip":      "",
                "protocol":    "MIXED",
                "demo_label":  "Observed demo activity",
            })

    timeline.sort(key=lambda e: e["timestamp"])
    return timeline


# ── Entity Relationship Builder ───────────────────────────────────────────────

def _build_entity_relationships(flows: list[dict]) -> list[dict]:
    """
    Build entity relationship records for network graph rendering.
    Each unique (src_ip, dst_ip) pair becomes a relationship edge.
    """
    edge_map: dict[tuple[str, str], dict] = defaultdict(lambda: {
        "packet_count": 0, "byte_count": 0, "protocols": set(),
        "ports": set(), "first_seen": None, "last_seen": None,
    })

    for flow in flows:
        key = (flow["src_ip"], flow["dst_ip"])
        edge = edge_map[key]
        edge["packet_count"] += flow["packet_count"]
        edge["byte_count"]   += flow["byte_count"]
        edge["protocols"].add(flow["protocol"])
        if flow["dst_port"]:
            edge["ports"].add(flow["dst_port"])
        if edge["first_seen"] is None or (flow["first_seen"] and flow["first_seen"] < edge["first_seen"]):
            edge["first_seen"] = flow["first_seen"]
        if edge["last_seen"] is None or (flow["last_seen"] and flow["last_seen"] > edge["last_seen"]):
            edge["last_seen"] = flow["last_seen"]

    relationships = []
    # Collect unique IPs for node classification
    all_src = {k[0] for k in edge_map}
    all_dst = {k[1] for k in edge_map}
    all_ips = all_src | all_dst

    for (src, dst), data in edge_map.items():
        relationships.append({
            "src_ip":       src,
            "dst_ip":       dst,
            "packet_count": data["packet_count"],
            "byte_count":   data["byte_count"],
            "protocols":    sorted(data["protocols"]),
            "ports":        sorted(data["ports"])[:10],
            "first_seen":   data["first_seen"],
            "last_seen":    data["last_seen"],
            "is_suspicious": len(data["ports"]) >= 15,  # heuristic for graph highlighting
        })

    return relationships
