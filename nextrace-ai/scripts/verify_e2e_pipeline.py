"""
NEXTRACE AI — End-to-End Pipeline Traversal & Deep Runtime Object Verification
"""
import asyncio
import json
import os
import sys
import time
import urllib.request
from pathlib import Path

parent_dir = str(Path(__file__).resolve().parent.parent)
if parent_dir not in sys.path:
    sys.path.insert(0, parent_dir)

from backend.traffic.discovery import get_environment_info
from backend.services.live_session import LiveSession
from backend.traffic.dumpcap_capture import compute_file_sha256
from backend.features.engineering import build_flows_from_events, compute_temporal_state


async def verify_e2e_pipeline():
    env = get_environment_info()
    rec_iface = env["recommended_interface"]
    print("============================================================")
    print("STEP 1: INITIALIZE LIVE CAPTURE ON PHYSICAL INTERFACE")
    print("============================================================")
    print(f"Interface: #{rec_iface}")
    
    session = LiveSession()
    session.start(source_type="live", interface=rec_iface, window_seconds=15)
    
    # Generate real network activity
    for url in ["https://www.google.com", "https://1.1.1.1", "https://www.github.com"]:
        try:
            urllib.request.urlopen(url, timeout=1.5)
        except Exception:
            pass

    # Collect for 18 seconds to ensure at least 1 closed temporal window
    await asyncio.sleep(18.0)
    
    status = session.get_status()
    metrics = session.get_metrics()
    forecast = session.get_current_forecast()
    
    print("\n============================================================")
    print("STEP 2: RUNTIME CAPTURE TELEMETRY & CHUNK VERIFICATION")
    print("============================================================")
    print(f"Session ID: {session.session_id}")
    print(f"Health Status: {status['health_status']}")
    print(f"Packets Captured: {status['packet_count']}")
    print(f"Bytes Captured: {status['bytes_captured']}")
    print(f"Capture Drops: {metrics.get('capture_drops', 0)}")
    print(f"Queue Drops: {metrics.get('queue_drops', 0)}")
    print(f"Active Entities: {len(status['active_entities'])}")

    # Check raw PCAPNG chunk file on disk
    session_dir = os.path.join("captures", "live", session.session_id)
    chunk_files = []
    if os.path.exists(session_dir):
        chunk_files = [os.path.join(session_dir, f) for f in os.listdir(session_dir) if f.endswith(".pcapng")]
    
    print(f"\nRaw PCAPNG Chunk Files on Disk: {len(chunk_files)}")
    for cf in chunk_files[:3]:
        sz = os.path.getsize(cf)
        sha = compute_file_sha256(cf)
        print(f"  - Chunk: {os.path.basename(cf)} | Size: {sz} bytes | SHA-256: {sha[:16]}...")

    print("\n============================================================")
    print("STEP 3: INSPECT CANONICAL PACKET OBJECT SAMPLE")
    print("============================================================")
    pkt_sample = None
    if session._source and hasattr(session._source, "_queue"):
        # Peek at events received
        if session._window_events:
            pkt_sample = session._window_events[0]
            
    if pkt_sample:
        print(json.dumps(pkt_sample, indent=2))
        assert pkt_sample["source_type"] == "live"
        assert pkt_sample["job_id"] == session.session_id
        assert len(pkt_sample["src_ip"]) > 0
        assert len(pkt_sample["dst_ip"]) > 0
    else:
        print("No packet in buffer at time of sample.")

    print("\n============================================================")
    print("STEP 4: FLOW AGGREGATION SAMPLE")
    print("============================================================")
    if session._window_events:
        flows = build_flows_from_events(session._window_events[:20])
        print(f"Total Flows Extracted from sample: {len(flows)}")
        if flows:
            print("Flow Sample:", json.dumps(flows[0], indent=2))
    
    print("\n============================================================")
    print("STEP 5: FORECAST ENGINE INGESTION & PREDICTION RESULT")
    print("============================================================")
    print("Current Stage:", forecast.get("current_stage"))
    print("Predicted Next Stage:", forecast.get("predicted_next_stage"))
    print("Confidence:", forecast.get("confidence"))
    print("Supporting Features:", forecast.get("supporting_features"))
    print("Stage Probabilities:", json.dumps(forecast.get("stage_probabilities"), indent=2))

    session.stop()
    print("\n============================================================")
    print("STEP 6: CLEAN SHUTDOWN VERIFICATION")
    print("============================================================")
    print("Live session stopped successfully. Running status:", session.running)


if __name__ == "__main__":
    asyncio.run(verify_e2e_pipeline())
