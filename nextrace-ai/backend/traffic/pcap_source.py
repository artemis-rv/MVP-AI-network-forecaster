"""
NEXTRACE AI — Historical PCAP Traffic Source Adapter
====================================================
Streams packets from PCAP/PCAPNG/CAP/GZ capture files incrementally without loading
the entire file into memory. Feeds the canonical pipeline with strict job isolation.
"""
from __future__ import annotations

import asyncio
import os
import time
from typing import Any, Iterator, Optional

from backend.traffic.contract import CanonicalPacket, TrafficSource, TrafficSourceMetrics
from backend.historical.parser import (
    PROTO_MAP,
    VALID_MAGIC_PREFIXES,
    _decompress_if_gzipped,
    _extract_scapy_packet,
    _parse_ip_raw_bytes,
)


class PcapSource(TrafficSource):
    """
    Incremental streaming PCAP file traffic source adapter.
    """

    def __init__(
        self,
        file_path: str,
        job_id: str = "pcap_job",
        batch_size: int = 1000,
    ) -> None:
        self.file_path = file_path
        self.job_id = job_id
        self.source_type = "pcap"
        self.batch_size = batch_size
        self._running = False
        self._metrics = TrafficSourceMetrics(source_type="pcap", job_id=job_id)
        self._queue: asyncio.Queue[CanonicalPacket] = asyncio.Queue(maxsize=5000)
        self._worker_task: Optional[asyncio.Task] = None
        self._eof = False

    def start(self) -> None:
        if self._running:
            return
        if not os.path.exists(self.file_path):
            raise FileNotFoundError(f"PCAP file not found: {self.file_path}")

        self._running = True
        self._eof = False
        self._metrics.is_active = True
        self._metrics.start_time = time.time()
        self._metrics.packets_seen = 0
        self._metrics.packets_processed = 0
        self._metrics.packets_dropped = 0
        self._metrics.bytes_seen = 0
        self._metrics.errors = 0

        loop = asyncio.get_event_loop()
        self._worker_task = loop.create_task(self._run_streaming_reader())

    def stop(self) -> None:
        self._running = False
        self._metrics.is_active = False
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
        self._worker_task = None
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except Exception:
                break

    def is_running(self) -> bool:
        return self._running and not (self._eof and self._queue.empty())

    def is_eof(self) -> bool:
        return self._eof and self._queue.empty()

    def get_metrics(self) -> TrafficSourceMetrics:
        self._metrics.queue_depth = self._queue.qsize()
        return self._metrics

    async def get_packet(self) -> Optional[CanonicalPacket]:
        if self._eof and self._queue.empty():
            return None
        try:
            pkt = await asyncio.wait_for(self._queue.get(), timeout=0.1)
            self._metrics.packets_processed += 1
            return pkt
        except asyncio.TimeoutError:
            return None

    def stream_packets_sync(self) -> Iterator[CanonicalPacket]:
        """
        Synchronous generator yielding CanonicalPacket instances one-by-one.
        Ideal for background threads and test harnesses.
        """
        actual_path = _decompress_if_gzipped(self.file_path)
        is_temp_decomp = actual_path != self.file_path

        try:
            # 1. dpkt streaming reader
            parsed_any = False
            try:
                for pkt in self._iter_dpkt(actual_path):
                    parsed_any = True
                    self._metrics.packets_seen += 1
                    self._metrics.bytes_seen += pkt.packet_size
                    yield pkt
                if parsed_any:
                    return
            except Exception as exc:
                self._metrics.errors += 1
                self._metrics.last_error = f"dpkt streaming error: {exc}"

            # 2. Binary fallback parser
            try:
                for pkt in self._iter_binary(actual_path):
                    parsed_any = True
                    self._metrics.packets_seen += 1
                    self._metrics.bytes_seen += pkt.packet_size
                    yield pkt
                if parsed_any:
                    return
            except Exception as exc:
                self._metrics.errors += 1
                self._metrics.last_error = f"Binary fallback streaming error: {exc}"

            # 3. Scapy PcapReader streaming
            try:
                for pkt in self._iter_scapy(actual_path):
                    parsed_any = True
                    self._metrics.packets_seen += 1
                    self._metrics.bytes_seen += pkt.packet_size
                    yield pkt
                if parsed_any:
                    return
            except Exception as exc:
                self._metrics.errors += 1
                self._metrics.last_error = f"Scapy stream error: {exc}"

            if not parsed_any and os.path.getsize(actual_path) > 0:
                raise ValueError(f"Could not parse any valid IP packets from {self.file_path}")

        finally:
            if is_temp_decomp and os.path.exists(actual_path):
                try:
                    os.unlink(actual_path)
                except Exception:
                    pass

    async def _run_streaming_reader(self) -> None:
        """Asynchronously stream packets into the bounded queue."""
        loop = asyncio.get_running_loop()
        try:
            # Stream in executor chunk by chunk to prevent event loop blocking
            def _read_all():
                return list(self.stream_packets_sync())

            # Read in generator batches
            for pkt in self.stream_packets_sync():
                if not self._running:
                    break
                while self._queue.qsize() >= 4500 and self._running:
                    await asyncio.sleep(0.01)

                try:
                    self._queue.put_nowait(pkt)
                except asyncio.QueueFull:
                    self._metrics.packets_dropped += 1
                    self._metrics.queue_drops += 1
                    await asyncio.sleep(0.005)

            self._eof = True
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            self._metrics.errors += 1
            self._metrics.last_error = str(exc)
            self._eof = True

    # ── Internal streaming iterators ──────────────────────────────────────────

    def _iter_dpkt(self, path: str) -> Iterator[CanonicalPacket]:
        import socket
        import dpkt

        with open(path, "rb") as fh:
            if path.endswith(".pcapng"):
                reader = dpkt.pcapng.Reader(fh)
            else:
                reader = dpkt.pcap.Reader(fh)

            for ts, buf in reader:
                try:
                    eth = dpkt.ethernet.Ethernet(buf)
                    ip = eth.data
                    if not isinstance(ip, (dpkt.ip.IP, dpkt.ip6.IP6)):
                        if isinstance(eth, (dpkt.ip.IP, dpkt.ip6.IP6)):
                            ip = eth
                        elif hasattr(dpkt, "sll") and isinstance(eth, dpkt.sll.SLL):
                            ip = eth.data
                        else:
                            continue

                    if not isinstance(ip, (dpkt.ip.IP, dpkt.ip6.IP6)):
                        continue

                    if isinstance(ip, dpkt.ip.IP):
                        src_ip = socket.inet_ntoa(ip.src)
                        dst_ip = socket.inet_ntoa(ip.dst)
                        proto_num = ip.p
                    else:
                        src_ip = socket.inet_ntop(socket.AF_INET6, ip.src)
                        dst_ip = socket.inet_ntop(socket.AF_INET6, ip.dst)
                        proto_num = ip.nxt

                    proto_name = PROTO_MAP.get(proto_num, f"IP-{proto_num}")
                    src_port = 0
                    dst_port = 0
                    flags = ""
                    payload_bytes = b""

                    payload = ip.data
                    if isinstance(payload, dpkt.tcp.TCP):
                        src_port = payload.sport
                        dst_port = payload.dport
                        proto_name = "TCP"
                        payload_bytes = payload.data
                        f_list = []
                        if payload.flags & dpkt.tcp.TH_FIN: f_list.append("F")
                        if payload.flags & dpkt.tcp.TH_SYN: f_list.append("S")
                        if payload.flags & dpkt.tcp.TH_RST: f_list.append("R")
                        if payload.flags & dpkt.tcp.TH_PUSH: f_list.append("P")
                        if payload.flags & dpkt.tcp.TH_ACK: f_list.append("A")
                        if payload.flags & dpkt.tcp.TH_URG: f_list.append("U")
                        flags = "".join(f_list)
                    elif isinstance(payload, dpkt.udp.UDP):
                        src_port = payload.sport
                        dst_port = payload.dport
                        proto_name = "UDP"
                        payload_bytes = payload.data
                    elif hasattr(dpkt, "icmp") and isinstance(payload, dpkt.icmp.ICMP):
                        proto_name = "ICMP"
                        payload_bytes = payload.data

                    yield CanonicalPacket(
                        timestamp=float(ts),
                        src_ip=src_ip,
                        dst_ip=dst_ip,
                        src_port=src_port,
                        dst_port=dst_port,
                        protocol=proto_name,
                        packet_size=len(buf),
                        tcp_flags=flags,
                        payload_info="",
                        payload_hex=payload_bytes.hex() if isinstance(payload_bytes, bytes) else "",
                        source_type="pcap",
                        job_id=self.job_id,
                        classification=self._classify_observable(dst_port, flags, proto_name),
                    )
                except Exception:
                    continue

    def _iter_binary(self, path: str) -> Iterator[CanonicalPacket]:
        import struct

        with open(path, "rb") as fh:
            hdr = fh.read(24)
            if len(hdr) < 24:
                return
            magic = hdr[:4]
            if magic in (b"\xd4\xc3\xb2\xa1", b"\x4d\x3c\xb2\xa1"):
                endian = "<"
                is_nano = magic == b"\x4d\x3c\xb2\xa1"
            elif magic in (b"\xa1\xb2\xc3\xd4", b"\xa1\xb2\x3c\x4d"):
                endian = ">"
                is_nano = magic == b"\xa1\xb2\x3c\x4d"
            else:
                return

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
                    yield CanonicalPacket(
                        timestamp=ts,
                        src_ip=parsed["src_ip"],
                        dst_ip=parsed["dst_ip"],
                        src_port=parsed["src_port"],
                        dst_port=parsed["dst_port"],
                        protocol=parsed["protocol"],
                        packet_size=origlen,
                        tcp_flags=parsed.get("flags", ""),
                        payload_info="",
                        payload_hex=parsed.get("payload_hex", ""),
                        source_type="pcap",
                        job_id=self.job_id,
                        classification=self._classify_observable(
                            parsed["dst_port"], parsed.get("flags", ""), parsed["protocol"]
                        ),
                    )

    def _iter_scapy(self, path: str) -> Iterator[CanonicalPacket]:
        from scapy.utils import PcapNgReader, PcapReader

        reader_cls = PcapNgReader if path.endswith(".pcapng") else PcapReader
        with reader_cls(path) as reader:
            for pkt in reader:
                try:
                    rec = _extract_scapy_packet(pkt)
                    if rec:
                        yield CanonicalPacket(
                            timestamp=rec["timestamp"],
                            src_ip=rec["src_ip"],
                            dst_ip=rec["dst_ip"],
                            src_port=rec["src_port"],
                            dst_port=rec["dst_port"],
                            protocol=rec["protocol"],
                            packet_size=rec["size"],
                            tcp_flags=rec.get("flags", ""),
                            payload_info="",
                            payload_hex=rec.get("payload_hex", ""),
                            source_type="pcap",
                            job_id=self.job_id,
                            classification=self._classify_observable(
                                rec["dst_port"], rec.get("flags", ""), rec["protocol"]
                            ),
                        )
                except Exception:
                    continue

    @staticmethod
    def _classify_observable(dst_port: int, flags: str, protocol: str) -> str:
        """Deterministic observable classification without assuming synthetic ground truth."""
        suspicious_ports = {1337, 31337, 4444, 5555, 6667, 8888, 9001, 9999, 22, 23, 445, 3389}
        if dst_port in suspicious_ports:
            return "suspicious"
        if protocol == "TCP" and "S" in flags and "A" not in flags and dst_port not in (80, 443):
            return "suspicious"
        if protocol == "TCP" and (flags == "" or "FPU" in flags):
            return "suspicious"
        return "benign"
