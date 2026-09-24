"""
NEXTRACE AI — Historical PCAP Parser
Robustly reads .pcap, .pcapng, .cap, and .gz capture files and extracts per-packet records.
Supports Classic PCAP (microsecond/nanosecond, LE/BE), PCAPNG, Linux cooked, VLAN, and ARP.
"""
from __future__ import annotations

import gzip
import io
import logging
import os
import struct
from typing import Any

logger = logging.getLogger(__name__)

# Protocol number -> label mapping (IANA assigned IP protocol numbers)
PROTO_MAP: dict[int, str] = {
    0:   "HOPOPT",
    1:   "ICMP",
    2:   "IGMP",
    6:   "TCP",
    17:  "UDP",
    41:  "IPv6-Route",
    47:  "GRE",
    50:  "ESP",
    51:  "AH",
    58:  "ICMPv6",
    89:  "OSPF",
    132: "SCTP",
}

# Common application port mappings for enriched protocol classification
APP_PORT_MAP: dict[int, str] = {
    21:    "FTP",
    22:    "SSH",
    23:    "TELNET",
    25:    "SMTP",
    53:    "DNS",
    67:    "DHCP",
    68:    "DHCP",
    80:    "HTTP",
    110:   "POP3",
    123:   "NTP",
    135:   "RPC",
    139:   "NetBIOS",
    143:   "IMAP",
    161:   "SNMP",
    162:   "SNMP-TRAP",
    389:   "LDAP",
    443:   "HTTPS",
    445:   "SMB",
    636:   "LDAPS",
    1433:  "MSSQL",
    1521:  "ORACLE",
    3306:  "MYSQL",
    3389:  "RDP",
    4444:  "METASPLOIT/C2",
    5432:  "POSTGRES",
    6379:  "REDIS",
    6667:  "IRC",
    8000:  "HTTP-ALT",
    8080:  "HTTP-PROXY",
    8443:  "HTTPS-ALT",
    27017: "MONGODB",
}

# Known PCAP Magic Bytes
VALID_MAGIC_PREFIXES = (
    b"\xd4\xc3\xb2\xa1",  # Standard PCAP Little-Endian (Microsecond)
    b"\xa1\xb2\xc3\xd4",  # Standard PCAP Big-Endian (Microsecond)
    b"\x4d\x3c\xb2\xa1",  # Standard PCAP Little-Endian (Nanosecond)
    b"\xa1\xb2\x3c\x4d",  # Standard PCAP Big-Endian (Nanosecond)
    b"\x34\xcd\xb2\xa1",  # Modified PCAP Little-Endian (Alexey Kuznetzov)
    b"\xa1\xb2\xcd\x34",  # Modified PCAP Big-Endian
    b"\x0a\x0d\x0d\x0a",  # PCAPNG Section Header Block (\n\r\r\n)
    b"\x1f\x8b",          # Gzip-compressed PCAP
)


def _decompress_if_gzipped(path: str) -> str:
    """If file is gzipped, decompress to a temporary .pcap file and return path."""
    with open(path, "rb") as fh:
        magic = fh.read(2)
    if magic == b"\x1f\x8b":
        import tempfile
        decompressed_fd, decompressed_path = tempfile.mkstemp(suffix=".pcap", prefix="nextrace_decomp_")
        with open(path, "rb") as gz_in, os.fdopen(decompressed_fd, "wb") as out:
            with gzip.GzipFile(fileobj=gz_in) as gz:
                while chunk := gz.read(65536):
                    out.write(chunk)
        return decompressed_path
    return path


def _extract_scapy_packet(pkt: Any) -> dict[str, Any] | None:
    """Extract standard fields from a Scapy packet object safely."""
    try:
        from scapy.layers.inet import IP, TCP, UDP, ICMP  # type: ignore
        from scapy.layers.inet6 import IPv6  # type: ignore
        from scapy.layers.l2 import ARP  # type: ignore
    except ImportError:
        try:
            from scapy.all import IP, IPv6, TCP, UDP, ICMP, ARP  # type: ignore
        except Exception:
            return None

    try:
        ts = float(getattr(pkt, "time", 0.0))
        size = len(pkt)
    except Exception:
        ts = 0.0
        size = 64

    src_ip = "0.0.0.0"
    dst_ip = "0.0.0.0"
    proto_num = 0
    proto_name = "OTHER"

    # Layer 3 / Layer 2 IP resolution
    if pkt.haslayer(IP):
        ip = pkt[IP]
        src_ip = str(ip.src)
        dst_ip = str(ip.dst)
        proto_num = int(ip.proto)
        proto_name = PROTO_MAP.get(proto_num, f"IP-{proto_num}")
    elif pkt.haslayer(IPv6):
        ip6 = pkt[IPv6]
        src_ip = str(ip6.src)
        dst_ip = str(ip6.dst)
        proto_num = int(getattr(ip6, "nh", 0))
        proto_name = PROTO_MAP.get(proto_num, f"IPv6-{proto_num}")
    elif pkt.haslayer(ARP):
        arp = pkt[ARP]
        src_ip = str(getattr(arp, "psrc", "0.0.0.0"))
        dst_ip = str(getattr(arp, "pdst", "0.0.0.0"))
        proto_name = "ARP"
    else:
        # Check if there is any IP payload inside other link-layer wrappings
        layers = []
        curr = pkt
        while curr:
            name = curr.__class__.__name__
            if name in ("IP", "IPv6", "ARP"):
                if name == "IP":
                    src_ip = str(curr.src)
                    dst_ip = str(curr.dst)
                    proto_num = int(curr.proto)
                    proto_name = PROTO_MAP.get(proto_num, f"IP-{proto_num}")
                elif name == "IPv6":
                    src_ip = str(curr.src)
                    dst_ip = str(curr.dst)
                    proto_num = int(getattr(curr, "nh", 0))
                    proto_name = PROTO_MAP.get(proto_num, f"IPv6-{proto_num}")
                elif name == "ARP":
                    src_ip = str(getattr(curr, "psrc", "0.0.0.0"))
                    dst_ip = str(getattr(curr, "pdst", "0.0.0.0"))
                    proto_name = "ARP"
                break
            curr = getattr(curr, "payload", None)
        if proto_name == "OTHER" and src_ip == "0.0.0.0":
            return None

    src_port = 0
    dst_port = 0
    flags = ""

    if pkt.haslayer(TCP):
        tcp = pkt[TCP]
        src_port = int(tcp.sport)
        dst_port = int(tcp.dport)
        f = getattr(tcp, "flags", "")
        flags = str(f) if f else ""
        proto_name = "TCP"
    elif pkt.haslayer(UDP):
        udp = pkt[UDP]
        src_port = int(udp.sport)
        dst_port = int(udp.dport)
        proto_name = "UDP"
    elif pkt.haslayer(ICMP):
        proto_name = "ICMP"

    return {
        "timestamp": ts,
        "src_ip":    src_ip,
        "dst_ip":    dst_ip,
        "src_port":  src_port,
        "dst_port":  dst_port,
        "protocol":  proto_name,
        "size":      size,
        "flags":     flags,
    }


def _read_pcap_stream(path: str) -> list[dict[str, Any]]:
    """
    Stream packets from PCAP / PCAPNG using Scapy PcapReader / PcapNgReader / rdpcap.
    Continues smoothly even if some packets contain malformed bytes.
    """
    records: list[dict[str, Any]] = []

    # First attempt: Streaming PcapReader / PcapNgReader
    try:
        from scapy.utils import PcapReader, PcapNgReader  # type: ignore
        reader_cls = PcapNgReader if path.endswith(".pcapng") else PcapReader
        with reader_cls(path) as reader:
            for pkt in reader:
                try:
                    rec = _extract_scapy_packet(pkt)
                    if rec:
                        records.append(rec)
                except Exception:
                    continue
        if records:
            return records
    except Exception as exc:
        logger.debug("PcapReader streaming failed or returned 0 packets (%s), trying rdpcap fallback", exc)

    # Second attempt: rdpcap
    try:
        from scapy.all import rdpcap  # type: ignore
        packets = rdpcap(path)
        for pkt in packets:
            try:
                rec = _extract_scapy_packet(pkt)
                if rec:
                    records.append(rec)
            except Exception:
                continue
        if records:
            return records
    except Exception as exc:
        logger.warning("rdpcap failed: %s", exc)

    # Third attempt: Direct binary fallback parser for classic libpcap
    try:
        binary_records = _parse_pcap_binary_fallback(path)
        if binary_records:
            return binary_records
    except Exception as exc:
        logger.warning("Binary fallback parser failed: %s", exc)

    if not records:
        raise ValueError(
            "Could not parse any valid IP/ARP packets from the capture file. "
            "Please ensure the file is a valid .pcap or .pcapng network capture."
        )

    return records


def _parse_pcap_binary_fallback(path: str) -> list[dict[str, Any]]:
    """
    Pure Python binary parser for standard libpcap files.
    Ensures that standard PCAPs parse even if Scapy link-type bindings fail.
    """
    records: list[dict[str, Any]] = []
    with open(path, "rb") as fh:
        hdr = fh.read(24)
        if len(hdr) < 24:
            return []
        magic = hdr[:4]
        if magic in (b"\xd4\xc3\xb2\xa1", b"\x4d\x3c\xb2\xa1"):
            endian = "<"
            is_nano = magic == b"\x4d\x3c\xb2\xa1"
        elif magic in (b"\xa1\xb2\xc3\xd4", b"\xa1\xb2\x3c\x4d"):
            endian = ">"
            is_nano = magic == b"\xa1\xb2\x3c\x4d"
        else:
            return []

        link_type = struct.unpack(f"{endian}I", hdr[20:24])[0]

        while True:
            pkt_hdr = fh.read(16)
            if len(pkt_hdr) < 16:
                break
            ts_sec, ts_usec, caplen, origlen = struct.unpack(f"{endian}IIII", pkt_hdr)
            pkt_data = fh.read(caplen)
            if len(pkt_data) < caplen:
                break

            ts = ts_sec + (ts_usec / 1e9 if is_nano else ts_usec / 1e6)
            parsed = _parse_ip_raw_bytes(pkt_data, link_type)
            if parsed:
                parsed["timestamp"] = ts
                parsed["size"] = origlen
                records.append(parsed)

    return records


def _parse_ip_raw_bytes(data: bytes, link_type: int) -> dict[str, Any] | None:
    """Parse raw Ethernet/IP bytes into record dict."""
    import socket
    offset = 0
    # Ethernet (link_type 1)
    if link_type == 1:
        if len(data) < 14:
            return None
        eth_type = struct.unpack(">H", data[12:14])[0]
        offset = 14
        if eth_type == 0x8100:  # 802.1Q VLAN
            eth_type = struct.unpack(">H", data[16:18])[0]
            offset = 18
        if eth_type != 0x0800:  # Not IPv4
            return None
    # Linux Cooked SLL (link_type 113)
    elif link_type == 113:
        if len(data) < 16:
            return None
        eth_type = struct.unpack(">H", data[14:16])[0]
        offset = 16
        if eth_type != 0x0800:
            return None
    # Raw IP (link_type 101 or 12)
    elif link_type in (101, 12):
        offset = 0
    else:
        # Try finding IPv4 header signature
        for idx in range(0, min(32, len(data) - 20)):
            if (data[idx] >> 4) == 4 and (data[idx] & 0x0F) >= 5:
                offset = idx
                break
        else:
            return None

    ip_data = data[offset:]
    if len(ip_data) < 20:
        return None

    ver_ihl = ip_data[0]
    ihl = (ver_ihl & 0x0F) * 4
    if len(ip_data) < ihl:
        return None

    proto_num = ip_data[9]
    src_ip = socket.inet_ntoa(ip_data[12:16])
    dst_ip = socket.inet_ntoa(ip_data[16:20])

    proto_name = PROTO_MAP.get(proto_num, f"IP-{proto_num}")
    src_port = 0
    dst_port = 0
    flags = ""

    payload = ip_data[ihl:]
    if proto_num == 6 and len(payload) >= 14:  # TCP
        src_port, dst_port = struct.unpack(">HH", payload[0:4])
        proto_name = "TCP"
        flag_byte = payload[13]
        f_list = []
        if flag_byte & 0x01: f_list.append("F")
        if flag_byte & 0x02: f_list.append("S")
        if flag_byte & 0x04: f_list.append("R")
        if flag_byte & 0x08: f_list.append("P")
        if flag_byte & 0x10: f_list.append("A")
        if flag_byte & 0x20: f_list.append("U")
        flags = "".join(f_list)
    elif proto_num == 17 and len(payload) >= 4:  # UDP
        src_port, dst_port = struct.unpack(">HH", payload[0:4])
        proto_name = "UDP"
    elif proto_num == 1:
        proto_name = "ICMP"

    return {
        "timestamp": 0.0,
        "src_ip":    src_ip,
        "dst_ip":    dst_ip,
        "src_port":  src_port,
        "dst_port":  dst_port,
        "protocol":  proto_name,
        "size":      len(data),
        "flags":     flags,
    }


def parse_pcap(path: str) -> list[dict[str, Any]]:
    """
    Parse a real PCAP/PCAPNG/CAP/GZ file and return structured packet records.
    """
    if not os.path.exists(path):
        raise FileNotFoundError(f"PCAP file not found: {path}")

    if os.path.getsize(path) == 0:
        raise ValueError("Uploaded file is empty.")

    # Check magic bytes / file signature
    actual_path = _decompress_if_gzipped(path)
    is_temp_decomp = actual_path != path

    try:
        with open(actual_path, "rb") as fh:
            magic = fh.read(4)

        has_valid_magic = any(
            magic.startswith(prefix) or prefix.startswith(magic)
            for prefix in VALID_MAGIC_PREFIXES
        )
        if not has_valid_magic:
            logger.warning(
                "Non-standard magic bytes: %s (attempting parse anyway)", magic.hex()
            )

        logger.info("Parsing PCAP file: %s (%d bytes)", path, os.path.getsize(actual_path))
        packets = _read_pcap_stream(actual_path)
        logger.info("Successfully extracted %d packet records from %s", len(packets), path)
        return packets
    finally:
        if is_temp_decomp and os.path.exists(actual_path):
            try:
                os.unlink(actual_path)
            except Exception:
                pass

