# Canonical Traffic Schema Specification

## 1. Overview & Purpose
This document defines the **Canonical Traffic Data Contract** for the NEXTRACE AI Network Attack Forecasting Platform. Every input source—whether **Synthetic**, **Historical PCAP**, or **Windows Live Capture**—must normalize its output to this single schema before feature extraction, temporal windowing, and forecast inference.

```text
  [Synthetic Generator] ──┐
  [Historical PCAP]     ──┼─► [Canonical Normalizer] ─► [5-Tuple Flow Builder] ─► [Temporal State Window] ─► [Forecast Engine]
  [Windows Live Stream] ──┘
```

---

## 2. Canonical Packet Event Schema (`CanonicalPacket`)

| Field | Type | Units / Format | Source | Required? | Preprocessing | Missing Value Handling | Model Usage |
|---|---|---|---|---|---|---|---|
| `timestamp` | `float` | Unix Epoch (sec) | Packet Header | Required | Micro/Nano float conversion | Set to current epoch timestamp | Temporal sequencing & window binning |
| `src_ip` | `str` | IPv4 / IPv6 dot/colon notation | L3 Header (IP/IPv6/ARP) | Required | Normalized string, whitespace trimmed | Set to `"0.0.0.0"` | Entity tracking, unique source counts, sweep detection |
| `dst_ip` | `str` | IPv4 / IPv6 dot/colon notation | L3 Header (IP/IPv6/ARP) | Required | Normalized string, whitespace trimmed | Set to `"0.0.0.0"` | Target host identification, lateral movement, subnet sweep |
| `src_port` | `int` | `0–65535` | L4 Header (TCP/UDP) | Required | Integer parsing | Set to `0` (e.g. for ICMP/ARP) | Ephemeral source port analysis |
| `dst_port` | `int` | `0–65535` | L4 Header (TCP/UDP) | Required | Integer parsing | Set to `0` (e.g. for ICMP/ARP) | Service classification, port scan diversity, auth probing |
| `protocol` | `str` | Enum: `TCP`, `UDP`, `ICMP`, `DNS`, `HTTP`, `OTHER` | L3/L4/L7 Inspection | Required | Upper case string | Set to `"OTHER"` | Protocol breakdown counters (`tcp_count`, `udp_count`, etc.) |
| `packet_size` | `int` | Bytes | Wire length / Frame length | Required | Integer parsing (`caplen`/`origlen`) | Set to `64` minimum | Byte volume calculation, mean packet size |
| `tcp_flags` | `str` | String of flag chars (`S`, `A`, `F`, `R`, `P`, `U`) | TCP Header (byte 13) | Optional | Uppercase letters | Set to `""` (empty string) | Port scan heuristic (SYN without ACK, NULL, Xmas scan) |
| `payload_info` | `str` | Truncated string description | L7 inspection / DPI | Optional | Sanitized plain text (max 256 chars) | Set to `""` | Analyst telemetry & payload signatures |
| `payload_hex` | `str` | Hexadecimal string | L7 payload bytes | Optional | Lowercase hex string | Set to `""` | Deep packet inspection signature detection |
| `source_type` | `str` | `"synthetic"`, `"pcap"`, `"live"` | Adapter boundary | Required | Tagged by adapter | Required | Strict job and stream isolation |
| `job_id` | `str` | Unique job/session identifier | Adapter / Session | Required | String identifier | Generated UUID if empty | Isolation across concurrent jobs |

---

## 3. Canonical Flow Schema (`CanonicalFlow`)

| Field | Type | Units | Source | Description |
|---|---|---|---|---|
| `flow_id` | `str` | Unique 5-tuple hash | Flow Builder | `SHA256(src_ip, dst_ip, src_port, dst_port, protocol)` |
| `src_ip` | `str` | IP address | Packet stream | Source host |
| `dst_ip` | `str` | IP address | Packet stream | Target host |
| `src_port` | `int` | `0–65535` | Packet stream | Source port |
| `dst_port` | `int` | `0–65535` | Packet stream | Destination port |
| `protocol` | `str` | Protocol name | Packet stream | Transport protocol |
| `packet_count` | `int` | Count | Packet stream | Total packets in flow |
| `byte_count` | `int` | Bytes | Packet stream | Total bytes transferred |
| `first_seen` | `float` | Unix epoch (s) | Packet timestamp | Timestamp of first observed packet |
| `last_seen` | `float` | Unix epoch (s) | Packet timestamp | Timestamp of last observed packet |
| `duration_s` | `float` | Seconds | `last_seen - first_seen` | Active duration of session |
| `flags` | `list[str]` | List of TCP flags | Packet stream | All unique TCP flags observed across flow |
| `is_suspicious`| `bool` | Boolean flag | Heuristic engine | Flow-level anomaly classification |

---

## 4. Canonical Temporal Window State (`CanonicalTemporalState`)

Matches the operational [`TemporalState`](file:///d:/MVP-AI-network-forecaster/nextrace-ai/backend/models/schemas.py#L25-L50) schema consumed by `ForecastEngine`:

| Field | Type | Units | Calculation / Source | Model Usage |
|---|---|---|---|---|
| `window_start` | `str` | ISO 8601 UTC string (`...Z`) | Bin lower bound | Time tracking |
| `window_end` | `str` | ISO 8601 UTC string (`...Z`) | Bin upper bound | Time tracking |
| `window_seconds` | `int` | Seconds ($5\text{s}–60\text{s}$) | Configuration | Rate denominator |
| `packet_count` | `int` | Count ($N$) | Number of packets in window | Volumetric traffic scale |
| `byte_count` | `int` | Bytes | Sum of `packet_size` in window | Exfiltration / Flood indicator |
| `flow_count` | `int` | Count | Distinct flows in window | Connection diversity |
| `benign_count` | `int` | Count | $N - \text{suspicious\_count}$ | Baseline activity counter |
| `suspicious_count` | `int` | Count | Anomaly-derived in real traffic | Anomaly volume numerator |
| `unique_src_ips` | `int` | Count | Cardinality of $\{src\_ip\}$ | Multi-source / botnet detection |
| `unique_dst_ips` | `int` | Count | Cardinality of $\{dst\_ip\}$ | Horizontal sweep indicator |
| `unique_dst_ports` | `int` | Count | Cardinality of $\{dst\_port\}$ | Vertical port scan indicator |
| `tcp_count` | `int` | Count | Count where `protocol == "TCP"` | Protocol distribution |
| `udp_count` | `int` | Count | Count where `protocol == "UDP"` | Protocol distribution |
| `icmp_count` | `int` | Count | Count where `protocol == "ICMP"` | Reconnaissance ping indicator |
| `dns_count` | `int` | Count | Count where `protocol == "DNS"` | DNS tunnel indicator |
| `http_count` | `int` | Count | Count where `protocol == "HTTP"` | Web traffic indicator |
| `mean_packet_size` | `float` | Bytes/pkt | `byte_count / packet_count` | Payload profile |
| `connection_rate` | `float` | Pkts/sec | `packet_count / window_seconds` | Rate spike / DoS indicator |
| `suspicious_ratio` | `float` | Ratio ($0.0–1.0$) | `suspicious_count / packet_count` | Primary attack progression signal |

---

## 5. Distinction: Synthetic Ground Truth vs. Real-World Telemetry

> [!IMPORTANT]
> **Synthetic Mode:** Packets have an artificial label (`classification: "suspicious"` or `"benign"`).
>
> **Real Traffic Mode (PCAP & Live):** Network frames contain **NO ground-truth label**. 
> The `suspicious_count` and `suspicious_ratio` are computed deterministically from observable network anomalies (unusual port access, SYN scan patterns, authentication flood attempts, abnormal flag combinations, ICMP flood, and high volumetric anomalies).
