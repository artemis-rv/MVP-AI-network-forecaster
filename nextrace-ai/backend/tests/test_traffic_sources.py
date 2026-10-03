"""
Unit & Integration Tests for Canonical Traffic Sources
======================================================
Tests SyntheticSource, PcapSource, and LiveCaptureSource conformance to the
CanonicalPacket, CanonicalFlow, and CanonicalTemporalState contracts.
"""
import asyncio
import datetime
import os
from pathlib import Path
import struct
import sys
import tempfile
import time
import pytest

backend_dir = str(Path(__file__).resolve().parent.parent.parent)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from backend.traffic.contract import (
    CanonicalPacket,
    CanonicalFlow,
    CanonicalTemporalState,
    TrafficSource,
)
from backend.traffic.synthetic_source import SyntheticSource
from backend.traffic.pcap_source import PcapSource
from backend.traffic.live_capture_source import LiveCaptureSource, get_network_interfaces
from backend.forecasting.engine import RuleBasedForecastEngine


def _create_minimal_pcap(filepath: str, packet_count: int = 20):
    """Create a valid libpcap binary file with synthetic IPv4 TCP/UDP packets."""
    global_hdr = struct.pack("!IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
    with open(filepath, "wb") as f:
        f.write(global_hdr)
        base_ts = 1700000000.0
        for i in range(packet_count):
            ts_sec = int(base_ts + (i * 0.1))
            ts_usec = int((base_ts + (i * 0.1) - ts_sec) * 1_000_000)

            eth = b"\x00\x0c\x29\x12\x34\x56\x00\x50\x56\xc0\x00\x08\x08\x00"
            ip_hdr = struct.pack(
                "!BBHHHBBH4s4s",
                0x45, 0, 40, i, 0, 64, 6, 0,
                bytes([192, 168, 1, 10 + (i % 5)]),
                bytes([10, 0, 0, 50]),
            )
            tcp_hdr = struct.pack(
                "!HHIIBBHHH",
                40000 + i, 80 if i % 2 == 0 else 443,
                i * 100, 0,
                (5 << 4), 0x02,
                64240, 0, 0,
            )
            pkt_payload = eth + ip_hdr + tcp_hdr
            pkt_hdr = struct.pack("!IIII", ts_sec, ts_usec, len(pkt_payload), len(pkt_payload))
            f.write(pkt_hdr + pkt_payload)


def test_synthetic_source_lifecycle():
    """Test SyntheticSource streaming and metrics."""
    async def _run():
        source = SyntheticSource(mode="suspicious", job_id="test-synth-01", rate_hz=100.0)
        source.start()

        packets: list[CanonicalPacket] = []
        async for pkt in source.stream():
            packets.append(pkt)
            if len(packets) >= 15:
                break

        source.stop()
        metrics = source.get_metrics()

        assert len(packets) >= 15
        assert all(isinstance(p, CanonicalPacket) for p in packets)
        assert metrics.packets_seen >= 15
        assert metrics.source_type == "synthetic"
        assert metrics.job_id == "test-synth-01"

    asyncio.run(_run())


def test_pcap_source_streaming_and_windows():
    """Test streaming PcapSource incrementally without full RAM loading."""
    async def _run():
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as tf:
            pcap_path = tf.name

        try:
            _create_minimal_pcap(pcap_path, packet_count=30)
            source = PcapSource(file_path=pcap_path, job_id="test-pcap-01")
            source.start()

            packets: list[CanonicalPacket] = []
            async for pkt in source.stream():
                packets.append(pkt)

            source.stop()
            metrics = source.get_metrics()

            assert len(packets) == 30
            assert metrics.packets_seen == 30
            assert metrics.packets_processed == 30
            assert metrics.packets_dropped == 0
            assert metrics.errors == 0
        finally:
            if os.path.exists(pcap_path):
                os.remove(pcap_path)

    asyncio.run(_run())


def test_pcap_source_feeds_forecast_engine():
    """Verify that normalized packets from PcapSource build temporal windows and feed ForecastEngine."""
    async def _run():
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as tf:
            pcap_path = tf.name

        try:
            _create_minimal_pcap(pcap_path, packet_count=50)
            source = PcapSource(file_path=pcap_path, job_id="test-pcap-fc-01")
            source.start()

            packets: list[CanonicalPacket] = []
            async for pkt in source.stream():
                packets.append(pkt)

            source.stop()
            assert len(packets) == 50

            # Build canonical state from packets
            t0_str = datetime.datetime.fromtimestamp(packets[0].timestamp, tz=datetime.timezone.utc).isoformat()
            t1_str = datetime.datetime.fromtimestamp(packets[-1].timestamp, tz=datetime.timezone.utc).isoformat()
            state = CanonicalTemporalState(
                window_start=t0_str,
                window_end=t1_str,
                window_seconds=15.0,
                packet_count=len(packets),
                byte_count=sum(p.packet_size for p in packets),
                flow_count=10,
                benign_count=45,
                suspicious_count=5,
                unique_src_ips=len(set(p.src_ip for p in packets)),
                unique_dst_ips=len(set(p.dst_ip for p in packets)),
                unique_dst_ports=len(set(p.dst_port for p in packets)),
                tcp_count=sum(1 for p in packets if p.protocol == "TCP"),
                udp_count=0,
                icmp_count=0,
                dns_count=0,
                http_count=25,
                mean_packet_size=float(sum(p.packet_size for p in packets) / len(packets)),
                connection_rate=float(len(packets) / 15.0),
                suspicious_ratio=0.1,
            )

            engine = RuleBasedForecastEngine()
            state_dict = state.to_forecast_dict()
            result = engine.predict(state_dict)
            assert result is not None
            assert "current_stage" in result
            assert "predicted_next_stage" in result
            assert "confidence" in result
        finally:
            if os.path.exists(pcap_path):
                os.remove(pcap_path)

    asyncio.run(_run())


def test_interface_discovery():
    """Verify Windows capture interface discovery returns valid list."""
    ifaces = get_network_interfaces()
    assert isinstance(ifaces, list)
    assert len(ifaces) > 0
    assert any(i.get("name") for i in ifaces)

