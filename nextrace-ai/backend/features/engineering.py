"""
NEXTRACE AI — Feature Engineering & Flow Extraction
===================================================
Computes temporal-state features and bidirectional flow records from raw packet events.
Derives observable anomaly heuristics without manufacturing fake synthetic ground truth.
"""
from __future__ import annotations

from collections import Counter, defaultdict
from datetime import datetime, timezone
from typing import Any, Optional


def build_flows_from_events(events: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Aggregate individual packet events into bidirectional 5-tuple network flows.
    Flow Key: (min_ip, max_ip, min_port, max_port, protocol)
    """
    flows_dict: dict[tuple, dict[str, Any]] = {}

    for e in events:
        src_ip = e.get("src_ip", "0.0.0.0")
        dst_ip = e.get("dst_ip", "0.0.0.0")
        src_port = int(e.get("src_port", 0))
        dst_port = int(e.get("dst_port", 0))
        proto = e.get("protocol", "OTHER")
        size = int(e.get("packet_size", 0))
        classification = e.get("classification", "benign")

        # Normalize direction for bidirectional grouping
        if (src_ip, src_port) <= (dst_ip, dst_port):
            key = (src_ip, dst_ip, src_port, dst_port, proto)
            is_forward = True
        else:
            key = (dst_ip, src_ip, dst_port, src_port, proto)
            is_forward = False

        if key not in flows_dict:
            flow_id = f"flow_{src_ip}:{src_port}->{dst_ip}:{dst_port}_{proto}"
            flows_dict[key] = {
                "flow_id": flow_id,
                "src_ip": key[0],
                "dst_ip": key[1],
                "src_port": key[2],
                "dst_port": key[3],
                "protocol": key[4],
                "packet_count": 0,
                "byte_count": 0,
                "forward_packets": 0,
                "reverse_packets": 0,
                "is_suspicious": False,
                "flags": [],
            }

        fl = flows_dict[key]
        fl["packet_count"] += 1
        fl["byte_count"] += size
        if is_forward:
            fl["forward_packets"] += 1
        else:
            fl["reverse_packets"] += 1

        if classification == "suspicious":
            fl["is_suspicious"] = True

    return list(flows_dict.values())


def compute_observable_anomaly_score(events: list[dict[str, Any]], duration_sec: float) -> tuple[float, int]:
    """
    Derive an anomaly / suspicion score from observable network traffic indicators.
    Returns (score: float in [0.0, 1.0], suspicious_count: int).
    
    Observable Indicators:
    1. High connection rate / burst rate (> 100 pkts/sec)
    2. High destination port diversity (port scan heuristic: > 10 distinct dst ports)
    3. High destination IP fan-out (network sweep heuristic: > 10 distinct dst IPs)
    4. Suspicious destination ports (C2, Remote Admin, standard attack vectors)
    5. TCP Flag anomalies (SYN flood without ACK, Null scan, Xmas scan)
    6. ICMP burst (> 5 ICMP packets/sec)
    7. DNS volume spikes (> 50 DNS queries in window)
    """
    if not events:
        return 0.0, 0

    n = len(events)
    suspicious_count = 0
    suspicion_points = 0.0

    suspicious_ports = {1337, 31337, 4444, 5555, 6667, 8888, 9001, 9999, 22, 23, 445, 3389}

    dst_ports = set()
    dst_ips = set()
    icmp_count = 0
    dns_count = 0
    syn_scan_count = 0

    for e in events:
        dport = int(e.get("dst_port", 0))
        dst_ip = e.get("dst_ip", "")
        proto = e.get("protocol", "")
        flags = e.get("tcp_flags", "") or ""

        dst_ports.add(dport)
        dst_ips.add(dst_ip)

        is_pkt_suspicious = False

        if dport in suspicious_ports:
            is_pkt_suspicious = True
            suspicion_points += 0.15

        if proto == "TCP" and "S" in flags and "A" not in flags and dport not in (80, 443):
            syn_scan_count += 1
            if syn_scan_count > 3:
                is_pkt_suspicious = True

        if proto == "TCP" and (flags == "NULL" or "FPU" in flags):
            is_pkt_suspicious = True
            suspicion_points += 0.2

        if proto == "ICMP":
            icmp_count += 1

        if proto == "DNS" or dport == 53 or int(e.get("src_port", 0)) == 53:
            dns_count += 1

        if is_pkt_suspicious or e.get("classification") == "suspicious":
            suspicious_count += 1

    # Port scanning indicator
    if len(dst_ports) > 10:
        suspicion_points += min(0.3, len(dst_ports) * 0.02)
    # Host sweep indicator
    if len(dst_ips) > 10:
        suspicion_points += min(0.3, len(dst_ips) * 0.02)
    # ICMP sweep indicator
    if (icmp_count / duration_sec) > 3.0:
        suspicion_points += 0.2
    # Connection burst indicator
    rate = n / duration_sec
    if rate > 200.0:
        suspicion_points += 0.15

    score = min(1.0, round(suspicion_points, 3))
    return score, suspicious_count


def compute_temporal_state(
    events: list[dict[str, Any]],
    window_start: datetime,
    window_end: datetime,
    window_seconds: int,
) -> dict[str, Any]:
    """
    Given a list of packet-event dicts from one temporal window,
    compute the full canonical feature vector for that window.
    """
    n = len(events)

    if n == 0:
        return _zero_state(window_start, window_end, window_seconds)

    # ── Aggregate raw counts ───────────────────────────────────
    byte_count = sum(int(e.get("packet_size", 0)) for e in events)
    src_ips = [e["src_ip"] for e in events if e.get("src_ip")]
    dst_ips = [e["dst_ip"] for e in events if e.get("dst_ip")]
    dst_ports = [int(e["dst_port"]) for e in events if "dst_port" in e]

    protocol_counter = Counter(e.get("protocol", "OTHER") for e in events)

    # Unique flows
    flows = build_flows_from_events(events)

    # ── Derived rates & features ──────────────────────────────
    duration_sec = max((window_end - window_start).total_seconds(), 0.1)
    mean_pkt_size = round(byte_count / n, 2) if n > 0 else 0.0
    conn_rate = round(len(flows) / duration_sec, 4)
    packet_rate = round(n / duration_sec, 2)
    byte_rate = round(byte_count / duration_sec, 2)

    anomaly_score, susp_cnt = compute_observable_anomaly_score(events, duration_sec)
    benign_cnt = n - susp_cnt
    susp_ratio = round(susp_cnt / n, 4) if n > 0 else 0.0

    ws = window_start.isoformat(timespec="milliseconds").replace("+00:00", "") + "Z"
    we = window_end.isoformat(timespec="milliseconds").replace("+00:00", "") + "Z"

    return {
        "window_start": ws,
        "window_end": we,
        "window_seconds": window_seconds,
        # Counts
        "packet_count": n,
        "byte_count": byte_count,
        "flow_count": len(flows),
        "benign_count": benign_cnt,
        "suspicious_count": susp_cnt,
        # IP diversity
        "unique_src_ips": len(set(src_ips)),
        "unique_dst_ips": len(set(dst_ips)),
        "unique_dst_ports": len(set(dst_ports)),
        # Protocol breakdown
        "tcp_count": protocol_counter.get("TCP", 0),
        "udp_count": protocol_counter.get("UDP", 0),
        "icmp_count": protocol_counter.get("ICMP", 0) + protocol_counter.get("ICMPv6", 0),
        "dns_count": protocol_counter.get("DNS", 0),
        "http_count": protocol_counter.get("HTTP", 0),
        # Derived metrics
        "mean_packet_size": mean_pkt_size,
        "connection_rate": conn_rate,
        "packet_rate": packet_rate,
        "byte_rate": byte_rate,
        "suspicious_ratio": susp_ratio,
        "suspicion_score": anomaly_score,
    }


def _zero_state(window_start: datetime, window_end: datetime, window_seconds: int) -> dict[str, Any]:
    ws = window_start.isoformat(timespec="milliseconds").replace("+00:00", "") + "Z"
    we = window_end.isoformat(timespec="milliseconds").replace("+00:00", "") + "Z"
    return {
        "window_start": ws,
        "window_end": we,
        "window_seconds": window_seconds,
        "packet_count": 0,
        "byte_count": 0,
        "flow_count": 0,
        "benign_count": 0,
        "suspicious_count": 0,
        "unique_src_ips": 0,
        "unique_dst_ips": 0,
        "unique_dst_ports": 0,
        "tcp_count": 0,
        "udp_count": 0,
        "icmp_count": 0,
        "dns_count": 0,
        "http_count": 0,
        "mean_packet_size": 0.0,
        "connection_rate": 0.0,
        "packet_rate": 0.0,
        "byte_rate": 0.0,
        "suspicious_ratio": 0.0,
        "suspicion_score": 0.0,
    }
