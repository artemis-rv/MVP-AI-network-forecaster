"""
NEXTRACE AI — Dumpcap Decoupled Live Network Capture Source Adapter
===================================================================
Captures live network packets via Npcap and Dumpcap writing rotating PCAPNG chunks.
Streaming worker decodes raw PCAPNG files into normalized CanonicalPackets.
Completely decouples packet acquisition from downstream feature extraction and forecasting.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import shutil
import time
from typing import Any, Optional

from backend.traffic.contract import CanonicalPacket, TrafficSource, TrafficSourceMetrics
from backend.traffic.discovery import (
    discover_network_interfaces,
    find_dumpcap_executable,
    get_recommended_interface,
)
from backend.traffic.dumpcap_capture import DumpcapCaptureProcess, compute_file_sha256
from backend.historical.parser import _extract_scapy_packet

logger = logging.getLogger(__name__)


def get_network_interfaces() -> list[dict[str, Any]]:
    """Expose interface discovery to other modules and REST API."""
    return discover_network_interfaces()


class LiveCaptureSource(TrafficSource):
    """
    Decoupled Live Network Capture Source utilizing Npcap + Dumpcap rotating PCAPNG chunks.
    """

    def __init__(
        self,
        interface: str = "5",
        bpf_filter: str = "",
        job_id: str = "live_capture_session",
        max_queue_size: int = 10000,
        chunk_duration_seconds: int = 2,
    ) -> None:
        self.interface = str(interface)
        self.bpf_filter = bpf_filter.strip()
        self.job_id = job_id
        self.source_type = "live"
        self.max_queue_size = max_queue_size
        self.chunk_duration_seconds = chunk_duration_seconds

        self._running = False
        self._metrics = TrafficSourceMetrics(
            source_type="live",
            job_id=job_id,
            health_status="STOPPED",
        )
        self._queue: asyncio.Queue[CanonicalPacket] = asyncio.Queue(maxsize=max_queue_size)
        
        # Dumpcap process manager
        self._dumpcap_proc: Optional[DumpcapCaptureProcess] = None
        self._reader_task: Optional[asyncio.Task] = None
        self._health_task: Optional[asyncio.Task] = None

        # Interface friendly name
        self.interface_name = self._resolve_interface_name(self.interface)

        # Processed chunks tracker
        self._processed_chunks: set[str] = set()
        self._chunk_hashes: dict[str, str] = {}
        self._chunk_packets: dict[str, int] = {}
        self._last_processed_pkt_time: float = 0.0

    def _resolve_interface_name(self, iface_id: str) -> str:
        try:
            ifaces = discover_network_interfaces()
            found = next((i for i in ifaces if str(i["index"]) == str(iface_id) or i["id"] == str(iface_id)), None)
            if found:
                return found["name"]
        except Exception:
            pass
        return str(iface_id)

    def start(self) -> None:
        if self._running:
            return

        self._running = True
        self._metrics.is_active = True
        self._metrics.health_status = "STARTING"
        self._metrics.status_message = f"Initializing live capture on interface {self.interface_name}..."
        self._metrics.start_time = time.time()
        self._metrics.packets_captured = 0
        self._metrics.bytes_captured = 0
        self._metrics.capture_drops = 0
        self._metrics.packets_parsed = 0
        self._metrics.parser_errors = 0
        self._metrics.packets_processed = 0
        self._metrics.queue_drops = 0
        self._metrics.flows_created = 0
        self._metrics.errors = 0
        self._metrics.last_error = None

        self._processed_chunks.clear()
        self._chunk_hashes.clear()
        self._chunk_packets.clear()

        # Initialize dumpcap capture process
        base_dir = os.path.join("captures", "live")
        self._dumpcap_proc = DumpcapCaptureProcess(
            interface=self.interface,
            session_id=self.job_id,
            base_dir=base_dir,
            chunk_duration_seconds=self.chunk_duration_seconds,
            buffer_size_mb=64,
            bpf_filter=self.bpf_filter,
        )

        try:
            self._dumpcap_proc.start()
        except Exception as exc:
            self._metrics.health_status = "FAILED"
            self._metrics.status_message = f"Failed to start dumpcap: {exc}"
            self._metrics.errors += 1
            self._metrics.last_error = str(exc)
            logger.error("Dumpcap start failed: %s", exc)
            return

        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            loop = asyncio.get_event_loop()

        self._reader_task = loop.create_task(self._run_chunk_streamer())
        self._health_task = loop.create_task(self._run_health_monitor())

    def stop(self) -> None:
        self._running = False
        self._metrics.is_active = False
        self._metrics.health_status = "STOPPED"
        self._metrics.status_message = "Live capture stopped."

        if self._dumpcap_proc:
            exit_code, stderr = self._dumpcap_proc.stop()
            if exit_code != 0 and exit_code != -9 and exit_code != 15:
                logger.debug("Dumpcap process stopped with exit code %s: %s", exit_code, stderr)
            self._dumpcap_proc = None

        if self._reader_task and not self._reader_task.done():
            self._reader_task.cancel()
        if self._health_task and not self._health_task.done():
            self._health_task.cancel()

        self._reader_task = None
        self._health_task = None

        # Drain queue
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except Exception:
                break

    def is_running(self) -> bool:
        return self._running

    def get_metrics(self) -> TrafficSourceMetrics:
        self._metrics.queue_depth = self._queue.qsize()
        now = time.time()
        start_t = self._metrics.start_time or now
        elapsed = max(0.1, now - start_t)

        self._metrics.capture_pps = round(self._metrics.packets_captured / elapsed, 2)
        self._metrics.processing_pps = round(self._metrics.packets_processed / elapsed, 2)
        self._metrics.capture_mbps = round((self._metrics.bytes_captured * 8.0) / (elapsed * 1_000_000.0), 3)

        return self._metrics

    async def get_packet(self) -> Optional[CanonicalPacket]:
        if not self._running and self._queue.empty():
            return None
        try:
            pkt = await asyncio.wait_for(self._queue.get(), timeout=0.05)
            self._metrics.packets_processed += 1
            return pkt
        except asyncio.TimeoutError:
            return None

    # ─── Streaming Chunk Reader ────────────────────────────────

    async def _run_chunk_streamer(self) -> None:
        """
        Polls for rotating PCAPNG chunk files created by dumpcap and streams packets into queue.
        """
        while self._running:
            try:
                if not self._dumpcap_proc:
                    break

                chunk_files = self._dumpcap_proc.get_chunk_files()
                
                # If there are multiple chunks, all chunks except the newest are guaranteed closed.
                # If there is 1 chunk, we can attempt non-blocking reading of available packets.
                for idx, chunk_path in enumerate(chunk_files):
                    is_newest = (idx == len(chunk_files) - 1)
                    
                    if chunk_path in self._processed_chunks:
                        continue

                    # If this is the newest chunk and dumpcap is actively writing it,
                    # we only read it when either it has grown or we wait for next rotation.
                    if is_newest and len(chunk_files) > 1:
                        # Process closed predecessor chunks first
                        pass

                    # Parse chunk
                    await self._parse_chunk_file(chunk_path, is_closed=not is_newest)

                    if not is_newest:
                        self._processed_chunks.add(chunk_path)
                        try:
                            self._chunk_hashes[chunk_path] = compute_file_sha256(chunk_path)
                        except Exception:
                            pass

                await asyncio.sleep(0.5)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                self._metrics.errors += 1
                self._metrics.last_error = f"Chunk streamer error: {exc}"
                logger.error("Chunk streamer error: %s", exc)
                await asyncio.sleep(1.0)

    async def _parse_chunk_file(self, chunk_path: str, is_closed: bool) -> None:
        """Read packets from a PCAPNG file and enqueue CanonicalPackets."""
        if not os.path.exists(chunk_path) or os.path.getsize(chunk_path) == 0:
            return

        try:
            from scapy.utils import PcapNgReader
            # Scapy PcapNgReader handles partial and completed PCAPNG files
            reader = PcapNgReader(chunk_path)
            chunk_pkt_count = 0
            chunk_bytes = 0

            # Determine how many packets we already parsed from this chunk if partial
            skip_count = self._chunk_packets.get(chunk_path, 0)
            cur_idx = 0

            for pkt_obj in reader:
                cur_idx += 1
                if cur_idx <= skip_count:
                    continue

                rec = _extract_scapy_packet(pkt_obj)
                if not rec:
                    continue

                chunk_pkt_count += 1
                chunk_bytes += rec.get("size", 64)

                ts = rec.get("timestamp") or time.time()
                proto = rec.get("protocol", "OTHER")
                dport = rec.get("dst_port", 0)
                flags = rec.get("flags", "")
                classification = self._classify_packet(dport, flags, proto)

                canon_pkt = CanonicalPacket(
                    timestamp=ts,
                    src_ip=rec.get("src_ip", "0.0.0.0"),
                    dst_ip=rec.get("dst_ip", "0.0.0.0"),
                    src_port=rec.get("src_port", 0),
                    dst_port=dport,
                    protocol=proto,
                    packet_size=rec.get("size", 64),
                    tcp_flags=flags,
                    direction="outbound",
                    interface=self.interface_name,
                    payload_info="",
                    payload_hex=rec.get("payload_hex", ""),
                    source_type="live",
                    job_id=self.job_id,
                    classification=classification,
                )

                self._metrics.packets_captured += 1
                self._metrics.bytes_captured += canon_pkt.packet_size
                self._metrics.packets_parsed += 1

                now_ts = time.time()
                self._last_processed_pkt_time = now_ts
                self._metrics.processing_lag_ms = max(0.0, round((now_ts - ts) * 1000.0, 2))

                try:
                    self._queue.put_nowait(canon_pkt)
                except asyncio.QueueFull:
                    self._metrics.queue_drops += 1
                    self._metrics.capture_drops += 1

            self._chunk_packets[chunk_path] = cur_idx

        except Exception as exc:
            self._metrics.parser_errors += 1
            logger.debug("PCAPNG read error on %s: %s", chunk_path, exc)

    @staticmethod
    def _classify_packet(dst_port: int, flags: str, proto: str) -> str:
        """Observable heuristic classification without synthetic ground truth."""
        suspicious_ports = {1337, 31337, 4444, 5555, 6667, 8888, 9001, 9999, 22, 23, 445, 3389}
        if dst_port in suspicious_ports:
            return "suspicious"
        if proto == "TCP" and "S" in flags and "A" not in flags and dst_port not in (80, 443, 8080):
            return "suspicious"
        if proto == "TCP" and (flags == "" or "FPU" in flags):
            return "suspicious"
        return "benign"

    # ─── Health Monitor ────────────────────────────────────────

    async def _run_health_monitor(self) -> None:
        """
        Evaluates capture health state dynamically (STARTING -> RUNNING / NO_TRAFFIC / DEGRADED / FAILED).
        """
        grace_period_seconds = 4.0
        start_time = time.time()

        while self._running:
            await asyncio.sleep(1.0)
            if not self._running:
                break

            now = time.time()
            elapsed = now - start_time

            # 1. Check if dumpcap subprocess is alive
            if self._dumpcap_proc and not self._dumpcap_proc.is_alive():
                self._metrics.health_status = "FAILED"
                self._metrics.status_message = "Dumpcap capture subprocess terminated unexpectedly."
                continue

            # 2. Check traffic arrival
            if self._metrics.packets_captured > 0:
                if self._metrics.capture_drops > 0 or self._metrics.queue_drops > 0:
                    self._metrics.health_status = "DEGRADED"
                    self._metrics.status_message = f"Live capture active with drops (Queue drops: {self._metrics.queue_drops})."
                else:
                    self._metrics.health_status = "RUNNING"
                    self._metrics.status_message = f"Live capture active on {self.interface_name} ({self._metrics.packets_captured} packets)."
            else:
                if elapsed < grace_period_seconds:
                    self._metrics.health_status = "STARTING"
                    self._metrics.status_message = f"Starting capture process on {self.interface_name}..."
                else:
                    self._metrics.health_status = "NO_TRAFFIC"
                    self._metrics.status_message = (
                        f"Capture process is running on {self.interface_name}, but no packets have been observed. "
                        "Generate network activity or select an active interface."
                    )
