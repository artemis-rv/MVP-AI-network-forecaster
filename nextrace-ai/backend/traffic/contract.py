"""
NEXTRACE AI — Canonical Traffic Data Contract & TrafficSource Abstraction
=========================================================================
Defines the unified internal data contract and source interface consumed by the
feature extraction, window aggregation, and attack forecasting pipeline.
"""
from __future__ import annotations

import time
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, Iterator, Optional
from pydantic import BaseModel, Field


class CanonicalPacket(BaseModel):
    """
    Unified normalized packet representation across Synthetic, PCAP, and Live Capture.
    """
    timestamp: float = Field(..., description="Unix epoch timestamp in seconds (float)")
    src_ip: str = Field(..., description="IPv4 or IPv6 source address")
    dst_ip: str = Field(..., description="IPv4 or IPv6 destination address")
    src_port: int = Field(default=0, ge=0, le=65535, description="Source port")
    dst_port: int = Field(default=0, ge=0, le=65535, description="Destination port")
    protocol: str = Field(..., description="Protocol: TCP, UDP, ICMP, DNS, HTTP, or OTHER")
    packet_size: int = Field(..., ge=0, description="Packet size in bytes")
    tcp_flags: str = Field(default="", description="TCP flags string (e.g. S, SA, FPU)")
    direction: str = Field(default="outbound", description="'inbound' | 'outbound' | 'internal'")
    interface: str = Field(default="", description="Ingestion interface name/ID")
    payload_info: str = Field(default="", description="Short descriptive text or L7 metadata")
    payload_hex: str = Field(default="", description="Hexadecimal string of packet payload")
    source_type: str = Field(..., description="'synthetic' | 'pcap' | 'live'")
    job_id: str = Field(..., description="Unique session/job ID for isolation")
    classification: str = Field(default="benign", description="'benign' | 'suspicious'")

    def to_event_dict(self) -> dict[str, Any]:
        """Convert to UI & WebSocket compatible dictionary."""
        from datetime import datetime, timezone
        ts_dt = datetime.fromtimestamp(self.timestamp, timezone.utc)
        ts_str = ts_dt.isoformat(timespec="milliseconds").replace("+00:00", "") + "Z"
        return {
            "timestamp": ts_str,
            "protocol": self.protocol,
            "src_ip": self.src_ip,
            "dst_ip": self.dst_ip,
            "src_port": self.src_port,
            "dst_port": self.dst_port,
            "packet_size": self.packet_size,
            "direction": self.direction,
            "interface": self.interface,
            "classification": self.classification,
            "payload_info": self.payload_info,
            "source_type": self.source_type,
            "job_id": self.job_id,
        }


class CanonicalFlow(BaseModel):
    """
    Standard 5-tuple bidirectional network flow representation.
    """
    flow_id: str
    src_ip: str
    dst_ip: str
    src_port: int
    dst_port: int
    protocol: str
    packet_count: int = 0
    byte_count: int = 0
    first_seen: float = 0.0
    last_seen: float = 0.0
    duration_s: float = 0.0
    forward_packets: int = 0
    reverse_packets: int = 0
    flags: list[str] = Field(default_factory=list)
    is_suspicious: bool = False


class CanonicalTemporalState(BaseModel):
    """
    Aggregated feature state for a single temporal window consumed by the ForecastEngine.
    """
    window_start: str
    window_end: str
    window_seconds: int
    # Counts
    packet_count: int
    byte_count: int
    flow_count: int
    benign_count: int
    suspicious_count: int
    # IP diversity
    unique_src_ips: int
    unique_dst_ips: int
    unique_dst_ports: int
    # Protocol breakdown
    tcp_count: int
    udp_count: int
    icmp_count: int
    dns_count: int
    http_count: int
    # Derived features & rates
    mean_packet_size: float
    connection_rate: float
    packet_rate: float = 0.0
    byte_rate: float = 0.0
    suspicious_ratio: float
    suspicion_score: float = 0.0
    # Optional runtime telemetry
    partial: bool = False
    window_progress: float = 1.0
    source_type: str = "synthetic"
    job_id: str = "default"

    def to_forecast_dict(self) -> dict[str, Any]:
        """Convert canonical temporal state into ForecastEngine input dictionary."""
        return self.model_dump()


class TrafficSourceMetrics(BaseModel):
    """
    Observability telemetry for a running traffic source adapter.
    """
    source_type: str
    job_id: str
    is_active: bool = False
    health_status: str = "STOPPED"  # STARTING, RUNNING, NO_TRAFFIC, DEGRADED, FAILED, STOPPING, STOPPED
    status_message: str = ""
    start_time: Optional[float] = None
    
    # Independent accounting counters
    packets_captured: int = 0
    bytes_captured: int = 0
    capture_drops: int = 0
    packets_parsed: int = 0
    parser_errors: int = 0
    packets_processed: int = 0
    queue_drops: int = 0
    queue_depth: int = 0
    flows_created: int = 0
    windows_completed: int = 0
    forecasts_generated: int = 0
    
    # Rate & Latency metrics
    capture_pps: float = 0.0
    processing_pps: float = 0.0
    capture_mbps: float = 0.0
    processing_lag_ms: float = 0.0
    errors: int = 0
    last_error: Optional[str] = None

    # Legacy aliases
    @property
    def packets_seen(self) -> int:
        return self.packets_captured

    @packets_seen.setter
    def packets_seen(self, val: int) -> None:
        self.packets_captured = val

    @property
    def bytes_seen(self) -> int:
        return self.bytes_captured

    @bytes_seen.setter
    def bytes_seen(self, val: int) -> None:
        self.bytes_captured = val

    @property
    def packets_dropped(self) -> int:
        return self.capture_drops + self.queue_drops

    @packets_dropped.setter
    def packets_dropped(self, val: int) -> None:
        self.queue_drops = val


class TrafficSource(ABC):
    """
    Abstract Base Class for all traffic ingestion adapters.
    """

    @abstractmethod
    def start(self) -> None:
        """Initialize and start the traffic source."""
        ...

    @abstractmethod
    def stop(self) -> None:
        """Stop capture and release all resources."""
        ...

    @abstractmethod
    def is_running(self) -> bool:
        """Check if source is currently actively producing packets."""
        ...

    @abstractmethod
    def get_metrics(self) -> TrafficSourceMetrics:
        """Return current performance and queue metrics."""
        ...

    @abstractmethod
    async def get_packet(self) -> Optional[CanonicalPacket]:
        """Fetch next canonical packet from queue (non-blocking / short timeout)."""
        ...

    async def stream(self) -> AsyncIterator[CanonicalPacket]:
        """Stream CanonicalPackets as an asynchronous generator."""
        while self.is_running():
            pkt = await self.get_packet()
            if pkt is not None:
                yield pkt
            else:
                if not self.is_running():
                    break
                await asyncio.sleep(0.005)
