# Architecture Audit: Network Attack Forecaster Prototype
**Date:** October 2026  
**System:** NEXTRACE AI (MVP AI Network Forecaster)  
**Objective:** Architecture baseline audit prior to real traffic / PCAP ingestion conversion.

---

## 1. Executive Summary & Repository Structure

The repository contains a hybrid architecture consisting of:
1. **Frontend (`nextrace-ai/src/`):** React 19 + TypeScript + Vite web dashboard providing SOC Analyst views (Live Monitoring, Alerts, Forensics, Investigation, Simulation, Reports, Model Benchmarks).
2. **Operational API Backend (`nextrace-ai/backend/`):** FastAPI + Uvicorn server providing:
   - Live traffic streaming via WebSockets (`/ws/live`) and REST session control (`/api/live/start`, `/api/live/stop`).
   - Attack forecasting engine (`/api/forecast/current`).
   - Historical PCAP analysis & immutable SHA-256 ledger (`/api/historical/upload`, `/api/historical/{job_id}/result`).
   - Forensic hypothesis testing & anti-forensic detection (`/api/forensic/...`).
   - Autoregressive attack trajectory simulation (`/api/simulator/...`).
   - Analyst reporting and security alerts store (`/api/reports/...`, `/api/alerts/...`).
3. **Machine Learning Research Core (`backend/ml/`):** PyTorch + Scikit-Learn training pipelines for offline NetFlow sequence learning (NF-UNSW-NB15-v3 dataset, 53 scaled features, 10-step temporal sliding window, `LSTMAttentionWorldModel` dual-head classifier).

---

## 2. Current Input Paths

### A. Synthetic Live Traffic Stream
- **Source:** [`nextrace-ai/backend/traffic/generator.py`](file:///d:/MVP-AI-network-forecaster/nextrace-ai/backend/traffic/generator.py)
- **Mechanism:** `generate_event(mode)` produces synthetic `PacketEvent` dictionaries with randomized IP headers, protocols (TCP, UDP, ICMP, DNS, HTTP), payload info strings, and synthetic classification labels (`"benign"` or `"suspicious"`).
- **Driver:** [`nextrace-ai/backend/services/live_session.py`](file:///d:/MVP-AI-network-forecaster/nextrace-ai/backend/services/live_session.py) runs an `asyncio` task (`_run_generator`) generating 20–100 simulated pkts/sec into an in-memory rolling buffer (`_window_events`).
- **Broadcast:** Pushes individual packet events and 1-second partial window updates over WebSockets (`/ws/live`) to connected browser clients.

### B. Historical PCAP File Ingestion
- **Source:** [`nextrace-ai/backend/api/historical.py`](file:///d:/MVP-AI-network-forecaster/nextrace-ai/backend/api/historical.py)
- **Parser:** [`nextrace-ai/backend/historical/parser.py`](file:///d:/MVP-AI-network-forecaster/nextrace-ai/backend/historical/parser.py)
- **Supported Formats:** `.pcap`, `.pcapng`, `.cap`, `.gz`.
- **Parsing Cascade:**
  1. `dpkt` streaming parser (fastest).
  2. Pure-Python binary fallback for classic libpcap headers.
  3. Scapy `PcapReader` / `PcapNgReader` streaming fallback.
  4. Scapy `rdpcap` in-memory fallback.
- **Output:** List of flat packet dictionaries (`timestamp`, `src_ip`, `dst_ip`, `src_port`, `dst_port`, `protocol`, `size`, `flags`, `payload_hex`).

---

## 3. Feature Schemas & Preprocessing

### A. Live / Demo Temporal Window Schema (`TemporalState`)
Calculated by [`nextrace-ai/backend/features/engineering.py`](file:///d:/MVP-AI-network-forecaster/nextrace-ai/backend/features/engineering.py) over events in a `[window_start, window_end]` time range (default 15s):
| Field | Type | Description |
|---|---|---|
| `window_start` / `window_end` | `str` (ISO 8601) | Temporal boundaries |
| `window_seconds` | `int` | Window duration (5s–60s) |
| `packet_count` | `int` | Total packets in window |
| `byte_count` | `int` | Total bytes in window |
| `flow_count` | `int` | Distinct 3-tuple `(src_ip, dst_ip, dst_port)` |
| `benign_count` | `int` | Benign packet count |
| `suspicious_count` | `int` | Suspicious packet count |
| `unique_src_ips` | `int` | Unique source IP count |
| `unique_dst_ips` | `int` | Unique destination IP count |
| `unique_dst_ports`| `int` | Unique destination port count |
| `tcp_count` / `udp_count` / `icmp_count` / `dns_count` / `http_count` | `int` | Protocol packet counts |
| `mean_packet_size` | `float` | `byte_count / packet_count` |
| `connection_rate` | `float` | Packets per second |
| `suspicious_ratio` | `float` | `suspicious_count / packet_count` |

### B. Historical PCAP Window Schema
Calculated by [`nextrace-ai/backend/historical/feature_engineering.py`](file:///d:/MVP-AI-network-forecaster/nextrace-ai/backend/historical/feature_engineering.py):
- Grouped into 5-tuple flows via [`nextrace-ai/backend/historical/flow_builder.py`](file:///d:/MVP-AI-network-forecaster/nextrace-ai/backend/historical/flow_builder.py) (`(src_ip, dst_ip, src_port, dst_port, protocol)`).
- Generates window features matching `TemporalState` fields, plus `window_index`.
- Feeds heuristic detectors (Vertical/Horizontal Port Scans, SSH/Auth Brute-Force, Backdoor/C2 ports, ICMP flood, Large Exfil Transfer, Volumetric DoS, and DPI Payload Signatures).

### C. ML Model Dataset Schema (`backend/ml/`)
- Based on tabular NetFlow v3 datasets (NF-UNSW-NB15-v3).
- Uses 53 numeric flow telemetry features normalized with `StandardScaler` and encoded categoricals with `LabelEncoder`.
- Structured as sliding window sequences of length $T=10$ (`[batch_size, seq_len=10, 53]`).

---

## 4. Current Model & Inference Interface

### Forecasting Contract
Defined in [`nextrace-ai/backend/forecasting/engine.py`](file:///d:/MVP-AI-network-forecaster/nextrace-ai/backend/forecasting/engine.py):
```python
class ForecastEngine(ABC):
    @abstractmethod
    def predict(self, temporal_state: dict[str, Any], mode: str = "benign",
                observed_target: str | None = None) -> dict[str, Any]:
        ...
```
**Output Schema (`ForecastResult`):**
- `current_stage`: Current observed attack stage (`"Reconnaissance"`, `"Initial Access"`, `"Lateral Movement"`, `"Data Exfiltration"`, or `"Normal Activity"`).
- `predicted_next_stage`: Forecasted transition state $P(S_{t+1} \mid S_t)$.
- `confidence`: Confidence score ($0.0 - 1.0$).
- `time_window`: Estimated time to next stage (e.g. `"60–120 seconds"`).
- `target`: Most affected target host IP.
- `supporting_features`: Key evidence strings.
- `feature_contributions`: Feature attribution weights for explainability.
- `state_sequence`: Rolling 10-window history of observed stages.
- `stage_probabilities`: Distribution across all 4 stages.

---

## 5. Live vs. Historical Separation Analysis

| Dimension | Live Stream | Historical PCAP |
|---|---|---|
| **API Boundary** | `/api/live/*`, `/ws/live` | `/api/historical/*` |
| **State Registry** | `live_session.py` singleton | `_JOBS` dictionary keyed by `job_id` |
| **Execution** | Continuous `asyncio` loop | Background thread pool (`run_in_executor`) |
| **Data Scope** | In-memory sliding window buffer | Isolated temporary upload file + structured result |
| **Output Timing** | Incremental 1s ticks + window closes | Final comprehensive result emitted only on 100% completion |

**Status:** Strong logical isolation exists. PCAP jobs and live sessions do not share memory or mutable state.

---

## 6. Sensor, Tooling & Environment Verification

- **Wireshark / TShark:** Installed at `C:\Program Files\Wireshark\tshark.exe` (v4.6.9, 64-bit).
- **Npcap:** Installed at `C:\Program Files\Npcap` (v1.88, libpcap 1.10.6).
- **Available Capture Interfaces:**
  1. `\Device\NPF_{F29B4DBD-A561-47BB-8AAA-2549AA2DBAF7}` (Local Area Connection* 8)
  2. `\Device\NPF_{720E7C3F-DA4A-4C35-8356-4E00A65701B0}` (Local Area Connection* 7)
  3. `\Device\NPF_{1648FCDE-C935-48CA-B9C2-AB4FBAEC7BB7}` (Local Area Connection* 6)
  4. `\Device\NPF_{3C210C52-75C0-4107-801C-422099DE03BE}` (Bluetooth 2)
  5. `\Device\NPF_{6FFD3BAB-8F60-4732-8FDB-E61BD023C829}` (Wi-Fi)
  6. `\Device\NPF_{5F0620FC-21C6-4306-BEC2-E06B21E75DF9}` (Wi-Fi 3)
  7. `\Device\NPF_{5110E91F-2A13-4DAC-BF15-C3AC6D754341}` (Wi-Fi 2)
  8. `\Device\NPF_{AD5B1E16-B25C-4E02-B471-D4727204BD63}` (Ethernet 2)
  9. `\Device\NPF_Loopback` (Adapter for loopback traffic capture)
- **Zeek / Suricata / Wazuh:** Not present in the codebase.
- **Scapy:** Installed (v2.6.1).
- **dpkt:** Present and used in historical parser.

---

## 7. Current Test Coverage Summary

- **Operational Backend (`nextrace-ai/backend/tests/`):** 10 / 10 tests PASS (100% passing).
  - `test_forensic.py`: 2 passed (integrity hash, hypothesis evaluation).
  - `test_historical_real_pcap.py`: 3 passed (PCAP parser, full historical pipeline, forensic reports).
  - `test_simulator.py`: 5 passed (scenario runner, autoregressive trajectory).
- **ML Core (`backend/tests/`):** 6 passed, 6 failed due to pandas 2.2+ string column downcasting and Windows temp file handle contention.

---

## 8. Architecture Gaps & Missing Components

1. **No Canonical Schema Validation Layer:** `TemporalState` and historical features have slight field name variances (`unique_src_ips` vs `src_ips`, `window_index`, etc.).
2. **Missing Real Live Traffic Capture Adapter:** The live session service currently only connects to `generate_event()` (synthetic generator).
3. **Missing Direct PCAP → Forecasting Engine Connection:** Historical PCAP analysis currently runs heuristic rules and timeline builders, but does not feed aggregate windows into `ForecastEngine.predict()`.
4. **Missing Capture Completeness & Loss Accounting:** No tracking of interface drops, buffer overflow, or capture lag.
5. **No Structured Analyst-Approved Firewall Response:** No structured endpoint mitigation controller.

---

## 9. Proposed Minimum-Change Architecture

```text
                               ┌──────────────────────────────┐
                               │       Traffic Sources        │
                               └──────────────┬───────────────┘
                 ┌────────────────────────────┼────────────────────────────┐
                 │                            │                            │
                 ▼                            ▼                            ▼
      ┌──────────────────────┐   ┌─────────────────────────┐   ┌──────────────────────┐
      │   SyntheticSource    │   │       PcapSource        │   │  LiveCaptureSource   │
      │  (generate_event)    │   │ (dpkt / binary stream)  │   │  (TShark / Npcap)    │
      └──────────┬───────────┘   └────────────┬────────────┘   └───────────┬──────────┘
                 │                            │                            │
                 └────────────────────────────┼────────────────────────────┘
                                              ▼
                             ┌──────────────────────────────────┐
                             │    Packet / Flow Normalizer      │
                             │ (Preserves timestamps & 5-tuple) │
                             └────────────────┬─────────────────┘
                                              ▼
                             ┌──────────────────────────────────┐
                             │     Time-Window Aggregator       │
                             │ (Tumbling / Configurable Window) │
                             └────────────────┬─────────────────┘
                                              ▼
                             ┌──────────────────────────────────┐
                             │     Canonical Feature Schema     │
                             │  (Validated against Contract)    │
                             └────────────────┬─────────────────┘
                                              ▼
                             ┌──────────────────────────────────┐
                             │    Existing Forecast Engine      │
                             │   (ForecastEngine.predict())     │
                             └────────────────┬─────────────────┘
                                              ▼
                             ┌──────────────────────────────────┐
                             │       Dashboard / API / WS       │
                             │    (Live Feed & Job Results)     │
                             └──────────────────────────────────┘
```

---

## 10. Identified Risks & Unknowns

### Risks
1. **Packet Capture Loss under Heavy Traffic:** Using raw Scapy packet dissection in Python can drop packets at $>50\text{ Mbps}$. Using `TShark`/`dumpcap` streaming or `dpkt` binary parsing is essential.
2. **PCAP Memory Footprint:** Loading very large PCAPs ($>100\text{ MB}$) entirely into RAM can cause OOM errors.
3. **Feature Semantic Gap:** In synthetic mode, `suspicious_count` is assigned directly by the generator. In real capture, `suspicious_count` must be derived strictly from observable telemetry (unusual ports, high connection rates, abnormal flags, probe behaviors).

### Unknowns Requiring Decision
1. **Primary Live Interface:** Which interface on the test system should be the default (e.g. `Wi-Fi` index 5, or loopback `\Device\NPF_Loopback` for lab testing)?
2. **Forecasting Engine Alignment:** Confirm retaining the current operational `ForecastEngine` contract for Phase 1–5, while maintaining compatibility with deep learning extensions.
