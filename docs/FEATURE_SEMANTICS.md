# NEXTRACE AI — Observable Feature Semantics & Anomaly Indicators

**Document Version:** 2.0.0  
**Status:** Validated on Real Physical Network Traffic & PCAP Streams

---

## 1. Principles of Real Network Traffic Analysis

Real network packets do **not** contain ground-truth labels indicating `malicious = true`. Therefore, NexTrace AI never manufactures synthetic malicious labels on live physical traffic. Instead, the platform derives **observable anomaly indicators** and **temporal state metrics** directly from empirical traffic behavior.

---

## 2. Canonical Feature Schema

| Feature Name | Definition | Formula / Derivation | Units | Heuristic / Observable | Used by Forecasting |
|---|---|---|---|---|---|
| `packet_count` | Total packets observed in temporal window | $\sum \text{packets}$ | Count | Observable | Yes |
| `byte_count` | Total payload and header bytes in window | $\sum \text{packet\_size}$ | Bytes | Observable | Yes |
| `flow_count` | Distinct 5-tuple bidirectional network conversations | $\text{Distinct } (\text{IP}_A, \text{IP}_B, \text{Port}_A, \text{Port}_B, \text{Proto})$ | Count | Observable | Yes |
| `unique_src_ips` | Number of distinct source IP addresses | $|\{ \text{src\_ip} \}|$ | Count | Observable | Yes |
| `unique_dst_ips` | Number of distinct destination IP addresses | $|\{ \text{dst\_ip} \}|$ | Count | Observable | Yes |
| `unique_dst_ports` | Number of distinct destination ports targeted | $|\{ \text{dst\_port} \}|$ | Count | Observable | Yes |
| `connection_rate` | Rate of new network conversations per second | $\text{flow\_count} / \Delta t$ | flows/sec | Derived | Yes |
| `packet_rate` | Overall packet transmission rate | $\text{packet\_count} / \Delta t$ | pkts/sec | Derived | Yes |
| `byte_rate` | Total throughput rate | $\text{byte\_count} / \Delta t$ | bytes/sec | Derived | Yes |
| `mean_packet_size` | Average size of packets in window | $\text{byte\_count} / \text{packet\_count}$ | Bytes | Derived | Yes |
| `tcp_count` | Count of TCP packets in window | $\sum [\text{protocol} == \text{'TCP'}]$ | Count | Observable | Yes |
| `udp_count` | Count of UDP packets in window | $\sum [\text{protocol} == \text{'UDP'}]$ | Count | Observable | Yes |
| `icmp_count` | Count of ICMP/ICMPv6 packets in window | $\sum [\text{protocol} \in \{\text{'ICMP'}, \text{'ICMPv6'}\}]$ | Count | Observable | Yes |
| `dns_count` | Count of DNS resolution queries/responses | $\sum [\text{dst\_port} == 53 \lor \text{src\_port} == 53]$ | Count | Observable | Yes |
| `http_count` | Count of HTTP/HTTPS packets | $\sum [\text{port} \in \{80, 443, 8080\}]$ | Count | Observable | Yes |

---

## 3. Observable Anomaly & Suspicion Indicators

The `suspicion_score` ($[0.0, 1.0]$) aggregates observable risk indicators:

1. **High Destination Port Fan-out (Port Scan Heuristic):**
   - *Condition:* $> 10$ distinct destination ports targeted within a single temporal window.
   - *Score Contribution:* $+0.02$ per port beyond baseline (capped at $+0.30$).
2. **High Destination IP Fan-out (Network Sweep Heuristic):**
   - *Condition:* $> 10$ distinct destination IP addresses contacted in window.
   - *Score Contribution:* $+0.02$ per IP beyond baseline (capped at $+0.30$).
3. **Suspicious Port Access (C2 / Admin Services):**
   - *Condition:* Destination ports matching known C2 or remote exploit ports (`1337`, `31337`, `4444`, `5555`, `6667`, `8888`, `9001`, `9999`, `445`, `3389`, `22`, `23`).
   - *Score Contribution:* $+0.15$ per anomalous port flow.
4. **TCP Flag Anomalies:**
   - *SYN Probe Burst:* Multiple TCP packets with `SYN` set but `ACK` unset targeting non-standard ports.
   - *Null / Xmas Scans:* TCP packets with no flags set (`NULL`) or anomalous flag combinations (`FPU`).
   - *Score Contribution:* $+0.20$.
5. **ICMP Flood / Ping Sweep:**
   - *Condition:* ICMP rate exceeding $3.0\text{ pkts/sec}$.
   - *Score Contribution:* $+0.20$.
6. **Connection Rate Burst:**
   - *Condition:* Total packet rate exceeding $200.0\text{ pkts/sec}$.
   - *Score Contribution:* $+0.15$.
