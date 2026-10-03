# Analyst-Approved Endpoint Firewall Response Specification

## 1. Principles & Safety Boundaries

NEXTRACE AI implements proactive, analyst-in-the-loop endpoint containment.

> [!IMPORTANT]
> **Non-Negotiable Safety Constraints:**
> 1. **Analyst Approval Required:** No automated containment is applied without explicit human review.
> 2. **Endpoint Only (No Routers):** Targets strictly the authorized endpoint / host machine. Router or switch configurations are **never** modified.
> 3. **Allowlist Scoping:** Remote targets must strictly belong to authorized RFC 1918 / RFC 5737 lab ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `198.51.100.0/24`, `127.0.0.0/8`).
> 4. **No Arbitrary Shell Execution:** Commands are structured from fixed templates with strict input validation; LLMs or free-text inputs cannot execute arbitrary shell syntax.
> 5. **DRY RUN Default:** All containment requests default to `dry_run=True` simulation unless explicitly authorized.
> 6. **Cryptographic Audit Ledger:** Every containment request and result is hashed with SHA-256 and appended to the immutable audit ledger.

---

## 2. Mitigation Workflow

```text
  [ High-Confidence Forecast / Alert ]
                   │
                   ▼
       [ SOC Analyst Review ]
                   │ (Analyst clicks "Block IP" in Dashboard)
                   ▼
       [ POST /api/alerts/mitigate ]
                   │
                   ├── 1. Validate IP format & RFC 1918 / Lab subnet allowlist
                   ├── 2. Verify Analyst Authorization ID
                   ├── 3. Build Template Command:
                   │      Windows: New-NetFirewallRule -DisplayName "NEXTRACE_BLOCK_<IP>" ...
                   │      Linux:   nft add rule inet filter input ip saddr <IP> drop
                   ├── 4. If DRY_RUN=True: Log simulation without OS modification
                   ├── 5. If DRY_RUN=False: Execute via subprocess argument array
                   └── 6. Compute SHA-256 Audit Signature & store in Ledger
```

---

## 3. Structured API Example

### Request:
```json
POST /api/alerts/mitigate
{
  "action": "BLOCK_REMOTE_IP",
  "target_host": "192.168.1.50",
  "remote_ip": "10.0.0.99",
  "direction": "inbound",
  "duration_seconds": 300,
  "analyst_id": "SOC_ANALYST_01",
  "reason": "Repeated SSH brute force and horizontal sweep detected (ACT-0042)",
  "dry_run": true
}
```

### Response:
```json
{
  "action_id": "FW-A1B2C3D4",
  "status": "DRY_RUN_SUCCESS",
  "action": "BLOCK_REMOTE_IP",
  "remote_ip": "10.0.0.99",
  "target_host": "192.168.1.50",
  "rule_name": "NEXTRACE_BLOCK_10_0_0_99",
  "command_executed": "[SIMULATED] New-NetFirewallRule -DisplayName \"NEXTRACE_BLOCK_10_0_0_99\" -Direction Inbound -Action Block -RemoteAddress \"10.0.0.99\"",
  "analyst_id": "SOC_ANALYST_01",
  "timestamp": 1710000100.5,
  "audit_hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  "details": "Dry run simulated successfully for analyst SOC_ANALYST_01. No system changes applied."
}
```
