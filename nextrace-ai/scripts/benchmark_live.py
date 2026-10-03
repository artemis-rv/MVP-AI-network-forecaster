"""
NEXTRACE AI — 60-Second Real Network Live Capture Validation & Benchmark Runner
"""
import asyncio
import json
import os
import sys
from pathlib import Path
import psutil
import time
import urllib.request

parent_dir = str(Path(__file__).resolve().parent.parent)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.traffic.discovery import get_environment_info
from backend.services.live_session import LiveSession


async def run_live_stability_test():
    env = get_environment_info()
    rec_iface = env["recommended_interface"]
    print(f"=== NEXTRACE AI LIVE TRAFFIC VALIDATION ===")
    print(f"Discovered Environment: OS={env['os']}, Npcap={env['npcap_available']}, Dumpcap={env['dumpcap_available']}")
    print(f"Starting 60-Second Live Ingestion on Interface #{rec_iface}...")

    session = LiveSession()
    session.start(source_type="live", interface=rec_iface, window_seconds=15)

    proc = psutil.Process(os.getpid())
    samples = []
    t_start = time.time()

    def generate_authorized_traffic():
        for url in ["https://www.google.com", "https://1.1.1.1", "https://www.wikipedia.org"]:
            try:
                urllib.request.urlopen(url, timeout=1.5)
            except Exception:
                pass

    for sec in range(1, 65):
        await asyncio.sleep(1.0)
        if sec % 5 == 0:
            generate_authorized_traffic()

        status = session.get_status()
        metrics = session.get_metrics()
        cpu = proc.cpu_percent()
        ram_mb = proc.memory_info().rss / (1024 * 1024)

        samples.append({
            "sec": sec,
            "packets": status["packet_count"],
            "bytes": status["bytes_captured"],
            "entities": len(status["active_entities"]),
            "health": status["health_status"],
            "capture_pps": metrics.get("capture_pps", 0),
            "processing_pps": metrics.get("processing_pps", 0),
            "capture_mbps": metrics.get("capture_mbps", 0),
            "drops": metrics.get("capture_drops", 0) + metrics.get("queue_drops", 0),
            "cpu": cpu,
            "ram_mb": round(ram_mb, 2),
        })

        if sec % 10 == 0 or sec == 60:
            pkts = status["packet_count"]
            bytes_cnt = status["bytes_captured"]
            mbps = metrics.get("capture_mbps", 0)
            lag = metrics.get("processing_lag_ms", 0)
            drops = metrics.get("capture_drops", 0)
            print(f"[{sec:02d}s] Health: {status['health_status']:<10} | Packets: {pkts:<6} | Bytes: {bytes_cnt:<9} | Rate: {mbps:.3f} Mbps | Lag: {lag:.1f}ms | Drops: {drops} | RAM: {ram_mb:.1f} MB")

    total_duration = round(time.time() - t_start, 2)
    final_status = session.get_status()
    final_metrics = session.get_metrics()
    forecast = session.get_current_forecast()

    session.stop()

    print("\n=== 60-SECOND BENCHMARK SUMMARY ===")
    print(f"Total Duration: {total_duration} s")
    print(f"Total Real Packets Ingested: {final_status['packet_count']}")
    print(f"Total Real Bytes Ingested: {final_status['bytes_captured']} bytes")
    print(f"Active Network Entities Tracked: {len(final_status['active_entities'])}")
    print(f"Capture Drops: {final_metrics.get('capture_drops', 0)}")
    print(f"Queue Drops: {final_metrics.get('queue_drops', 0)}")
    print(f"Average Packet Rate: {final_metrics.get('processing_pps', 0)} pkts/sec")
    print(f"Peak RAM Consumption: {max(s['ram_mb'] for s in samples):.2f} MB")
    print(f"Final Health State: {final_status['health_status']}")
    print(f"Final Attack Forecast Stage: {forecast.get('current_stage')} -> {forecast.get('predicted_next_stage')}")
    print(f"Forecast Confidence: {forecast.get('confidence')}")
    print(f"Forecast Stage Probabilities: {json.dumps(forecast.get('stage_probabilities', []))}")


if __name__ == "__main__":
    asyncio.run(run_live_stability_test())
