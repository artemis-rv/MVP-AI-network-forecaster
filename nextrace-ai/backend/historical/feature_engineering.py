"""
NEXTRACE AI — Historical Feature Engineering
Aggregates flows into temporal windows and computes feature vectors.
"""
from __future__ import annotations

import math
from collections import defaultdict
from typing import Any


def aggregate_temporal_windows(
    packets: list[dict[str, Any]],
    flows: list[dict[str, Any]],
    window_seconds: float = 15.0,
) -> list[dict[str, Any]]:
    """
    Divide the capture timeline into fixed-duration temporal windows
    and compute a feature vector for each window.

    Args:
        packets: Flat packet records from parser.
        flows:   5-tuple flows from flow_builder.
        window_seconds: Width of each temporal window in seconds.

    Returns:
        List of temporal window dicts sorted by window start time.
    """
    if not packets:
        return []

    ts_values = [p["timestamp"] for p in packets]
    t_start = min(ts_values)
    t_end   = max(ts_values)

    # Build window buckets
    bucket_map: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for pkt in packets:
        bucket_idx = int((pkt["timestamp"] - t_start) / window_seconds)
        bucket_map[bucket_idx].append(pkt)

    # Map flows to their starting bucket
    flow_bucket_map: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for flow in flows:
        if flow["first_seen"] is not None:
            bucket_idx = int((flow["first_seen"] - t_start) / window_seconds)
            flow_bucket_map[bucket_idx].append(flow)

    windows = []
    total_buckets = int(math.ceil((t_end - t_start) / window_seconds)) + 1

    for idx in range(total_buckets):
        w_start = t_start + idx * window_seconds
        w_end   = w_start + window_seconds
        pkts    = bucket_map.get(idx, [])
        fls     = flow_bucket_map.get(idx, [])

        if not pkts:
            continue  # Skip empty windows

        pkt_count     = len(pkts)
        byte_count    = sum(p["size"] for p in pkts)
        flow_count    = len(fls)
        src_ips       = {p["src_ip"] for p in pkts}
        dst_ips       = {p["dst_ip"] for p in pkts}
        dst_ports     = {p["dst_port"] for p in pkts}
        tcp_count     = sum(1 for p in pkts if p["protocol"] == "TCP")
        udp_count     = sum(1 for p in pkts if p["protocol"] == "UDP")
        icmp_count    = sum(1 for p in pkts if p["protocol"] in ("ICMP", "ICMPv6"))
        mean_pkt_size = byte_count / pkt_count if pkt_count > 0 else 0
        conn_rate     = round(pkt_count / window_seconds, 3)
        sus_ratio     = round(
            sum(1 for p in pkts if p["dst_port"] in _SUSPICIOUS_PORTS) / pkt_count, 3
        ) if pkt_count > 0 else 0

        windows.append({
            "window_index":      idx,
            "window_start":      round(w_start, 3),
            "window_end":        round(w_end, 3),
            "packet_count":      pkt_count,
            "byte_count":        byte_count,
            "flow_count":        flow_count,
            "unique_src_ips":    len(src_ips),
            "unique_dst_ips":    len(dst_ips),
            "unique_dst_ports":  len(dst_ports),
            "tcp_count":         tcp_count,
            "udp_count":         udp_count,
            "icmp_count":        icmp_count,
            "mean_packet_size":  round(mean_pkt_size, 2),
            "connection_rate":   conn_rate,
            "suspicious_ratio":  sus_ratio,
        })

    return windows


# Ports associated with sensitive/admin services — used for suspicious ratio heuristic
_SUSPICIOUS_PORTS = {
    22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445,
    3389, 5432, 1433, 3306, 27017, 4444, 6667, 6666,
}
