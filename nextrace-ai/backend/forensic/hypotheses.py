"""
NEXTRACE AI — Forensic Hypothesis Generator & Evaluator

Builds DETERMINISTIC hypotheses from the historical evidence.
Only creates a hypothesis when relevant evidence exists.

Uses a simple evidence-weighting mechanism:
  Supporting evidence items   → +weight
  Contradicting evidence items → -weight
  Missing/limited evidence     → cap maximum confidence

DISCLAIMER:
This is a PROTOTYPE reasoning model.
Confidence values are deterministic heuristic estimates.
Do NOT treat these as statistically proven or legally actionable conclusions.
"""
from __future__ import annotations

import uuid
from typing import Any


# ── Status values ─────────────────────────────────────────────────────────────
SUPPORTED           = "SUPPORTED"
PLAUSIBLE           = "PLAUSIBLE"
WEAK                = "WEAK"
INSUFFICIENT        = "INSUFFICIENT_EVIDENCE"


def _status_from_confidence(conf: int) -> str:
    if conf >= 65:
        return SUPPORTED
    elif conf >= 45:
        return PLAUSIBLE
    elif conf >= 25:
        return WEAK
    return INSUFFICIENT


def _make_hypothesis(
    hid: str,
    title: str,
    description: str,
    supporting: list[str],
    contradicting: list[str],
    limitations: list[str],
    base_confidence: int,
) -> dict[str, Any]:
    """
    Build and evaluate a hypothesis dict.
    confidence is capped at 90 (prototype — never claims certainty).
    """
    weight = base_confidence
    weight += len(supporting) * 5
    weight -= len(contradicting) * 8
    weight -= len(limitations) * 3
    confidence = max(0, min(90, weight))
    status = _status_from_confidence(confidence)

    return {
        "id":                   hid,
        "title":                title,
        "description":          description,
        "confidence":           confidence,
        "supporting_evidence":  supporting,
        "contradicting_evidence": contradicting,
        "limitations":          limitations,
        "status":               status,
        "prototype_note": (
            "Prototype reasoning model. Confidence is a deterministic heuristic estimate. "
            "Not statistically proven. Requires expert human review."
        ),
    }


# ── Hypothesis generators ─────────────────────────────────────────────────────

def _h1_reconnaissance(result: dict[str, Any]) -> dict[str, Any] | None:
    """H1 — Reconnaissance Activity: port scans, ICMP probes."""
    events = result.get("suspicious_events", [])
    port_scan = [e for e in events if e.get("type") == "port_scan_indicator"]
    icmp_scan  = [e for e in events if e.get("type") == "icmp_anomaly"]
    if not port_scan and not icmp_scan:
        return None

    supporting: list[str] = []
    contradicting: list[str] = []
    limitations: list[str] = []

    for e in port_scan:
        supporting.append(
            f"Port scan indicator: {e.get('src_ip')} contacted multiple unique "
            f"destination ports ({e.get('reason', '').split('.')[0].strip()})."
        )
    for e in icmp_scan:
        supporting.append(
            f"ICMP anomaly: elevated ICMP packet volume from "
            f"{e.get('src_ip')} → {e.get('dst_ip')}."
        )

    # Contradictions: low overall packet rate in the same windows
    windows = result.get("temporal_windows", [])
    low_rate_wins = [w for w in windows if w.get("connection_rate", 0) < 2.0]
    if low_rate_wins:
        contradicting.append(
            f"{len(low_rate_wins)} temporal window(s) show a very low connection "
            f"rate, which may be inconsistent with aggressive scanning activity."
        )

    limitations.append(
        "Heuristic port-scan detection uses unique-destination-port count only. "
        "Actual scan tool fingerprinting is not available in this prototype."
    )

    return _make_hypothesis(
        hid=f"H1-{str(uuid.uuid4())[:6].upper()}",
        title="H1 — Possible Reconnaissance Activity",
        description=(
            "Observed indicators may suggest systematic network probing or "
            "port discovery activity. Evidence includes elevated unique destination "
            "port counts and/or ICMP probe patterns."
        ),
        supporting=supporting,
        contradicting=contradicting,
        limitations=limitations,
        base_confidence=48,
    )


def _h2_auth_brute(result: dict[str, Any]) -> dict[str, Any] | None:
    """H2 — Repeated Service/Auth Attempts: SSH/RDP/DB brute force."""
    events = result.get("suspicious_events", [])
    brute  = [e for e in events if e.get("type") == "brute_force_indicator"]
    if not brute:
        return None

    supporting: list[str] = []
    contradicting: list[str] = []
    limitations: list[str] = []

    auth_port_names = {22: "SSH", 3389: "RDP", 23: "Telnet", 21: "FTP",
                       1433: "MSSQL", 3306: "MySQL", 5432: "PostgreSQL"}

    ports_seen: set[int] = set()
    for e in brute:
        port = e.get("port", 0)
        ports_seen.add(port)
        svc = auth_port_names.get(port, f"port {port}")
        supporting.append(
            f"Repeated connection attempts to {svc} (port {port}) "
            f"from {e.get('src_ip')} → {e.get('dst_ip')}."
        )

    if len(ports_seen) > 1:
        supporting.append(
            f"Multiple authentication services targeted ({', '.join(str(p) for p in sorted(ports_seen))}), "
            f"consistent with opportunistic service enumeration."
        )

    # Look for a port-scan indicator from the same source — corroborating
    port_scans = [e for e in events if e.get("type") == "port_scan_indicator"]
    brute_srcs = {e.get("src_ip") for e in brute}
    scan_srcs  = {e.get("src_ip") for e in port_scans}
    if brute_srcs & scan_srcs:
        supporting.append(
            "Same source IP also associated with port scan indicators, suggesting "
            "reconnaissance preceding the authentication attempts."
        )

    limitations.append(
        "Heuristic detection counts connection attempts per flow. "
        "Individual packet-level authentication challenge/response analysis "
        "is not available in this prototype."
    )
    limitations.append(
        "Successful vs. failed authentication cannot be determined "
        "from available flow-level data."
    )

    return _make_hypothesis(
        hid=f"H2-{str(uuid.uuid4())[:6].upper()}",
        title="H2 — Possible Repeated Service/Authentication Attempts",
        description=(
            "Observed indicators may suggest repeated attempts against one or more "
            "network authentication services. This pattern is sometimes associated "
            "with credential stuffing or brute-force behaviour, but cannot be "
            "confirmed from flow-level data alone."
        ),
        supporting=supporting,
        contradicting=contradicting,
        limitations=limitations,
        base_confidence=52,
    )


def _h3_lateral_movement(result: dict[str, Any]) -> dict[str, Any] | None:
    """H3 — Lateral Movement: suspicious communication across internal entities."""
    entities = result.get("entity_relationships", [])
    sus_rels  = [e for e in entities if e.get("is_suspicious")]

    # Lateral movement indicator: ≥2 suspicious internal→internal flows in sequence
    internal_ranges = ("10.", "192.168.", "172.16.", "172.17.", "172.18.",
                       "172.19.", "172.20.", "172.21.", "172.22.", "172.23.",
                       "172.24.", "172.25.", "172.26.", "172.27.", "172.28.",
                       "172.29.", "172.30.", "172.31.", "fd", "fc")

    def _is_internal(ip: str) -> bool:
        return any(ip.startswith(r) for r in internal_ranges)

    internal_sus = [
        r for r in sus_rels
        if _is_internal(r.get("src_ip", "")) and _is_internal(r.get("dst_ip", ""))
    ]
    if len(internal_sus) < 2:
        return None

    supporting: list[str] = []
    contradicting: list[str] = []
    limitations: list[str] = []

    for rel in internal_sus:
        supporting.append(
            f"Suspicious internal flow: {rel.get('src_ip')} → {rel.get('dst_ip')} "
            f"({rel.get('packet_count')} packets, ports: "
            f"{', '.join(str(p) for p in (rel.get('ports') or [])[:4])})."
        )

    # Check sequential timing
    sorted_rels = sorted(
        internal_sus,
        key=lambda r: r.get("first_seen") or 0,
    )
    if len(sorted_rels) >= 2:
        f1 = sorted_rels[0]
        f2 = sorted_rels[1]
        t1 = f1.get("last_seen") or 0
        t2 = f2.get("first_seen") or 0
        if 0 < (t2 - t1) < 120:
            supporting.append(
                f"Sequential timing: flow to {f1.get('dst_ip')} completed "
                f"{t2 - t1:.1f}s before flow from {f2.get('src_ip')} began, "
                f"suggesting possible pivot."
            )

    limitations.append(
        "Internal IP classification uses RFC1918 ranges only. "
        "Actual network segmentation and VLAN boundaries are not known."
    )
    limitations.append(
        "Flow-level data does not provide application-layer context "
        "to confirm lateral movement technique."
    )

    return _make_hypothesis(
        hid=f"H3-{str(uuid.uuid4())[:6].upper()}",
        title="H3 — Possible Lateral Movement Pattern",
        description=(
            "Observed internal-to-internal suspicious communication may suggest "
            "lateral movement between network entities. The pattern shows "
            "suspicious flows traversing multiple internal hosts in a manner "
            "consistent with pivot activity, but this cannot be confirmed "
            "from available evidence."
        ),
        supporting=supporting,
        contradicting=contradicting,
        limitations=limitations,
        base_confidence=42,
    )


def _h4_exfiltration(result: dict[str, Any]) -> dict[str, Any] | None:
    """H4 — Possible Data Exfiltration: large outbound transfer."""
    events = result.get("suspicious_events", [])
    large  = [e for e in events if e.get("type") == "large_transfer_indicator"]
    if not large:
        return None

    supporting: list[str] = []
    contradicting: list[str] = []
    limitations: list[str] = []

    internal_ranges = ("10.", "192.168.", "172.")

    for e in large:
        src = e.get("src_ip", "—")
        dst = e.get("dst_ip", "—")
        # Outbound if src is internal and dst is external
        src_int = any(src.startswith(r) for r in internal_ranges)
        dst_int = any(dst.startswith(r) for r in internal_ranges)
        direction = "internal→external" if src_int and not dst_int else "observed"
        supporting.append(
            f"Large {direction} transfer: {src} → {dst} "
            f"({e.get('reason', '').split('.')[0]})."
        )
        if src_int and not dst_int:
            supporting.append(
                f"Destination {dst} is outside the observed internal address space, "
                f"consistent with egress transfer pattern."
            )
        else:
            contradicting.append(
                f"Transfer between {src} → {dst} may be internal; "
                f"exfiltration hypothesis is less supported for this flow."
            )

    # Corroborate with H1/H2 evidence (recon before exfil)
    port_scans = [e for e in events if e.get("type") == "port_scan_indicator"]
    if port_scans:
        supporting.append(
            "Prior reconnaissance indicators were observed in the same capture, "
            "consistent with a multi-stage activity pattern."
        )

    limitations.append(
        "Transfer content is not available for inspection. "
        "Large volume alone does not confirm exfiltration of sensitive data."
    )
    limitations.append(
        "Encryption or tunnelling (e.g., TLS on port 443) cannot be "
        "distinguished from legitimate large HTTPS transfers at flow level."
    )

    return _make_hypothesis(
        hid=f"H4-{str(uuid.uuid4())[:6].upper()}",
        title="H4 — Possible Data Exfiltration Pattern",
        description=(
            "Observed indicators include unusually large outbound data transfer "
            "volumes that may be consistent with data exfiltration activity. "
            "This is an indicator only — transfer volume alone does not confirm "
            "that sensitive data was transferred."
        ),
        supporting=supporting,
        contradicting=contradicting,
        limitations=limitations,
        base_confidence=50,
    )


def _h5_c2_beaconing(result: dict[str, Any]) -> dict[str, Any] | None:
    """H5 — C2/Beaconing: periodic repeated communication patterns."""
    windows = result.get("temporal_windows", [])
    if len(windows) < 4:
        return None

    # Look for consistent non-zero connection rates across multiple windows
    # suggesting periodic background communication (beaconing heuristic)
    active_windows = [
        w for w in windows if w.get("connection_rate", 0) > 0.5
    ]
    if len(active_windows) < 3:
        return None

    # Check if there are windows with very consistent (low-variance) rates
    rates = [w["connection_rate"] for w in active_windows]
    mean_rate  = sum(rates) / len(rates)
    variance   = sum((r - mean_rate) ** 2 for r in rates) / len(rates)
    std_dev    = variance ** 0.5
    cv = std_dev / mean_rate if mean_rate > 0 else 99  # coefficient of variation

    # Low CV = more consistent = more beacon-like; but we require strong evidence
    if cv > 0.8:
        return None  # Too variable to indicate beaconing

    entities = result.get("entity_relationships", [])
    events = result.get("suspicious_events", [])

    # Need at least some suspicious events to raise this hypothesis
    if not events:
        return None

    supporting: list[str] = []
    contradicting: list[str] = []
    limitations: list[str] = []

    supporting.append(
        f"Connection rate observed across {len(active_windows)} temporal windows "
        f"with coefficient of variation {cv:.2f} (lower = more periodic). "
        f"Mean rate: {mean_rate:.1f} packets/s."
    )

    # Check for repeated flows to same destination
    dst_counts: dict[str, int] = {}
    for rel in entities:
        dst = rel.get("dst_ip", "—")
        dst_counts[dst] = dst_counts.get(dst, 0) + 1
    repeated = {dst: cnt for dst, cnt in dst_counts.items() if cnt > 1}
    if repeated:
        for dst, cnt in repeated.items():
            supporting.append(
                f"Multiple flows observed to destination {dst} "
                f"across {cnt} entity relationship records."
            )

    contradicting.append(
        "No inter-packet timing analysis is available at flow level to "
        "confirm fixed-interval beaconing intervals."
    )
    limitations.append(
        "Coefficient of variation approach is a coarse heuristic. "
        "Statistical beaconing detection requires per-packet timestamps."
    )
    limitations.append(
        "Consistent rates may reflect normal background traffic such as "
        "NTP, DNS, or monitoring heartbeats."
    )

    return _make_hypothesis(
        hid=f"H5-{str(uuid.uuid4())[:6].upper()}",
        title="H5 — Possible C2 / Beaconing Pattern",
        description=(
            "Observed traffic rates across multiple temporal windows show "
            "relatively low variability, which may be consistent with periodic "
            "communication or beaconing behaviour. This is a coarse indicator only "
            "and requires inter-packet timing analysis to confirm."
        ),
        supporting=supporting,
        contradicting=contradicting,
        limitations=limitations,
        base_confidence=30,
    )


# ── Public entry point ─────────────────────────────────────────────────────────

def generate_hypotheses(result: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Generate applicable hypotheses from the historical result.
    Only creates a hypothesis when relevant evidence exists.
    Returns hypotheses sorted by confidence (descending).
    """
    generators = [_h1_reconnaissance, _h2_auth_brute, _h3_lateral_movement,
                  _h4_exfiltration, _h5_c2_beaconing]

    hypotheses: list[dict[str, Any]] = []
    for gen in generators:
        hyp = gen(result)
        if hyp is not None:
            hypotheses.append(hyp)

    hypotheses.sort(key=lambda h: h["confidence"], reverse=True)
    return hypotheses
