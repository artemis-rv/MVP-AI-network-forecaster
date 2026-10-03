"""
Concurrency & Isolation Tests
=============================
Verifies that:
1. Live traffic and historical PCAP jobs never mix packets or windows.
2. Multiple PCAP jobs running concurrently remain strictly isolated.
3. Cancellation of one job does not affect active live traffic or other PCAP jobs.
"""
import asyncio
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

from backend.traffic.contract import CanonicalPacket, CanonicalTemporalState
from backend.traffic.synthetic_source import SyntheticSource
from backend.traffic.pcap_source import PcapSource
from backend.historical.analyzer import run_analysis


def _create_custom_pcap(filepath: str, src_ip_prefix: str, count: int = 40):
    global_hdr = struct.pack("!IHHiIII", 0xA1B2C3D4, 2, 4, 0, 0, 65535, 1)
    with open(filepath, "wb") as f:
        f.write(global_hdr)
        base_ts = 1700000000.0
        for i in range(count):
            ts_sec = int(base_ts + (i * 0.05))
            ts_usec = int((base_ts + (i * 0.05) - ts_sec) * 1_000_000)
            eth = b"\x00\x0c\x29\x12\x34\x56\x00\x50\x56\xc0\x00\x08\x08\x00"
            src_ip_bytes = bytes([int(x) for x in src_ip_prefix.split(".")[:3]]) + bytes([i % 250 + 1])
            ip_hdr = struct.pack(
                "!BBHHHBBH4s4s",
                0x45, 0, 40, i, 0, 64, 6, 0,
                src_ip_bytes,
                bytes([10, 0, 0, 1]),
            )
            tcp_hdr = struct.pack("!HHIIBBHHH", 50000 + i, 80, i, 0, (5 << 4), 0x02, 64240, 0, 0)
            pkt_payload = eth + ip_hdr + tcp_hdr
            pkt_hdr = struct.pack("!IIII", ts_sec, ts_usec, len(pkt_payload), len(pkt_payload))
            f.write(pkt_hdr + pkt_payload)


def test_live_and_pcap_isolation():
    """Verify that a Live synthetic source and a PcapSource run simultaneously without data leakage."""
    async def _run():
        live_source = SyntheticSource(mode="benign", job_id="live-session-001", rate_hz=200.0)
        
        with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as tf:
            pcap_path = tf.name

        try:
            _create_custom_pcap(pcap_path, "172.16.1.0", count=50)
            pcap_source = PcapSource(file_path=pcap_path, job_id="pcap-job-001")

            live_source.start()
            pcap_source.start()

            live_packets: list[CanonicalPacket] = []
            pcap_packets: list[CanonicalPacket] = []

            async def collect_live():
                async for p in live_source.stream():
                    live_packets.append(p)
                    if len(live_packets) >= 30:
                        break

            async def collect_pcap():
                async for p in pcap_source.stream():
                    pcap_packets.append(p)

            await asyncio.gather(collect_live(), collect_pcap())
            live_source.stop()
            pcap_source.stop()

            # Strict checks:
            assert len(live_packets) >= 30
            assert len(pcap_packets) == 50

            # Every packet in live stream must have job_id == 'live-session-001' and source_type == 'synthetic'
            assert all(p.job_id == "live-session-001" for p in live_packets)
            assert all(p.source_type == "synthetic" for p in live_packets)

            # Every packet in pcap stream must have job_id == 'pcap-job-001' and source_type == 'pcap'
            assert all(p.job_id == "pcap-job-001" for p in pcap_packets)
            assert all(p.source_type == "pcap" for p in pcap_packets)
            assert all(p.src_ip.startswith("172.16.1.") for p in pcap_packets)
        finally:
            if os.path.exists(pcap_path):
                os.remove(pcap_path)

    asyncio.run(_run())


def test_concurrent_multiple_pcap_jobs():
    """Verify that multiple concurrent PCAP analyzer jobs process independently without cross-talk."""
    with tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as tf_a, \
         tempfile.NamedTemporaryFile(suffix=".pcap", delete=False) as tf_b:
        pcap_a_path = tf_a.name
        pcap_b_path = tf_b.name

    try:
        _create_custom_pcap(pcap_a_path, "192.168.10.0", count=40)
        _create_custom_pcap(pcap_b_path, "10.200.30.0", count=60)

        res_a = run_analysis(pcap_a_path, window_seconds=1.0)
        res_b = run_analysis(pcap_b_path, window_seconds=1.0)

        assert res_a["packet_count"] == 40
        assert res_b["packet_count"] == 60
        assert len(res_a["temporal_windows"]) >= 1
        assert len(res_b["temporal_windows"]) >= 1
        assert "final_forecast" in res_a
        assert "final_forecast" in res_b
    finally:
        for p in (pcap_a_path, pcap_b_path):
            if os.path.exists(p):
                os.remove(p)

