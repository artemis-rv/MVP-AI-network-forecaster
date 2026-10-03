# NEXTRACE AI — Real Live Traffic Capture Architecture

**Document Version:** 2.0.0  
**Target Environment:** Windows 11 (Air-Gapped & Live Physical Deployment)  
**Core Deliverable:** High-Throughput Decoupled Ingestion Engine (`dumpcap` $\to$ Rotating PCAPNG $\to$ Streaming Reader $\to$ Canonical State $\to$ Forecast Engine)

---

## 1. High-Level System Architecture

The NexTrace AI live packet ingestion architecture decouples kernel-level packet acquisition from user-space packet decoding, temporal feature extraction, and ML inference:

```text
               PHYSICAL NETWORK INTERFACE (Wi-Fi / Ethernet)
                                    │
                                    ▼
                                  Npcap
                                    │
                                    ▼
                                 dumpcap
                                    │ (Continuous Raw Packet Ingestion)
                                    ▼
            captures/live/<session_id>/live_session_<session_id>_*.pcapng
                                    │
            ┌───────────────────────┴───────────────────────┐
            │                                               │
            ▼                                               ▼
   Archive & SHA-256 Ledger                     Streaming Worker
                                                            │
                                                            ▼
                                                     CanonicalPacket
                                                            │
                                                            ▼
                                                   Flow / Session Builder
                                                            │
                                                            ▼
                                                   Temporal Window (15s)
                                                            │
                                                            ▼
                                                     Feature Engine
                                                            │
                                                            ▼
                                              Observable Anomaly Indicators
                                                            │
                                                            ▼
                                                   ForecastEngine (predict)
                                                            │
                                                            ▼
                                                        WebSocket
                                                            │
                                                            ▼
                                                    Live Monitoring UI
```

---

## 2. Architectural Principles & Resilience

1. **Kernel Ring Buffer Decoupling:** `dumpcap.exe` runs as an autonomous native background process utilizing Npcap kernel-level ring buffers (`-B 64`) and full packet snapshot (`-s 0`). Slow Python execution or heavy model inference will never drop kernel packets.
2. **Rotating PCAPNG Chunks:** Packets are captured into rolling PCAPNG chunks (`-b duration:2` to `-b duration:5` with `-b files:100`). Chunks are stored in session-isolated directories (`captures/live/<session_id>/`).
3. **Session & PCAP Isolation:** Every live capture session receives a unique `session_id` (`LIVE-xxxxxx`). Every historical PCAP job receives a unique `job_id` (`PCAP-xxxxxx`). Queues, flow tables, temporal windows, and feature states are strictly isolated without data mixing.
4. **Resilience to Client Disconnection:** Live capture and temporal feature extraction proceed uninterrupted if browser tabs close or WebSockets disconnect.
5. **Raw Capture as Single Source of Truth:** All live packets exist as raw PCAPNG files on disk first before entering the canonical parsing pipeline.

---

## 3. Data Ingestion & State Pipeline

```text
PCAPNG Packet ──► Scapy/Dpkt Parser ──► CanonicalPacket (LIVE, session_id, interface, 5-tuple, size, flags)
                                                │
                                                ▼
                                    Bidirectional Flow Builder (5-tuple keys)
                                                │
                                                ▼
                                     Temporal Window State (15s sliding)
                                                │
                                                ▼
                                    Feature & Anomaly Engine (rates, diversity, suspicion score)
                                                │
                                                ▼
                                        RuleBasedForecastEngine
                                                │
                                                ▼
                                  ForecastResult & WebSocket Broadcast
```

---

## 4. Health State Machine

The capture engine maintains explicit operational states:
- **`STARTING`**: Subprocess spawned; waiting for initial packets during startup grace period.
- **`RUNNING`**: Capture active AND packets actively traversing the pipeline.
- **`NO_TRAFFIC`**: Capture process is alive, but 0 packets observed on the selected interface. (The UI displays a dedicated diagnostic banner rather than falsely claiming healthy "LIVE").
- **`DEGRADED`**: Packet loss or queue drops detected.
- **`FAILED`**: Subprocess crashed or exited with an error code.
- **`STOPPING` / `STOPPED`**: Clean teardown and idle state.
