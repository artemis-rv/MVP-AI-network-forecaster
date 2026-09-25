"""
NEXTRACE AI — Demo Packet Generator
Generates synthetic demo traffic metadata using Scapy (if available) or
pure-Python fallback. No packets are ever injected onto the real network.
All IPs are RFC 1918 private or RFC 5737 documentation ranges.
"""
from __future__ import annotations

import random
import time
from datetime import datetime, timezone
from typing import Optional

# ── Scapy: try to import for realistic packet size computation ─────────────────
# Scapy is used ONLY for building packet objects in memory — never for sending.
# Falls back gracefully if Scapy / Npcap is unavailable on this system.
SCAPY_AVAILABLE = False
try:
    import logging
    logging.getLogger("scapy.runtime").setLevel(logging.ERROR)
    from scapy.layers.inet import IP, TCP, UDP, ICMP  # type: ignore
    from scapy.layers.dns import DNS, DNSQR           # type: ignore
    SCAPY_AVAILABLE = True
except Exception:
    pass


# ── IP Pools (private / documentation ranges only) ───────────────────────────
_INTERNAL_HOSTS  = [f"192.168.1.{i}" for i in range(10, 17)]  # 7 workstations
_INTERNAL_SERVERS= [f"192.168.1.{i}" for i in range(100, 105)] # 5 servers
_INTERNAL_DB     = ["192.168.1.104"]
_EXTERNAL_DNS    = ["192.168.1.100"]
_EXTERNAL_WEB    = ["192.168.1.101", "192.168.1.102"]
_SUSPICIOUS_SRC  = ["10.0.0.5", "10.0.0.6"]

_COMMON_PORTS_TCP  = [80, 443, 22, 25, 587, 8080, 3389, 3306, 5432]
_COMMON_PORTS_UDP  = [53, 123, 161, 514]
_SUSPICIOUS_PORTS  = [4444, 8888, 31337, 1337, 6666, 9999, 4321, 54321]

_PROTOCOLS_BENIGN = ["TCP"] * 7 + ["UDP"] * 2 + ["ICMP"]

_FILES_BENIGN = ["index.php", "style.css", "report.pdf", "app.js", "logo.png", "update.zip"]
_FILES_SUSPICIOUS = ["shell.php", "payload.dll", "malware.exe", "config.bak", "dump.sql", "mimikatz.exe"]


def _ts() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _build_scapy_packet(proto: str, src: str, dst: str, sport: int, dport: int):
    """Build a Scapy packet in memory (never sent) to get a realistic byte size."""
    try:
        payload = b"X" * random.randint(0, 512)
        if proto == "TCP":
            return IP(src=src, dst=dst) / TCP(sport=sport, dport=dport) / payload
        if proto == "UDP":
            return IP(src=src, dst=dst) / UDP(sport=sport, dport=dport) / payload
        if proto == "ICMP":
            return IP(src=src, dst=dst) / ICMP()
    except Exception:
        pass
    return None


def _packet_size(proto: str, src: str, dst: str, sport: int, dport: int) -> int:
    """Return a realistic packet size in bytes."""
    if SCAPY_AVAILABLE:
        pkt = _build_scapy_packet(proto, src, dst, sport, dport)
        if pkt is not None:
            return len(pkt)
    # Fallback: realistic heuristics
    base = {"TCP": 40, "UDP": 28, "ICMP": 28, "DNS": 60, "HTTP": 200}.get(proto, 60)
    return base + random.randint(0, 1024)


# ─────────────────────────────────────────────────────────────────────────────
# Benign event generator
# ─────────────────────────────────────────────────────────────────────────────
def generate_benign_event() -> dict:
    proto = random.choice(_PROTOCOLS_BENIGN)
    src   = random.choice(_INTERNAL_HOSTS)

    # Mostly internal traffic, occasionally external DNS/web
    roll = random.random()
    if proto == "UDP" and roll < 0.6:
        dst   = random.choice(_EXTERNAL_DNS)
        dport = 53
        proto = "DNS"
    elif roll < 0.2:
        dst   = random.choice(_EXTERNAL_WEB)
        dport = random.choice([80, 443])
        proto = "HTTP" if dport == 80 else "TCP"
    else:
        dst   = random.choice(_INTERNAL_SERVERS + _INTERNAL_DB)
        dport = random.choice(_COMMON_PORTS_TCP if proto == "TCP" else _COMMON_PORTS_UDP)

    sport = random.randint(32768, 60999)
    size  = _packet_size(proto, src, dst, sport, dport)

    # Generate payload info
    payload_info = ""
    if proto == "HTTP":
        file = random.choice(_FILES_BENIGN)
        payload_info = f"GET /{file} HTTP/1.1" if dport == 80 else f"Application Data (TLS v1.3)"
    elif proto == "DNS":
        payload_info = f"Standard query 0x{random.randint(1000,9999)} A {random.choice(['google.com', 'microsoft.com', 'aws.amazon.com'])}"
    elif proto == "TCP":
        payload_info = f"{sport} > {dport} [ACK] Seq={random.randint(1,1000)} Ack={random.randint(1,1000)} Win={random.randint(1000, 65535)}"
    elif proto == "ICMP":
        payload_info = "Echo (ping) request"
    elif proto == "UDP":
        payload_info = f"Source port: {sport}  Destination port: {dport}"

    return {
        "timestamp":      _ts(),
        "protocol":       proto,
        "src_ip":         src,
        "dst_ip":         dst,
        "src_port":       sport,
        "dst_port":       dport,
        "packet_size":    size,
        "direction":      random.choice(["outbound", "inbound"]),
        "classification": "benign",
        "payload_info":   payload_info,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Suspicious (demo simulation) event generator
# ─────────────────────────────────────────────────────────────────────────────
_SUSPICIOUS_PATTERNS = [
    "port_scan",
    "brute_force",
    "lateral_movement",
    "unusual_dns",
    "data_staging",
]

def generate_suspicious_event() -> dict:
    pattern = random.choice(_SUSPICIOUS_PATTERNS)
    src     = random.choice(_SUSPICIOUS_SRC)

    if pattern == "port_scan":
        proto = "TCP"
        dst   = random.choice(_INTERNAL_SERVERS + _INTERNAL_HOSTS)
        dport = random.choice(_SUSPICIOUS_PORTS + list(range(1, 1024)))
        sport = random.randint(40000, 60000)
        classification = "suspicious"

    elif pattern == "brute_force":
        proto = "TCP"
        dst   = random.choice(_INTERNAL_SERVERS)
        dport = 22
        sport = random.randint(40000, 60000)
        classification = "suspicious"

    elif pattern == "lateral_movement":
        proto = "TCP"
        src   = random.choice(_INTERNAL_HOSTS[:5])   # compromised internal host
        dst   = random.choice(_INTERNAL_SERVERS + _INTERNAL_DB)
        dport = random.choice([135, 445, 3389, 5985])  # SMB/RDP/WinRM
        sport = random.randint(40000, 60000)
        classification = "suspicious"

    elif pattern == "unusual_dns":
        proto = "DNS"
        dst   = random.choice(_EXTERNAL_DNS)
        dport = 53
        sport = random.randint(40000, 60000)
        classification = "suspicious"

    else:  # data_staging
        proto = "TCP"
        dst   = random.choice(_EXTERNAL_WEB)
        dport = random.choice([443, 80, 8443])
        sport = random.randint(40000, 60000)
        classification = "suspicious"

    size = _packet_size(proto, src, dst, sport, dport)

    # Generate payload info based on pattern
    payload_info = ""
    if pattern == "port_scan":
        payload_info = f"{sport} > {dport} [SYN] Seq=0 Win=1024 Len=0"
    elif pattern == "brute_force":
        payload_info = f"SSH: Encrypted request packet len={size}"
    elif pattern == "lateral_movement":
        file = random.choice([f for f in _FILES_SUSPICIOUS if f.endswith(".exe") or f.endswith(".dll")])
        payload_info = f"SMB2 Read Response file: {file}" if dport == 445 else f"RPC Bind / Remote Execution"
    elif pattern == "unusual_dns":
        payload_info = f"Standard query 0x{random.randint(1000,9999)} TXT {random.choice(['malicious.ru', 'c2-server.net', 'drop.ninja'])}"
    else:  # data_staging
        file = random.choice([f for f in _FILES_SUSPICIOUS if f.endswith(".sql") or f.endswith(".bak")])
        payload_info = f"POST /{random.choice(_FILES_SUSPICIOUS)} HTTP/1.1 (Transferring {file})" if dport == 80 else f"Application Data (TLS v1.3)"

    return {
        "timestamp":      _ts(),
        "protocol":       proto,
        "src_ip":         src,
        "dst_ip":         dst,
        "src_port":       sport,
        "dst_port":       dport,
        "packet_size":    size,
        "direction":      "outbound",
        "classification": classification,
        "payload_info":   payload_info,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main generator function — called by the live session service
# ─────────────────────────────────────────────────────────────────────────────
def generate_event(mode: str) -> dict:
    """
    Generate one demo packet-event record.
    mode: "benign" or "suspicious"
    In suspicious mode: ~70 % suspicious events, 30 % benign background noise.
    In benign mode:     ~95 % benign, 5 % noise.
    """
    if mode == "suspicious":
        return (generate_suspicious_event() if random.random() < 0.70
                else generate_benign_event())
    else:
        return generate_benign_event()
