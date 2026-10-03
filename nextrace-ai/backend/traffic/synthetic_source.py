"""
NEXTRACE AI — Synthetic Traffic Source Adapter
==============================================
Wraps the synthetic traffic generator inside the canonical TrafficSource interface.
"""
from __future__ import annotations

import asyncio
import random
import time
from typing import Optional

from backend.traffic.contract import CanonicalPacket, TrafficSource, TrafficSourceMetrics
from backend.traffic.generator import generate_event


class SyntheticSource(TrafficSource):
    """
    Simulated traffic source that emits synthetic events matching the CanonicalPacket contract.
    """

    def __init__(self, mode: str = "benign", job_id: str = "synthetic_session", rate_hz: float = 30.0) -> None:
        self.mode = mode
        self.job_id = job_id
        self.rate_hz = max(1.0, min(rate_hz, 500.0))
        self._running = False
        self._metrics = TrafficSourceMetrics(source_type="synthetic", job_id=job_id)
        self._queue: asyncio.Queue[CanonicalPacket] = asyncio.Queue(maxsize=1000)
        self._worker_task: Optional[asyncio.Task] = None

    def start(self) -> None:
        if self._running:
            return
        self._running = True
        self._metrics.is_active = True
        self._metrics.start_time = time.time()
        self._metrics.packets_seen = 0
        self._metrics.packets_processed = 0
        self._metrics.packets_dropped = 0
        self._metrics.bytes_seen = 0
        self._metrics.errors = 0

        # Start generator background worker
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            try:
                loop = asyncio.get_event_loop()
            except RuntimeError:
                loop = asyncio.new_event_loop()
                asyncio.set_event_loop(loop)
        self._worker_task = loop.create_task(self._run_generator())

    def stop(self) -> None:
        self._running = False
        self._metrics.is_active = False
        if self._worker_task and not self._worker_task.done():
            self._worker_task.cancel()
        self._worker_task = None
        # Drain remaining queue
        while not self._queue.empty():
            try:
                self._queue.get_nowait()
            except Exception:
                break

    def is_running(self) -> bool:
        return self._running

    def get_metrics(self) -> TrafficSourceMetrics:
        self._metrics.queue_depth = self._queue.qsize()
        return self._metrics

    async def get_packet(self) -> Optional[CanonicalPacket]:
        if not self._running and self._queue.empty():
            return None
        try:
            pkt = await asyncio.wait_for(self._queue.get(), timeout=0.1)
            self._metrics.packets_processed += 1
            return pkt
        except asyncio.TimeoutError:
            return None

    async def _run_generator(self) -> None:
        delay = 1.0 / self.rate_hz
        try:
            while self._running:
                # Add small realistic rate jitter
                jitter_delay = delay * random.uniform(0.7, 1.3)
                await asyncio.sleep(jitter_delay)

                ev = generate_event(self.mode)
                now_ts = time.time()
                
                pkt = CanonicalPacket(
                    timestamp=now_ts,
                    src_ip=ev["src_ip"],
                    dst_ip=ev["dst_ip"],
                    src_port=ev["src_port"],
                    dst_port=ev["dst_port"],
                    protocol=ev["protocol"],
                    packet_size=ev["packet_size"],
                    tcp_flags=self._infer_flags(ev),
                    payload_info=ev.get("payload_info", ""),
                    payload_hex="",
                    source_type="synthetic",
                    job_id=self.job_id,
                    classification=ev.get("classification", "benign"),
                )

                self._metrics.packets_seen += 1
                self._metrics.bytes_seen += pkt.packet_size

                try:
                    self._queue.put_nowait(pkt)
                except asyncio.QueueFull:
                    self._metrics.packets_dropped += 1
                    self._metrics.queue_drops += 1

        except asyncio.CancelledError:
            pass
        except Exception as exc:
            self._metrics.errors += 1
            self._metrics.last_error = str(exc)

    @staticmethod
    def _infer_flags(ev: dict) -> str:
        proto = ev.get("protocol", "")
        if proto != "TCP":
            return ""
        info = ev.get("payload_info", "")
        if "[SYN]" in info:
            return "S"
        if "[ACK]" in info:
            return "A"
        return "PA"
