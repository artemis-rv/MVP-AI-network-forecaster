"""
NEXTRACE AI — Feature Engineering
Computes temporal-state features from a list of raw packet events within one window.
Designed to be modular — output is compatible with future forecasting components.
"""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from typing import Any


def compute_temporal_state(
    events: list[dict],
    window_start: datetime,
    window_end: datetime,
    window_seconds: int,
) -> dict[str, Any]:
    """
    Given a list of packet-event dicts from one temporal window,
    compute the full feature vector for that window.

    Returns a dict that matches TemporalState schema.
    """
    n = len(events)

    if n == 0:
        # Empty window — return zero state
        return _zero_state(window_start, window_end, window_seconds)

    # ── Aggregate raw counts ───────────────────────────────────
    byte_count     = sum(e.get("packet_size", 0) for e in events)
    benign_count   = sum(1 for e in events if e.get("classification") == "benign")
    suspicious_count = n - benign_count

    src_ips  = [e["src_ip"] for e in events]
    dst_ips  = [e["dst_ip"] for e in events]
    dst_ports= [e["dst_port"] for e in events]

    protocol_counter = Counter(e["protocol"] for e in events)

    # Unique flows = unique (src, dst, dst_port) tuples
    flows = set(
        (e["src_ip"], e["dst_ip"], e["dst_port"])
        for e in events
    )

    # ── Derived features ───────────────────────────────────────
    duration_sec   = max((window_end - window_start).total_seconds(), 1.0)
    mean_pkt_size  = byte_count / n
    conn_rate      = n / duration_sec
    susp_ratio     = suspicious_count / n if n > 0 else 0.0

    return {
        "window_start":    window_start.isoformat(timespec="milliseconds") + "Z",
        "window_end":      window_end.isoformat(timespec="milliseconds") + "Z",
        "window_seconds":  window_seconds,
        # Counts
        "packet_count":      n,
        "byte_count":        byte_count,
        "flow_count":        len(flows),
        "benign_count":      benign_count,
        "suspicious_count":  suspicious_count,
        # IP diversity
        "unique_src_ips":   len(set(src_ips)),
        "unique_dst_ips":   len(set(dst_ips)),
        "unique_dst_ports": len(set(dst_ports)),
        # Protocol breakdown
        "tcp_count":  protocol_counter.get("TCP", 0),
        "udp_count":  protocol_counter.get("UDP", 0),
        "icmp_count": protocol_counter.get("ICMP", 0),
        "dns_count":  protocol_counter.get("DNS", 0),
        "http_count": protocol_counter.get("HTTP", 0),
        # Derived metrics
        "mean_packet_size": round(mean_pkt_size, 2),
        "connection_rate":  round(conn_rate, 4),
        "suspicious_ratio": round(susp_ratio, 4),
    }


def _zero_state(window_start: datetime, window_end: datetime, window_seconds: int) -> dict:
    return {
        "window_start":     window_start.isoformat(timespec="milliseconds") + "Z",
        "window_end":       window_end.isoformat(timespec="milliseconds") + "Z",
        "window_seconds":   window_seconds,
        "packet_count":     0,
        "byte_count":       0,
        "flow_count":       0,
        "benign_count":     0,
        "suspicious_count": 0,
        "unique_src_ips":   0,
        "unique_dst_ips":   0,
        "unique_dst_ports": 0,
        "tcp_count":        0,
        "udp_count":        0,
        "icmp_count":       0,
        "dns_count":        0,
        "http_count":       0,
        "mean_packet_size": 0.0,
        "connection_rate":  0.0,
        "suspicious_ratio": 0.0,
    }
