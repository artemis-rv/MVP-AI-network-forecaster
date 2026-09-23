"""
NEXTRACE AI — Historical Flow Builder
Converts flat packet records into 5-tuple network flows.
"""
from __future__ import annotations

from collections import defaultdict
from typing import Any


FlowKey = tuple[str, str, int, int, str]  # src_ip, dst_ip, src_port, dst_port, proto


def build_flows(packets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Aggregate packets into 5-tuple flows.

    A flow is identified by (src_ip, dst_ip, src_port, dst_port, protocol).
    Returns a list of flow dicts sorted by first_seen.
    """
    flow_map: dict[FlowKey, dict[str, Any]] = defaultdict(lambda: {
        "packet_count": 0,
        "byte_count":   0,
        "first_seen":   None,
        "last_seen":    None,
        "flags":        set(),
    })

    for pkt in packets:
        key: FlowKey = (
            pkt["src_ip"],
            pkt["dst_ip"],
            pkt["src_port"],
            pkt["dst_port"],
            pkt["protocol"],
        )
        entry = flow_map[key]
        entry["packet_count"] += 1
        entry["byte_count"]   += pkt["size"]
        ts = pkt["timestamp"]
        if entry["first_seen"] is None or ts < entry["first_seen"]:
            entry["first_seen"] = ts
        if entry["last_seen"] is None or ts > entry["last_seen"]:
            entry["last_seen"] = ts
        if pkt["flags"]:
            for f in pkt["flags"]:
                entry["flags"].add(f)

    flows = []
    for (src_ip, dst_ip, src_port, dst_port, proto), data in flow_map.items():
        duration = (data["last_seen"] or 0) - (data["first_seen"] or 0)
        flows.append({
            "src_ip":       src_ip,
            "dst_ip":       dst_ip,
            "src_port":     src_port,
            "dst_port":     dst_port,
            "protocol":     proto,
            "packet_count": data["packet_count"],
            "byte_count":   data["byte_count"],
            "first_seen":   data["first_seen"],
            "last_seen":    data["last_seen"],
            "duration_s":   round(duration, 4),
            "flags":        list(data["flags"]),
        })

    flows.sort(key=lambda f: f["first_seen"] or 0)
    return flows
