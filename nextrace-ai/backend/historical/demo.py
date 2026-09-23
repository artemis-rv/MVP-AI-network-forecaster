"""
NEXTRACE AI — Demo PCAP Analysis
Generates a deterministic synthetic analysis result without requiring a real PCAP.

⚠ ALL DATA IS SIMULATED — for demonstration purposes only.
This is NOT real network traffic or a real attack.
"""
from __future__ import annotations

import math
import time
import uuid
from typing import Any

_BASE_TS = 1700000000.0  # Fixed base timestamp for reproducibility


def generate_demo_result() -> dict[str, Any]:
    """
    Return a complete HistoricalResult dict using fully synthetic, deterministic data.
    Clearly labeled as demo throughout.
    """

    # ── Metadata ───────────────────────────────────────────────────────────────
    duration = 87.5  # seconds
    t_start  = _BASE_TS
    t_end    = t_start + duration

    # ── Temporal windows (15s each, 6 windows) ─────────────────────────────────
    window_configs = [
        # (idx, pkts, bytes, flows, u_src, u_dst, u_ports, tcp, udp, icmp, rate, sus)
        (0, 42,  18900,  8,  3,  6,  5,  30,  8,  4,  2.8,  0.05),
        (1, 78, 112000, 12,  4,  9, 18, 65,  9,  4,  5.2,  0.12),
        (2, 156, 87300, 21,  5, 14, 32, 120, 28,  8, 10.4,  0.31),
        (3, 89,  34200, 15,  3,  7, 12,  72, 14,  3,  5.9,  0.18),
        (4, 67, 520000,  9,  2,  4,  4,  61,  6,  0,  4.5,  0.08),
        (5, 55,  22100,  7,  3,  5,  6,  42, 10,  3,  3.7,  0.06),
    ]

    windows = []
    for w in window_configs:
        idx, pkts, byts, flows, usrc, udst, uports, tcp, udp, icmp, rate, sus = w
        windows.append({
            "window_index":     idx,
            "window_start":     round(t_start + idx * 15.0, 3),
            "window_end":       round(t_start + idx * 15.0 + 15.0, 3),
            "packet_count":     pkts,
            "byte_count":       byts,
            "flow_count":       flows,
            "unique_src_ips":   usrc,
            "unique_dst_ips":   udst,
            "unique_dst_ports": uports,
            "tcp_count":        tcp,
            "udp_count":        udp,
            "icmp_count":       icmp,
            "mean_packet_size": round(byts / pkts, 2),
            "connection_rate":  rate,
            "suspicious_ratio": sus,
        })

    # ── Suspicious events ──────────────────────────────────────────────────────
    suspicious_events = [
        {
            "event_id":   str(uuid.uuid4()),
            "type":       "port_scan_indicator",
            "timestamp":  t_start + 17.3,
            "src_ip":     "10.0.0.5",
            "dst_ip":     "192.168.1.25",
            "port":       0,
            "protocol":   "TCP",
            "severity":   "medium",
            "reason":     "Suspicious Indicator: 32 unique destination ports contacted from 10.0.0.5. "
                          "May indicate reconnaissance/port scan. (Demo heuristic)",
            "demo_label": "DEMO HEURISTIC — not confirmed attack evidence",
        },
        {
            "event_id":   str(uuid.uuid4()),
            "type":       "brute_force_indicator",
            "timestamp":  t_start + 22.8,
            "src_ip":     "10.0.0.5",
            "dst_ip":     "192.168.1.10",
            "port":       22,
            "protocol":   "TCP",
            "severity":   "high",
            "reason":     "Suspicious Indicator: 14 repeated connection attempts to port 22 from 10.0.0.5. "
                          "May indicate brute-force attempt on SSH service. (Demo heuristic)",
            "demo_label": "DEMO HEURISTIC — not confirmed attack evidence",
        },
        {
            "event_id":   str(uuid.uuid4()),
            "type":       "icmp_anomaly",
            "timestamp":  t_start + 31.1,
            "src_ip":     "10.0.0.5",
            "dst_ip":     "192.168.1.0/24",
            "port":       0,
            "protocol":   "ICMP",
            "severity":   "medium",
            "reason":     "Suspicious Indicator: 8 ICMP packets in 15s window. "
                          "May indicate network scanning or ICMP-based reconnaissance. (Demo heuristic)",
            "demo_label": "DEMO HEURISTIC — not confirmed attack evidence",
        },
        {
            "event_id":   str(uuid.uuid4()),
            "type":       "brute_force_indicator",
            "timestamp":  t_start + 38.6,
            "src_ip":     "10.0.0.5",
            "dst_ip":     "192.168.1.25",
            "port":       3389,
            "protocol":   "TCP",
            "severity":   "high",
            "reason":     "Suspicious Indicator: 11 repeated connection attempts to port 3389 (RDP) from 10.0.0.5. "
                          "May indicate brute-force attempt on remote access service. (Demo heuristic)",
            "demo_label": "DEMO HEURISTIC — not confirmed attack evidence",
        },
        {
            "event_id":   str(uuid.uuid4()),
            "type":       "large_transfer_indicator",
            "timestamp":  t_start + 62.4,
            "src_ip":     "192.168.1.50",
            "dst_ip":     "203.0.113.5",
            "port":       443,
            "protocol":   "TCP",
            "severity":   "high",
            "reason":     "Suspicious Indicator: 520,000 bytes in single flow "
                          "(192.168.1.50 → 203.0.113.5). "
                          "May indicate large data transfer / exfiltration pattern. (Demo heuristic)",
            "demo_label": "DEMO HEURISTIC — not confirmed attack evidence",
        },
        {
            "event_id":   str(uuid.uuid4()),
            "type":       "high_rate_indicator",
            "timestamp":  t_start + 45.0,
            "src_ip":     "10.0.0.5",
            "dst_ip":     "192.168.1.25",
            "port":       80,
            "protocol":   "TCP",
            "severity":   "critical",
            "reason":     "Suspicious Indicator: 10.4 packets/sec in window. "
                          "May indicate DoS-style or flood activity. (Demo heuristic)",
            "demo_label": "DEMO HEURISTIC — not confirmed attack evidence",
        },
    ]
    suspicious_events.sort(key=lambda e: e["timestamp"])

    # ── Activity timeline ──────────────────────────────────────────────────────
    _STAGE_MAP = {
        "port_scan_indicator":      ("Reconnaissance",    "Observed Activity"),
        "brute_force_indicator":    ("Initial Access",    "Suspicious Indicator"),
        "icmp_anomaly":             ("Reconnaissance",    "Observed Activity"),
        "large_transfer_indicator": ("Data Exfiltration", "Suspicious Indicator"),
        "high_rate_indicator":      ("Lateral Movement",  "Suspicious Indicator"),
    }

    activity_timeline = []
    for ev in suspicious_events:
        stage, label = _STAGE_MAP.get(ev["type"], ("Unknown", "Observed Activity"))
        activity_timeline.append({
            "entry_type":  "suspicious",
            "timestamp":   ev["timestamp"],
            "stage":       stage,
            "label":       label,
            "description": ev["reason"],
            "severity":    ev["severity"],
            "src_ip":      ev["src_ip"],
            "dst_ip":      ev["dst_ip"],
            "protocol":    ev["protocol"],
            "demo_label":  "DEMO HEURISTIC — not confirmed attack stage",
        })

    # Add normal activity entries for quiet windows
    activity_timeline.append({
        "entry_type":  "normal",
        "timestamp":   t_start + 0.0,
        "stage":       "Normal Activity",
        "label":       "Observed Activity",
        "description": "Window 0: 42 packets, 8 flows, 2.8 pkt/s",
        "severity":    "low",
        "src_ip":      "",
        "dst_ip":      "",
        "protocol":    "MIXED",
        "demo_label":  "Observed demo activity",
    })
    activity_timeline.append({
        "entry_type":  "normal",
        "timestamp":   t_start + 75.0,
        "stage":       "Normal Activity",
        "label":       "Observed Activity",
        "description": "Window 5: 55 packets, 7 flows, 3.7 pkt/s",
        "severity":    "low",
        "src_ip":      "",
        "dst_ip":      "",
        "protocol":    "MIXED",
        "demo_label":  "Observed demo activity",
    })
    activity_timeline.sort(key=lambda e: e["timestamp"])

    # ── Entity relationships ───────────────────────────────────────────────────
    entity_relationships = [
        {
            "src_ip": "192.168.1.10", "dst_ip": "10.0.0.5",
            "packet_count": 42,  "byte_count": 18900,
            "protocols": ["TCP"], "ports": [443, 80],
            "first_seen": t_start + 2.1, "last_seen": t_start + 12.3,
            "is_suspicious": False,
        },
        {
            "src_ip": "10.0.0.5", "dst_ip": "192.168.1.10",
            "packet_count": 156, "byte_count": 87300,
            "protocols": ["TCP", "ICMP"], "ports": [22, 23, 80, 135, 139, 443, 445, 3306, 3389, 5432, 8080, 8443, 9090, 27017, 4444, 6667],
            "first_seen": t_start + 17.3, "last_seen": t_start + 46.8,
            "is_suspicious": True,
        },
        {
            "src_ip": "10.0.0.5", "dst_ip": "192.168.1.25",
            "packet_count": 89, "byte_count": 34200,
            "protocols": ["TCP"], "ports": [80, 443, 3389, 8080],
            "first_seen": t_start + 38.6, "last_seen": t_start + 55.2,
            "is_suspicious": True,
        },
        {
            "src_ip": "192.168.1.25", "dst_ip": "192.168.1.50",
            "packet_count": 67, "byte_count": 22100,
            "protocols": ["TCP"], "ports": [5432],
            "first_seen": t_start + 55.4, "last_seen": t_start + 61.9,
            "is_suspicious": False,
        },
        {
            "src_ip": "192.168.1.50", "dst_ip": "203.0.113.5",
            "packet_count": 55, "byte_count": 520000,
            "protocols": ["TCP"], "ports": [443],
            "first_seen": t_start + 62.4, "last_seen": t_start + 84.7,
            "is_suspicious": True,
        },
    ]

    return {
        "is_demo":              True,
        "demo_label":           "⚠ DEMO DATA — All packets, flows, and events are simulated. Not real network traffic.",
        "packet_count":         487,
        "flow_count":           23,
        "duration_seconds":     duration,
        "start_timestamp":      t_start,
        "end_timestamp":        t_end,
        "window_seconds":       15.0,
        "protocol_distribution": [
            {"protocol": "TCP",  "count": 390},
            {"protocol": "UDP",  "count": 75},
            {"protocol": "ICMP", "count": 22},
        ],
        "top_src_ips": [
            {"ip": "10.0.0.5",     "count": 253},
            {"ip": "192.168.1.50", "count": 98},
            {"ip": "192.168.1.25", "count": 76},
            {"ip": "192.168.1.10", "count": 42},
            {"ip": "203.0.113.5",  "count": 18},
        ],
        "top_dst_ips": [
            {"ip": "192.168.1.25", "count": 189},
            {"ip": "192.168.1.10", "count": 156},
            {"ip": "203.0.113.5",  "count": 88},
            {"ip": "192.168.1.50", "count": 36},
            {"ip": "8.8.8.8",      "count": 18},
        ],
        "top_dst_ports": [
            {"port": 443,  "count": 187},
            {"port": 80,   "count": 112},
            {"port": 22,   "count": 48},
            {"port": 3389, "count": 37},
            {"port": 5432, "count": 28},
            {"port": 53,   "count": 21},
            {"port": 445,  "count": 18},
            {"port": 8080, "count": 15},
        ],
        "temporal_windows":      windows,
        "suspicious_events":     suspicious_events,
        "activity_timeline":     activity_timeline,
        "entity_relationships":  entity_relationships,
    }
