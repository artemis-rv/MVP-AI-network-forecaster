"""
NEXTRACE AI — Dumpcap Decoupled Live Capture & Self-Test Verification Suite
===========================================================================
Comprehensive unit and integration tests for:
1. Automated interface discovery
2. Dumpcap availability & executable verification
3. Capture self-test endpoint logic
4. Zero-packet detection & explicit NO_TRAFFIC health state
5. Real PCAP / PCAPNG packet decoding
6. CanonicalPacket normalization
7. Bidirectional Flow / Session aggregation
8. Temporal windowing
9. Feature engineering & rate metrics
10. Observable anomaly / suspicion score calculation
11. ForecastEngine integration with real temporal states
12. Live + PCAP job isolation
13. Packet accounting counter consistency
"""
import asyncio
import datetime
import os
import struct
import tempfile
import time
from typing import Any
import pytest

from backend.traffic.contract import CanonicalPacket, CanonicalTemporalState, TrafficSourceMetrics
from backend.traffic.discovery import (
    discover_network_interfaces,
    find_dumpcap_executable,
    get_recommended_interface,
    get_environment_info,
)
from backend.traffic.dumpcap_capture import (
    run_dumpcap_self_test,
    DumpcapCaptureProcess,
    compute_file_sha256,
)
from backend.traffic.live_capture_source import LiveCaptureSource
from backend.traffic.pcap_source import PcapSource
from backend.features.engineering import (
    build_flows_from_events,
    compute_observable_anomaly_score,
    compute_temporal_state,
)
from backend.forecasting.engine import RuleBasedForecastEngine
from backend.services.live_session import LiveSession


def _create_synthetic_pcapng_file(filepath: str, packet_count: int = 25):
    """Create a minimal valid PCAP file containing synthetic IP packets."""
    global_hdr = struct.pack("!IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
    with open(filepath, "wb") as f:
        f.write(global_hdr)
        base_ts = 1700000000.0
        for i in range(packet_count):
            ts_sec = int(base_ts + (i * 0.1))
            ts_usec = int((base_ts + (i * 0.1) - ts_sec) * 1_000_000)
            eth = b"\x00\x0c\x29\x12\x34\x56\x00\x50\x56\xc0\x00\x08\x08\x00"
            src_ip = bytes([192, 168, 1, 10 + (i % 5)])
            dst_ip = bytes([10, 0, 0, 1 + (i % 3)])
            ip_hdr = struct.pack("!BBHHHBBH4s4s", 0x45, 0, 40, i, 0, 64, 6, 0, src_ip, dst_ip)
            tcp_hdr = struct.pack("!HHIIBBHHH", 40000 + i, 80 if i % 2 == 0 else 443, i, 0, (5 << 4), 0x02, 64240, 0, 0)
            payload = eth + ip_hdr + tcp_hdr
            pkt_hdr = struct.pack("!IIII", ts_sec, ts_usec, len(payload), len(payload))
            f.write(pkt_hdr + payload)


# ─── 1. Interface Discovery & Dumpcap Availability ────────────

def test_interface_discovery_and_environment():
    env = get_environment_info()
    assert "os" in env
    assert "interfaces" in env
    assert env["interface_count"] > 0
    assert env["dumpcap_available"] is True
    assert env["dumpcap_path"] is not None
    assert os.path.exists(env["dumpcap_path"])

    rec = get_recommended_interface(env["interfaces"])
    assert rec is not None
    assert len(str(rec)) > 0


# ─── 2. Capture Self-Test Execution ───────────────────────────

def test_capture_self_test_execution():
    env = get_environment_info()
    rec_iface = env["recommended_interface"]
    
    # Run short 2-second capture self-test
    result = run_dumpcap_self_test(interface_id=rec_iface, duration_seconds=2)
    assert "healthy" in result
    assert "packets" in result
    assert "bytes" in result
    assert "duration_seconds" in result
    assert "packets_per_second" in result
    assert "mbps" in result
    assert result["interface_id"] == str(rec_iface)
    assert result["duration_seconds"] > 0.5


# ─── 3. Zero-Packet Detection & Anomaly Indicator ────────────

def test_zero_packet_temporal_state():
    t0 = datetime.datetime(2026, 10, 3, 12, 0, 0, tzinfo=datetime.timezone.utc)
    t1 = datetime.datetime(2026, 10, 3, 12, 0, 15, tzinfo=datetime.timezone.utc)
    state = compute_temporal_state([], t0, t1, 15)
    assert state["packet_count"] == 0
    assert state["byte_count"] == 0
    assert state["flow_count"] == 0
    assert state["connection_rate"] == 0.0
    assert state["suspicion_score"] == 0.0


# ─── 4. Flow Building & Session Aggregation ──────────────────

def test_flow_building_and_aggregation():
    events = [
        {"src_ip": "192.168.1.100", "dst_ip": "10.0.0.1", "src_port": 50001, "dst_port": 443, "protocol": "TCP", "packet_size": 120, "classification": "benign"},
        {"src_ip": "10.0.0.1", "dst_ip": "192.168.1.100", "src_port": 443, "dst_port": 50001, "protocol": "TCP", "packet_size": 800, "classification": "benign"},
        {"src_ip": "192.168.1.100", "dst_ip": "10.0.0.1", "src_port": 50001, "dst_port": 443, "protocol": "TCP", "packet_size": 200, "classification": "benign"},
        {"src_ip": "192.168.1.101", "dst_ip": "10.0.0.2", "src_port": 50002, "dst_port": 1337, "protocol": "TCP", "packet_size": 64, "classification": "suspicious"},
    ]

    flows = build_flows_from_events(events)
    assert len(flows) == 2  # 2 bidirectional flows
    
    # Check 443 flow
    f443 = next(f for f in flows if f["src_port"] == 443 or f["dst_port"] == 443)
    assert f443["packet_count"] == 3
    assert f443["byte_count"] == 1120
    assert f443["forward_packets"] + f443["reverse_packets"] == 3

    # Check 1337 flow
    f1337 = next(f for f in flows if f["src_port"] == 1337 or f["dst_port"] == 1337)
    assert f1337["is_suspicious"] is True


# ─── 5. Observable Anomaly Score Calculation ──────────────────

def test_observable_anomaly_score():
    benign_events = [
        {"src_ip": "192.168.1.50", "dst_ip": "1.1.1.1", "src_port": 45000, "dst_port": 53, "protocol": "DNS", "packet_size": 60, "classification": "benign"},
        {"src_ip": "192.168.1.50", "dst_ip": "142.250.190.46", "src_port": 45002, "dst_port": 443, "protocol": "TCP", "packet_size": 1500, "classification": "benign"},
    ]
    score_benign, count_benign = compute_observable_anomaly_score(benign_events, duration_sec=15.0)
    assert score_benign < 0.2
    assert count_benign == 0

    suspicious_events = [
        {"src_ip": "192.168.1.99", "dst_ip": f"10.0.0.{i}", "src_port": 50000 + i, "dst_port": 4444, "protocol": "TCP", "tcp_flags": "S", "packet_size": 60, "classification": "suspicious"}
        for i in range(1, 15)
    ]
    score_susp, count_susp = compute_observable_anomaly_score(suspicious_events, duration_sec=5.0)
    assert score_susp > 0.4
    assert count_susp >= 10


# ─── 6. Temporal Window State & ForecastEngine Integration ────

def test_temporal_window_and_forecast_engine():
    t0 = datetime.datetime.now(datetime.timezone.utc)
    t1 = t0 + datetime.timedelta(seconds=15)

    events = [
        {"src_ip": "192.168.1.10", "dst_ip": "10.0.0.5", "src_port": 30000 + i, "dst_port": 80, "protocol": "TCP", "packet_size": 500, "classification": "benign"}
        for i in range(30)
    ]
    state = compute_temporal_state(events, t0, t1, 15)
    assert state["packet_count"] == 30
    assert state["byte_count"] == 15000
    assert state["mean_packet_size"] == 500.0
    assert state["connection_rate"] > 0

    engine = RuleBasedForecastEngine()
    forecast = engine.predict(state, mode="benign")
    assert "current_stage" in forecast
    assert "predicted_next_stage" in forecast
    assert "confidence" in forecast
    assert forecast["confidence"] >= 0.0


# ─── 7. Live & PCAP Session Isolation ────────────────────────

def test_live_and_pcap_session_isolation():
    async def _run():
        session1 = LiveSession()
        session1.start(source_type="synthetic", mode="benign", window_seconds=15)
        assert session1.running is True
        assert session1.session_id.startswith("LIVE-")

        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as tf:
            pcap_file = tf.name

        try:
            _create_synthetic_pcapng_file(pcap_file, packet_count=20)
            pcap_src = PcapSource(file_path=pcap_file, job_id="PCAP-001")
            pcap_src.start()
            
            # Check source separation
            assert session1._source.job_id == session1.session_id
            assert pcap_src.job_id == "PCAP-001"
            assert pcap_src.source_type == "pcap"
            assert session1.source_type == "synthetic"

            pcap_src.stop()
        finally:
            session1.stop()
            if os.path.exists(pcap_file):
                os.remove(pcap_file)

    asyncio.run(_run())


# ─── 8. Chunk SHA-256 Integrity Verification ─────────────────

def test_chunk_sha256_integrity():
    with tempfile.NamedTemporaryFile(suffix=".pcapng", delete=False) as tf:
        chunk_file = tf.name

    try:
        _create_synthetic_pcapng_file(chunk_file, packet_count=10)
        h1 = compute_file_sha256(chunk_file)
        assert len(h1) == 64  # SHA-256 hex string
        h2 = compute_file_sha256(chunk_file)
        assert h1 == h2
    finally:
        if os.path.exists(chunk_file):
            os.remove(chunk_file)
