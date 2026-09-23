"""
NEXTRACE AI — Historical PCAP Parser
Uses Scapy to read .pcap / .pcapng files and extract per-packet records.
"""
from __future__ import annotations

import os
import struct
import logging
from typing import Any

logger = logging.getLogger(__name__)

# Protocol number → label
PROTO_MAP: dict[int, str] = {
    1:  "ICMP",
    6:  "TCP",
    17: "UDP",
    58: "ICMPv6",
}


def _read_pcap_scapy(path: str) -> list[dict[str, Any]]:
    """Read packets using Scapy."""
    try:
        from scapy.all import rdpcap, IP, IPv6, TCP, UDP, ICMP  # type: ignore
        packets = rdpcap(path)
        records = []
        for pkt in packets:
            try:
                record = _extract_scapy_packet(pkt, IP, IPv6, TCP, UDP, ICMP)
                if record:
                    records.append(record)
            except Exception:
                continue
        return records
    except Exception as exc:
        raise ValueError(f"Scapy could not read file: {exc}") from exc


def _extract_scapy_packet(pkt: Any, IP: Any, IPv6: Any, TCP: Any, UDP: Any, ICMP: Any) -> dict[str, Any] | None:
    """Extract fields from a single Scapy packet."""
    if IP not in pkt and IPv6 not in pkt:
        return None

    ts = float(pkt.time)
    size = len(pkt)

    if IP in pkt:
        src_ip = pkt[IP].src
        dst_ip = pkt[IP].dst
        proto_num = pkt[IP].proto
    else:
        src_ip = pkt[IPv6].src
        dst_ip = pkt[IPv6].dst
        proto_num = pkt[IPv6].nh

    proto = PROTO_MAP.get(proto_num, f"PROTO_{proto_num}")
    src_port = 0
    dst_port = 0
    flags = ""

    if TCP in pkt:
        src_port = pkt[TCP].sport
        dst_port = pkt[TCP].dport
        f = pkt[TCP].flags
        flags = str(f) if f else ""
    elif UDP in pkt:
        src_port = pkt[UDP].sport
        dst_port = pkt[UDP].dport

    return {
        "timestamp": ts,
        "src_ip":    src_ip,
        "dst_ip":    dst_ip,
        "src_port":  src_port,
        "dst_port":  dst_port,
        "protocol":  proto,
        "size":      size,
        "flags":     flags,
    }


def _validate_pcap_magic(path: str) -> None:
    """
    Check the file magic bytes to confirm it is a PCAP or PCAPNG file.
    Raises ValueError if not recognized.
    """
    PCAP_MAGIC_LE  = b"\xd4\xc3\xb2\xa1"
    PCAP_MAGIC_BE  = b"\xa1\xb2\xc3\xd4"
    PCAPNG_MAGIC   = b"\x0a\x0d\x0d\x0a"

    with open(path, "rb") as fh:
        magic = fh.read(4)

    if magic not in (PCAP_MAGIC_LE, PCAP_MAGIC_BE, PCAPNG_MAGIC):
        raise ValueError(
            "File does not appear to be a valid PCAP or PCAPNG. "
            f"Got magic bytes: {magic.hex()}"
        )


def parse_pcap(path: str) -> list[dict[str, Any]]:
    """
    Parse a PCAP/PCAPNG file and return a list of packet records.

    Raises:
        ValueError: If the file is not a valid PCAP, is empty, or cannot be parsed.
        FileNotFoundError: If the path does not exist.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"PCAP file not found: {path}")

    if os.path.getsize(path) == 0:
        raise ValueError("Uploaded file is empty.")

    _validate_pcap_magic(path)

    logger.info("Parsing PCAP: %s", path)
    packets = _read_pcap_scapy(path)
    logger.info("Parsed %d packets from %s", len(packets), path)
    return packets
