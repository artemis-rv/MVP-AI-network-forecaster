"""
NEXTRACE AI — Performance & Concurrency Benchmark Harness
=========================================================
Measures real performance across capture throughput, window aggregation latency,
model inference latency, first-result latency, CPU/RAM utilization, and multi-job isolation.
"""
from __future__ import annotations

import asyncio
import os
import sys
import tempfile
import time
import psutil
import pytest
from scapy.all import Ether, IP, TCP, UDP, wrpcap

base_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.abspath(os.path.join(base_dir, "..", ".."))
nextrace_dir = os.path.join(root_dir, "nextrace-ai")

if "" in sys.path:
    sys.path.remove("")
if root_dir in sys.path:
    sys.path.remove(root_dir)
sys.path.insert(0, nextrace_dir)

from backend.traffic.synthetic_source import SyntheticSource
from backend.traffic.pcap_source import PcapSource
from backend.traffic.contract import CanonicalPacket
from backend.features.engineering import compute_temporal_state
from backend.forecasting.engine import RuleBasedForecastEngine
from backend.historical.analyzer import run_analysis


def generate_benchmark_pcap(packet_count: int = 5000) -> str:
    """Generate a temporary synthetic PCAP benchmark fixture using fast binary serialization."""
    import struct
    fd, path = tempfile.mkstemp(suffix=".pcap", prefix="bench_capture_")
    
    # Global header: magic (0xa1b2c3d4), version 2.4, thiszone 0, sigfigs 0, snaplen 65535, linktype 1 (Ethernet)
    global_hdr = struct.pack(">IHHiIII", 0xa1b2c3d4, 2, 4, 0, 0, 65535, 1)
    
    # Pre-built Ethernet + IP + TCP packet payload (64 bytes)
    # Eth: dst 00:11:22:33:44:55, src 66:77:88:99:aa:bb, type 0x0800 (IP)
    eth_hdr = b"\x00\x11\x22\x33\x44\x55\x66\x77\x88\x99\xaa\xbb\x08\x00"
    base_ts = 1710000000.0

    with os.fdopen(fd, "wb") as f:
        f.write(global_hdr)
        for i in range(packet_count):
            ts = base_ts + (i * 0.001)
            ts_sec = int(ts)
            ts_usec = int((ts - ts_sec) * 1_000_000)
            
            src_ip_bytes = b"\xc0\xa8\x01\x0a"  # 192.168.1.10
            dst_ip_bytes = bytes([192, 168, 1, 100 + (i % 5)])
            src_port = 10000 + (i % 5000)
            dst_port = 80 if i % 3 == 0 else (22 if i % 10 == 0 else 443)
            
            # IP header: v4, IHL 5 (20B), total len 40, ID i, proto 6 (TCP)
            ip_hdr = struct.pack(">BBHHHBBH4s4s", 0x45, 0, 40, i & 0xffff, 0, 64, 6, 0, src_ip_bytes, dst_ip_bytes)
            # TCP header: sport, dport, seq 1, ack 1, offset 5 (20B), flags 0x18 (PA), win 65535, check 0, urg 0
            tcp_hdr = struct.pack(">HHIIHHHH", src_port, dst_port, 1, 1, (5 << 12) | 0x18, 65535, 0, 0)
            
            frame_data = eth_hdr + ip_hdr + tcp_hdr
            caplen = len(frame_data)
            
            pkt_hdr = struct.pack(">IIII", ts_sec, ts_usec, caplen, caplen)
            f.write(pkt_hdr + frame_data)

    return path


def run_benchmark_suite() -> dict[str, Any]:
    """Execute complete performance benchmark suite and return measured metrics."""
    process = psutil.Process(os.getpid())
    results: dict[str, Any] = {}

    # 1. Feature Extraction & Model Inference Latency Benchmark
    engine = RuleBasedForecastEngine()
    sample_events = [
        {
            "timestamp": time.time(),
            "protocol": "TCP",
            "src_ip": "192.168.1.10",
            "dst_ip": f"192.168.1.{100 + (i % 10)}",
            "src_port": 10000 + i,
            "dst_port": 22 if i % 5 == 0 else 80,
            "packet_size": 150,
            "direction": "outbound",
            "classification": "suspicious" if i % 5 == 0 else "benign",
        }
        for i in range(1000)
    ]

    t0 = time.perf_counter()
    from datetime import datetime, timezone, timedelta
    now_dt = datetime.now(timezone.utc)
    temporal_state = compute_temporal_state(sample_events, now_dt - timedelta(seconds=15), now_dt, 15)
    t_feat = (time.perf_counter() - t0) * 1000  # ms

    t0 = time.perf_counter()
    forecast = engine.predict(temporal_state, mode="suspicious")
    t_infer = (time.perf_counter() - t0) * 1000  # ms

    results["feature_extraction_latency_1k_pkts_ms"] = round(t_feat, 3)
    results["model_inference_latency_ms"] = round(t_infer, 3)

    # 2. PCAP Ingestion Throughput Benchmark
    bench_pcap = generate_benchmark_pcap(packet_count=5000)
    file_size_bytes = os.path.getsize(bench_pcap)

    t_start = time.perf_counter()
    analysis_res = run_analysis(bench_pcap, window_seconds=15.0)
    t_elapsed = time.perf_counter() - t_start

    pkts_processed = analysis_res["packet_count"]
    throughput_pps = pkts_processed / max(t_elapsed, 0.001)
    throughput_mbps = (file_size_bytes * 8 / 1_000_000) / max(t_elapsed, 0.001)

    results["pcap_file_size_bytes"] = file_size_bytes
    results["pcap_packets_processed"] = pkts_processed
    results["pcap_processing_time_s"] = round(t_elapsed, 4)
    results["pcap_throughput_pps"] = round(throughput_pps, 1)
    results["pcap_throughput_mbps"] = round(throughput_mbps, 2)
    results["first_output_latency_ms"] = round(t_elapsed * 1000 / len(analysis_res["temporal_windows"]), 2)

    # 3. High-Rate Progressive Scale Benchmark (10,000 and 25,000 packets)
    for pcount in [10000, 25000]:
        pcap_file = generate_benchmark_pcap(packet_count=pcount)
        fsize = os.path.getsize(pcap_file)
        t_s = time.perf_counter()
        res = run_analysis(pcap_file, window_seconds=15.0)
        t_dur = time.perf_counter() - t_s
        results[f"scale_{pcount}_pkts_time_s"] = round(t_dur, 4)
        results[f"scale_{pcount}_pkts_pps"] = round(pcount / max(t_dur, 0.001), 1)
        results[f"scale_{pcount}_pkts_mbps"] = round((fsize * 8 / 1_000_000) / max(t_dur, 0.001), 2)
        if os.path.exists(pcap_file):
            try: os.unlink(pcap_file)
            except Exception: pass

    # 4. Multi-Job Concurrency Isolation Benchmark
    job_pcaps = [generate_benchmark_pcap(packet_count=3000) for _ in range(3)]
    t_conc_start = time.perf_counter()
    import concurrent.futures
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as executor:
        futures = [executor.submit(run_analysis, p, 15.0) for p in job_pcaps]
        conc_results = [f.result() for f in futures]
    t_conc_dur = time.perf_counter() - t_conc_start

    total_conc_pkts = sum(r["packet_count"] for r in conc_results)
    results["concurrent_3_jobs_total_pkts"] = total_conc_pkts
    results["concurrent_3_jobs_duration_s"] = round(t_conc_dur, 4)
    results["concurrent_throughput_pps"] = round(total_conc_pkts / max(t_conc_dur, 0.001), 1)
    results["concurrent_isolation_verified"] = all(r["packet_count"] == 3000 for r in conc_results)

    for p in job_pcaps:
        if os.path.exists(p):
            try: os.unlink(p)
            except Exception: pass

    # 5. CPU & RAM Usage
    results["cpu_percent"] = process.cpu_percent()
    results["ram_usage_mb"] = round(process.memory_info().rss / 1024 / 1024, 2)

    if os.path.exists(bench_pcap):
        try: os.unlink(bench_pcap)
        except Exception: pass

    return results


if __name__ == "__main__":
    print("Running NEXTRACE AI Performance Benchmark Harness...")
    res = run_benchmark_suite()
    print("\n================ BENCHMARK RESULTS ================")
    for k, v in res.items():
        print(f"  {k}: {v}")
    print("===================================================\n")
