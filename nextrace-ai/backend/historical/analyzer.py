"""
NEXTRACE AI — Historical Analyzer
Deterministic heuristic detection and activity timeline building for real network captures.
Orchestrates the full historical analysis pipeline.
"""
from __future__ import annotations

import datetime
import uuid
from collections import Counter, defaultdict
from typing import Any

from backend.historical.parser import parse_pcap
from backend.historical.flow_builder import build_flows
from backend.historical.feature_engineering import aggregate_temporal_windows
from backend.forecasting.engine import RuleBasedForecastEngine


# ── Heuristic thresholds (configured for real capture analysis) ───────────────
class HeuristicConfig:
    PORT_SCAN_VERTICAL_PORTS = 8     # unique dst_ports on single target from 1 src
    PORT_SCAN_HORIZONTAL_IPS = 6     # unique dst_ips targeted by 1 src
    PORT_SCAN_TOTAL_PORTS    = 12    # total unique dst_ports across network from 1 src
    BRUTE_FORCE_FLOWS        = 4     # repeated flow attempts to same auth port from 1 src
    BRUTE_FORCE_PACKETS      = 12    # repeated packets on auth port from 1 src
    ICMP_VOLUME_THRESHOLD    = 20    # ICMP packets in a window
    LARGE_TRANSFER_BYTES     = 250_000 # bytes per flow → exfiltration indicator
    DOS_PACKET_RATE          = 80    # packets/second in a window → DoS indicator
    DNS_ANOMALY_QUERY_COUNT  = 30    # DNS queries in a window
    SAFE_INTERNAL_PORTS      = {53, 123, 88, 389}  # DNS, NTP, Kerberos, LDAP (to prevent false positive alerts)


AUTH_PORTS = {21, 22, 23, 25, 110, 143, 445, 1433, 1521, 3306, 3389, 5432, 5900, 6379, 27017}
MALICIOUS_BACKDOOR_PORTS = {1337, 31337, 4444, 5555, 6667, 8888, 9001, 9999}
SENSITIVE_SERVICE_NAMES: dict[int, str] = {
    21: "FTP", 22: "SSH", 23: "Telnet", 25: "SMTP", 110: "POP3",
    143: "IMAP", 445: "SMB/EternalBlue", 1433: "MSSQL", 1521: "Oracle DB",
    3306: "MySQL", 3389: "RDP", 5432: "PostgreSQL", 5900: "VNC",
    6379: "Redis", 27017: "MongoDB", 4444: "Metasploit/Meterpreter C2",
    6667: "IRC Botnet C2", 1337: "Elite Backdoor", 31337: "BackOrifice",
}


def run_analysis(
    path: str,
    window_seconds: float = 15.0,
    progress_callback: Any = None,
) -> dict[str, Any]:
    """
    Full historical analysis pipeline for real PCAP files.
    """
    def _progress(stage: str, pct: float) -> None:
        if progress_callback:
            progress_callback(stage, pct)

    # 1 — Parse
    _progress("parsing", 5.0)
    packets = parse_pcap(path)
    _progress("parsing", 30.0)

    if not packets:
        raise ValueError("No valid IP or ARP packets found in the capture file.")

    # 2 — Build flows
    _progress("building_flows", 35.0)
    flows = build_flows(packets)
    _progress("building_flows", 55.0)

    # Calculate capture span
    ts_values = [p["timestamp"] for p in packets if p.get("timestamp")]
    t_start = min(ts_values) if ts_values else 0.0
    t_end   = max(ts_values) if ts_values else 0.0
    duration = max(0.0, t_end - t_start)

    # Adapt window size for very short captures
    if duration > 0 and duration < window_seconds:
        window_seconds = max(1.0, round(duration / 4, 1))

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
    entity_relationships = _build_entity_relationships(flows, suspicious_events)

    # 7 — Forecast Engine integration
    forecast_engine = RuleBasedForecastEngine()
    window_forecasts = []
    final_forecast = None
    for win in windows:
        sus_dsts = [
            e["dst_ip"] for e in suspicious_events
            if win["window_start"] <= e["timestamp"] < win["window_end"]
        ]
        tgt = max(set(sus_dsts), key=sus_dsts.count) if sus_dsts else None
        mode = "suspicious" if win.get("suspicious_ratio", 0) > 0.05 or sus_dsts else "benign"
        fc = forecast_engine.predict(win, mode=mode, observed_target=tgt)
        window_forecasts.append(fc)
        final_forecast = fc

    # 8 — Metadata
    protocol_counts = Counter(p["protocol"] for p in packets)
    src_ip_counts   = Counter(p["src_ip"]   for p in packets if p["src_ip"] not in ("0.0.0.0", ""))
    dst_ip_counts   = Counter(p["dst_ip"]   for p in packets if p["dst_ip"] not in ("0.0.0.0", ""))
    dst_port_counts = Counter(p["dst_port"] for p in packets if p["dst_port"] > 0)

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
        "window_forecasts":     window_forecasts,
        "final_forecast":       final_forecast,
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
                   severity: str, reason: str, port: int = 0,
                   bytes_count: int | None = None, payload_info: str | None = None) -> None:
        eid = f"{etype}:{src}:{dst}:{port}:{int(ts)}"
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
            "bytes":      bytes_count,
            "payload_info": payload_info,
            "demo_label": "Suspicious Activity Indicator",
        })

    # ── 1. Reconnaissance: Port Scans & Subnet Sweeps ───────────────────────────
    src_target_ports: dict[tuple[str, str], set[int]] = defaultdict(set)
    src_all_ports:    dict[str, set[int]] = defaultdict(set)
    src_all_dsts:     dict[str, set[str]] = defaultdict(set)
    src_first_ts:     dict[str, float] = {}

    for pkt in packets:
        s = pkt["src_ip"]
        d = pkt["dst_ip"]
        p = pkt["dst_port"]
        ts = pkt["timestamp"]
        
        # Only count connection initiations (TCP SYN without ACK) or UDP for port scanning
        if pkt["protocol"] == "TCP":
            flags = pkt.get("flags", "")
            if "S" not in flags or "A" in flags:
                continue
        elif pkt["protocol"] == "UDP":
            # Ignore UDP return traffic (from standard server ports, or to ephemeral ports)
            if pkt.get("src_port", 0) in (53, 443, 80, 123) or p >= 1024:
                continue
                
        # Ignore safe internal infrastructure ports to avoid false positives (e.g. heavy DNS polling)
        if p in HeuristicConfig.SAFE_INTERNAL_PORTS:
            continue
            
        if s not in src_first_ts or ts < src_first_ts[s]:
            src_first_ts[s] = ts
        if p > 0:
            src_target_ports[(s, d)].add(p)
            src_all_ports[s].add(p)
        if d not in ("0.0.0.0", "255.255.255.255", ""):
            src_all_dsts[s].add(d)

    # Vertical Port Scan (single destination targeted across multiple ports)
    for (src_ip, dst_ip), ports in src_target_ports.items():
        if len(ports) >= HeuristicConfig.PORT_SCAN_VERTICAL_PORTS:
            _add_event(
                "port_scan_indicator", src_first_ts.get(src_ip, 0.0), src_ip, dst_ip, "TCP",
                "high",
                f"Vertical Port Scan: {len(ports)} distinct ports probed on {dst_ip} from {src_ip}.",
                payload_info="[SYN] Seq=0",
            )

    import ipaddress
    def _is_private_ip(ip_str: str) -> bool:
        try:
            ip = ipaddress.ip_address(ip_str)
            return ip.is_private and not ip.is_multicast
        except ValueError:
            return False

    # Horizontal Sweep / Subnet Sweep
    for src_ip, dsts in src_all_dsts.items():
        internal_dsts = [d for d in dsts if _is_private_ip(d)]
        if len(internal_dsts) >= HeuristicConfig.PORT_SCAN_HORIZONTAL_IPS and len(src_all_ports.get(src_ip, set())) >= 2:
            _add_event(
                "port_scan_indicator", src_first_ts.get(src_ip, 0.0), src_ip, "multiple_targets", "TCP",
                "medium",
                f"Network Sweep: {len(internal_dsts)} distinct internal hosts probed by {src_ip}.",
            )

    # Stealth Flag Scans (NULL, Xmas, FIN-only scans)
    stealth_counts: Counter = Counter()
    stealth_first: dict = {}
    for pkt in packets:
        flags = pkt.get("flags", "")
        if pkt["protocol"] == "TCP":
            # NULL scan (no flags), Xmas scan (FPU / FIN-PSH-URG), FIN scan
            is_stealth = (flags == "" or "FPU" in flags or (flags == "F" and pkt["dst_port"] > 0))
            if is_stealth:
                key = (pkt["src_ip"], pkt["dst_ip"], pkt["dst_port"])
                stealth_counts[key] += 1
                if key not in stealth_first:
                    stealth_first[key] = pkt["timestamp"]

    for (s, d, p), cnt in stealth_counts.items():
        if cnt >= 2:
            _add_event(
                "port_scan_indicator", stealth_first.get((s, d, p), 0.0), s, d, "TCP",
                "high",
                f"Stealth TCP Scan: {cnt} abnormal flag probes (NULL/Xmas/FIN) to {d}:{p} from {s}.",
                port=p, payload_info="[FPU, URG, PSH, FIN]"
            )

    # ── 2. Brute-Force Authentication Probing ─────────────────────────────────
    auth_attempts: Counter = Counter()
    auth_first: dict = {}
    auth_pkts: Counter = Counter()

    for flow in flows:
        if flow["dst_port"] in AUTH_PORTS:
            key = (flow["src_ip"], flow["dst_ip"], flow["dst_port"])
            auth_attempts[key] += 1
            auth_pkts[key] += flow["packet_count"]
            if key not in auth_first:
                auth_first[key] = flow["first_seen"] or 0.0

    for (src, dst, port), num_flows in auth_attempts.items():
        svc = SENSITIVE_SERVICE_NAMES.get(port, f"Port {port}")
        tot_pkts = auth_pkts.get((src, dst, port), 0)
        if num_flows >= HeuristicConfig.BRUTE_FORCE_FLOWS or tot_pkts >= HeuristicConfig.BRUTE_FORCE_PACKETS:
            _add_event(
                "brute_force_indicator", auth_first.get((src, dst, port), 0.0), src, dst, "TCP",
                "high",
                f"Authentication Service Probing: {num_flows} connection attempts ({tot_pkts} pkts) to {svc} ({dst}:{port}) from {src}.",
                port=port,
            )

    # ── 3. Malicious / Backdoor / C2 Port Activity ────────────────────────────
    for flow in flows:
        p = flow["dst_port"]
        if p in MALICIOUS_BACKDOOR_PORTS:
            svc_name = SENSITIVE_SERVICE_NAMES.get(p, f"Port {p}")
            _add_event(
                "backdoor_c2_indicator", flow["first_seen"] or 0.0,
                flow["src_ip"], flow["dst_ip"], flow["protocol"],
                "critical",
                f"Known Exploit/Backdoor Port Active: Communication on {svc_name} ({flow['dst_ip']}:{p}) with {flow['packet_count']} packets.",
                port=p,
            )

    # ── 4. ICMP Anomalies / Ping Flood ────────────────────────────────────────
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
                f"ICMP Anomaly: {win['icmp_count']} ICMP packets in temporal window from {src} to {dst}.",
            )

    # ── 5. Large Data Transfer / Potential Exfiltration ───────────────────────
    for flow in flows:
        if flow["byte_count"] >= HeuristicConfig.LARGE_TRANSFER_BYTES:
            _add_event(
                "large_transfer_indicator", flow["first_seen"] or 0.0,
                flow["src_ip"], flow["dst_ip"], flow["protocol"],
                "high",
                f"Large Data Transfer: {flow['byte_count']:,} bytes in single flow ({flow['src_ip']} → {flow['dst_ip']}:{flow['dst_port']}).",
                port=flow["dst_port"], bytes_count=flow["byte_count"],
            )

    # ── 6. High Packet Rate / Denial-of-Service Flood ─────────────────────────
    for win in windows:
        # Proper DoS heuristic: High packet rate AND low average packet size (< 250 bytes)
        # typical of SYN/UDP floods. Normal large file transfers have large packets (~1500B).
        avg_pkt_size = win["byte_count"] / max(1, win["packet_count"])
        is_dos = (win["connection_rate"] >= 1500) or (win["connection_rate"] >= 300 and avg_pkt_size < 250)
        
        if is_dos:
            pkts_in_win = [
                p for p in packets
                if win["window_start"] <= p["timestamp"] < win["window_end"]
            ]
            if not pkts_in_win:
                continue
                
            # Prevent false positive for heavy authorized internal traffic (like DNS)
            dominant_port = Counter(p["dst_port"] for p in pkts_in_win if p["dst_port"] > 0).most_common(1)
            if dominant_port and dominant_port[0][0] in HeuristicConfig.SAFE_INTERNAL_PORTS:
                continue

            src = pkts_in_win[0]["src_ip"]
            dst = pkts_in_win[0]["dst_ip"]
            _add_event(
                "high_rate_indicator", win["window_start"], src, dst, "TCP",
                "critical",
                f"Volumetric Anomaly: {win['connection_rate']:.1f} packets/sec (avg size: {avg_pkt_size:.0f}B) observed in window #{win['window_index']}.",
                bytes_count=win["byte_count"],
            )

    # ── 7. Malicious Application Payload Detection (DPI) ──────────────────────
    # Using the fast payload_hex extracted by dpkt across all layers (App, Net)
    MALICIOUS_SIGNATURES = [
        b"union select", b"1=1--", b"<script>", b"../../", b"/etc/passwd", 
        b"cmd.exe", b"/bin/sh", b"/bin/bash", b"powershell", b"wget ", b"curl ",
        b"nc -e", b"eval(", b"base64_decode"
    ]
    
    for pkt in packets:
        payload_hex = pkt.get("payload_hex", "")
        if not payload_hex:
            continue
            
        try:
            raw_bytes = bytes.fromhex(payload_hex)
            lower_bytes = raw_bytes.lower()
            
            for sig in MALICIOUS_SIGNATURES:
                if sig in lower_bytes:
                    sig_str = sig.decode("ascii", errors="ignore")
                    _add_event(
                        "malicious_payload_indicator", pkt["timestamp"], 
                        pkt["src_ip"], pkt["dst_ip"], pkt["protocol"],
                        "critical",
                        f"Malicious Application Payload Detected: Found signature '{sig_str}' in {pkt['protocol']} payload.",
                        port=pkt["dst_port"],
                        payload_info=f"Matched '{sig_str}' signature"
                    )
                    break
        except ValueError:
            pass

    events.sort(key=lambda e: e["timestamp"])
    return events


# ── Activity Timeline Builder ─────────────────────────────────────────────────

_STAGE_MAPPING = {
    "port_scan_indicator":      ("Reconnaissance",    "Port / Network Scan"),
    "brute_force_indicator":    ("Initial Access",    "Authentication Probing"),
    "icmp_anomaly":             ("Reconnaissance",    "ICMP Sweep / Flood"),
    "backdoor_c2_indicator":    ("Command & Control", "Backdoor / C2 Communication"),
    "large_transfer_indicator": ("Data Exfiltration", "High Volume Transfer"),
    "high_rate_indicator":      ("Impact",            "Traffic Flood / DoS"),
}


def _build_activity_timeline(
    suspicious_events: list[dict],
    windows: list[dict],
) -> list[dict]:
    timeline: list[dict] = []

    for event in suspicious_events:
        stage, label = _STAGE_MAPPING.get(event["type"], ("Observed Activity", "Security Event"))
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
            "demo_label":  "Observed Security Indicator",
        })

    # Add baseline activity entries for windows without suspicious events
    for win in windows:
        if not any(
            win["window_start"] <= e["timestamp"] < win["window_end"]
            for e in suspicious_events
        ):
            timeline.append({
                "entry_type":  "normal",
                "timestamp":   win["window_start"],
                "stage":       "Normal Activity",
                "label":       "Traffic Baseline",
                "description": f"Window #{win['window_index']}: {win['packet_count']} pkts, {win['flow_count']} flows ({win['connection_rate']} pkt/s)",
                "severity":    "low",
                "src_ip":      "",
                "dst_ip":      "",
                "protocol":    "MIXED",
                "demo_label":  "Baseline Network Activity",
            })

    timeline.sort(key=lambda e: e["timestamp"])
    return timeline


# ── Entity Relationship Builder ───────────────────────────────────────────────

def _build_entity_relationships(
    flows: list[dict],
    suspicious_events: list[dict] | None = None,
) -> list[dict]:
    """
    Build entity relationship records for network graph rendering.
    Maps real host interactions and marks suspicious communication edges.
    """
    edge_map: dict[tuple[str, str], dict] = defaultdict(lambda: {
        "packet_count": 0, "byte_count": 0, "protocols": set(),
        "ports": set(), "first_seen": None, "last_seen": None,
    })

    for flow in flows:
        s = flow["src_ip"]
        d = flow["dst_ip"]
        if not s or not d or s == "0.0.0.0" or d == "0.0.0.0":
            continue
        key = (s, d)
        edge = edge_map[key]
        edge["packet_count"] += flow["packet_count"]
        edge["byte_count"]   += flow["byte_count"]
        edge["protocols"].add(flow["protocol"])
        if flow["dst_port"] and flow["dst_port"] > 0:
            edge["ports"].add(flow["dst_port"])
        if edge["first_seen"] is None or (flow["first_seen"] and flow["first_seen"] < edge["first_seen"]):
            edge["first_seen"] = flow["first_seen"]
        if edge["last_seen"] is None or (flow["last_seen"] and flow["last_seen"] > edge["last_seen"]):
            edge["last_seen"] = flow["last_seen"]

    # Build suspicious IP pairs set
    sus_pairs: set[tuple[str, str]] = set()
    if suspicious_events:
        for ev in suspicious_events:
            s_ip = ev.get("src_ip", "")
            d_ip = ev.get("dst_ip", "")
            if s_ip and d_ip:
                sus_pairs.add((s_ip, d_ip))

    relationships = []
    for (src, dst), data in edge_map.items():
        ports_list = sorted(data["ports"])
        is_sus = (
            (src, dst) in sus_pairs or
            any(p in MALICIOUS_BACKDOOR_PORTS for p in ports_list) or
            len(ports_list) >= 8 or
            (any(p in AUTH_PORTS for p in ports_list) and data["packet_count"] >= 10)
        )

        relationships.append({
            "src_ip":       src,
            "dst_ip":       dst,
            "packet_count": data["packet_count"],
            "byte_count":   data["byte_count"],
            "protocols":    sorted(data["protocols"]),
            "ports":        ports_list[:12],
            "first_seen":   data["first_seen"],
            "last_seen":    data["last_seen"],
            "is_suspicious": is_sus,
        })

    # Sort relationships by packet count descending
    relationships.sort(key=lambda r: r["packet_count"], reverse=True)
    return relationships

