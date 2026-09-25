"""
NEXTRACE AI — Deterministic Findings Builder (Step 8)

Generates structured Finding objects from completed forensic/historical
or completed simulation results.

ISOLATION:
  - Reads from: _HIST_JOBS (historical), _FORENSIC_JOBS (forensic), engine (simulator)
  - NEVER reads: live session state, forecast state, investigation state
  - NEVER mutates source data

IMPORTANT:
  - No findings are fabricated. Every finding traces back to a source field.
  - Severity is derived deterministically from source data.
  - Confidence is kept distinct from severity.
  - Simulation findings are clearly labelled sourceType = "simulation".
"""
from __future__ import annotations

import time
import uuid
from typing import Any


# ── Finding severity / category constants ──────────────────────────────────────

SEVERITY_LOW      = "LOW"
SEVERITY_MEDIUM   = "MEDIUM"
SEVERITY_HIGH     = "HIGH"
SEVERITY_CRITICAL = "CRITICAL"

CAT_NETWORK_ACTIVITY   = "Network Activity"
CAT_SUSPICIOUS         = "Suspicious Activity"
CAT_ATTACK_PROGRESSION = "Attack Progression"
CAT_EVIDENCE_INTEGRITY = "Evidence Integrity"
CAT_ANTI_FORENSIC      = "Anti-Forensic Indicator"
CAT_HYPOTHESIS         = "Hypothesis"
CAT_FORECAST           = "Forecast"
CAT_SIMULATION         = "Simulation"


def _new_finding(
    *,
    title:       str,
    category:    str,
    severity:    str,
    confidence:  int,
    summary:     str,
    evidence:    list[str],
    source_type: str,   # "historical" | "simulation"
    source_id:   str,
) -> dict[str, Any]:
    return {
        "id":          f"FND-{str(uuid.uuid4())[:8].upper()}",
        "title":       title,
        "category":    category,
        "severity":    severity,
        "confidence":  confidence,
        "summary":     summary,
        "evidence":    evidence,
        "source_type": source_type,
        "source_id":   source_id,
        "created_at":  time.time(),
    }


# ── Historical / Forensic findings ────────────────────────────────────────────

def build_historical_findings(
    hist_job:       dict[str, Any],
    forensic_result: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Deterministically generate findings from a completed historical job
    and its completed forensic analysis result.

    Every finding references actual fields from the source data.
    No finding is generated without a traceable source reference.
    """
    findings: list[dict[str, Any]] = []
    job_id   = hist_job.get("job_id", "unknown")
    hist_res = hist_job.get("result", {}) or {}
    is_demo  = hist_job.get("is_demo", False)

    integrity   = forensic_result.get("integrity",                {}) or {}
    ev_summary  = forensic_result.get("evidence_summary",          {}) or {}
    indicators  = forensic_result.get("anti_forensic_indicators", []) or []
    hypotheses  = forensic_result.get("hypotheses",               []) or []
    assessment  = forensic_result.get("final_assessment",          {}) or {}

    sus_events  = hist_res.get("suspicious_events",    []) or []
    entities    = hist_res.get("entity_relationships", []) or []
    windows     = hist_res.get("temporal_windows",     []) or []
    src_ips     = hist_res.get("top_src_ips",          []) or []
    dst_ports   = hist_res.get("top_dst_ports",        []) or []

    # ── 1. Evidence integrity finding ─────────────────────────────────────────
    int_status = integrity.get("status", "UNAVAILABLE")
    int_sha    = integrity.get("sha256")
    int_label  = integrity.get("filename", "unknown file")
    findings.append(_new_finding(
        title=f"Evidence integrity: {int_status}",
        category=CAT_EVIDENCE_INTEGRITY,
        severity=SEVERITY_LOW if int_status == "VERIFIED" else SEVERITY_MEDIUM,
        confidence=90 if int_status == "VERIFIED" else 60,
        summary=(
            f"SHA-256 hash recorded for '{int_label}' — "
            f"{'hash: ' + int_sha[:16] + '…' if int_sha else 'hash not available'}. "
            f"Integrity status: {int_status}. "
            f"{'Prototype evidence integrity metadata only — not a chain-of-custody record.' if is_demo else ''}"
        ),
        evidence=[
            f"Source: historical job {job_id}",
            f"File: {int_label} ({integrity.get('file_size', 0):,} bytes)",
            f"Packets recorded: {integrity.get('packet_count', 0):,}",
            f"Flows recorded: {integrity.get('flow_count', 0):,}",
            f"Analysis status: {integrity.get('analysis_status', 'unknown')}",
        ],
        source_type="historical",
        source_id=job_id,
    ))

    # ── 2. Network activity summary ───────────────────────────────────────────
    net_ev = ev_summary.get("network_evidence", [])
    if net_ev:
        findings.append(_new_finding(
            title="Network activity observed in capture",
            category=CAT_NETWORK_ACTIVITY,
            severity=SEVERITY_LOW,
            confidence=85,
            summary=(
                f"{len(net_ev)} network activity observation(s) derived from "
                f"the historical PCAP capture. "
                f"Observations are based on flow-level metadata and packet counts only."
            ),
            evidence=net_ev[:5] + [f"Source: historical job {job_id}"],
            source_type="historical",
            source_id=job_id,
        ))



    # ── 4. Suspicious entity relationships ────────────────────────────────────
    sus_rels = [r for r in entities if r.get("is_suspicious")]
    if sus_rels:
        rel = sus_rels[0]
        findings.append(_new_finding(
            title=f"Suspicious communication pair: {rel.get('src_ip')} → {rel.get('dst_ip')}",
            category=CAT_SUSPICIOUS,
            severity=SEVERITY_MEDIUM,
            confidence=55,
            summary=(
                f"Entity relationship flagged as suspicious: "
                f"{rel.get('src_ip')} → {rel.get('dst_ip')}. "
                f"{rel.get('packet_count', 0):,} packets, "
                f"{rel.get('byte_count', 0):,} bytes. "
                f"Protocols: {', '.join(rel.get('protocols', []))}."
            ),
            evidence=[
                f"Source IP: {rel.get('src_ip')}",
                f"Destination IP: {rel.get('dst_ip')}",
                f"Packet count: {rel.get('packet_count', 0):,}",
                f"Byte count: {rel.get('byte_count', 0):,}",
                f"Protocols: {', '.join(rel.get('protocols', []))}",
                f"Source: historical job {job_id}",
            ],
            source_type="historical",
            source_id=job_id,
        ))

    # ── 5. Anti-forensic indicators ───────────────────────────────────────────
    for ind in indicators[:4]:
        ind_sev = ind.get("severity", "LOW")
        findings.append(_new_finding(
            title=f"Anti-forensic indicator: {ind.get('type', 'unknown')}",
            category=CAT_ANTI_FORENSIC,
            severity=ind_sev,
            confidence=ind.get("confidence", 50),
            summary=ind.get("description", "Anti-forensic indicator detected."),
            evidence=[
                f"Indicator ID: {ind.get('id', 'unknown')}",
                f"Source: {ind.get('source', '—')}",
                f"Destination: {ind.get('destination', '—')}",
                ind.get("evidence_basis", ""),
                ind.get("indicator_note", ""),
                f"Source: historical job {job_id}",
            ],
            source_type="historical",
            source_id=job_id,
        ))

    # ── 6. Hypothesis findings ────────────────────────────────────────────────
    for hyp in hypotheses[:5]:
        status = hyp.get("status", "INSUFFICIENT_EVIDENCE")
        conf   = hyp.get("confidence", 0)

        if status == "SUPPORTED":
            sev = SEVERITY_HIGH
        elif status == "PLAUSIBLE":
            sev = SEVERITY_MEDIUM
        elif status == "WEAK":
            sev = SEVERITY_LOW
        else:
            sev = SEVERITY_LOW

        findings.append(_new_finding(
            title=hyp.get("title", "Forensic hypothesis"),
            category=CAT_HYPOTHESIS,
            severity=sev,
            confidence=conf,
            summary=(
                f"{hyp.get('description', '')} "
                f"Status: {status}. Confidence: {conf}%."
            ),
            evidence=(
                hyp.get("supporting_evidence", [])[:3]
                + [f"Hypothesis ID: {hyp.get('id', 'unknown')}"]
                + [f"Source: historical job {job_id}"]
            ),
            source_type="historical",
            source_id=job_id,
        ))

    # ── 7. Coverage limitation finding (always present) ───────────────────────
    limitations = assessment.get("limitations", [])
    if limitations:
        findings.append(_new_finding(
            title="Evidence coverage limitation identified",
            category=CAT_EVIDENCE_INTEGRITY,
            severity=SEVERITY_LOW,
            confidence=95,
            summary=(
                "The forensic analysis is limited to flow-level metadata and packet "
                "header information from the available capture window. "
                "Application-layer content and encryption state are unavailable."
            ),
            evidence=limitations[:3] + [f"Source: historical job {job_id}"],
            source_type="historical",
            source_id=job_id,
        ))

    return findings


# ── Simulation findings ────────────────────────────────────────────────────────

def build_simulation_findings(sim_result: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Deterministically generate findings from a completed simulation result.

    IMPORTANT: All findings are labelled source_type="simulation".
    None of these are real attack findings.
    """
    findings: list[dict[str, Any]] = []
    sim_id       = sim_result.get("simulation_id", "unknown")
    scenario     = sim_result.get("scenario_label", sim_result.get("scenario", "unknown"))
    k            = sim_result.get("k", 0)
    events       = sim_result.get("generated_events",   []) or []
    forecasts    = sim_result.get("forecast_snapshots", []) or []
    stage_profs  = sim_result.get("stage_profiles",     []) or []
    stage_seq    = sim_result.get("stage_sequence",     []) or []

    SIM_PREFIX = "[SIMULATION ONLY] "

    # ── 1. Simulation configuration finding ───────────────────────────────────
    findings.append(_new_finding(
        title=f"{SIM_PREFIX}Fixed-K Attack Progression Simulation — K={k}",
        category=CAT_SIMULATION,
        severity=SEVERITY_LOW,
        confidence=100,
        summary=(
            f"Synthetic simulation completed. Scenario: '{scenario}'. "
            f"K={k} stages traversed. "
            f"All events are synthetic — no real network traffic was generated."
        ),
        evidence=[
            f"Simulation ID: {sim_id}",
            f"Scenario: {scenario}",
            f"K (stages): {k}",
            f"Stage sequence: {' → '.join(stage_seq)}",
            f"Total steps: {sim_result.get('total_steps', k)}",
        ],
        source_type="simulation",
        source_id=sim_id,
    ))

    # ── 2. Per-stage event findings ────────────────────────────────────────────
    for evt in events:
        stage   = evt.get("stage", "unknown")
        step    = evt.get("step", 0)
        pkts    = evt.get("packet_count", 0)
        bytes_  = evt.get("byte_count", 0)
        conns   = evt.get("connection_count", 0)
        src     = evt.get("source_label", evt.get("source", "?"))
        dst     = evt.get("destination_label", evt.get("destination", "?"))
        proto   = evt.get("protocol", "?")
        ts      = evt.get("timestamp", 0)

        # Severity by stage type
        s_lower = stage.lower()
        if "exfil" in s_lower or "impact" in s_lower:
            sev = SEVERITY_HIGH
            conf = 88
        elif "lateral" in s_lower or "command" in s_lower or "c2" in s_lower:
            sev = SEVERITY_HIGH
            conf = 82
        elif "persistence" in s_lower or "discovery" in s_lower or "internal" in s_lower:
            sev = SEVERITY_MEDIUM
            conf = 75
        elif "access" in s_lower:
            sev = SEVERITY_MEDIUM
            conf = 70
        else:
            sev = SEVERITY_LOW
            conf = 65

        findings.append(_new_finding(
            title=f"{SIM_PREFIX}Simulated stage observed: {stage} (step {step + 1}/{k})",
            category=CAT_ATTACK_PROGRESSION,
            severity=sev,
            confidence=conf,
            summary=(
                f"Simulated {stage} stage completed at step {step + 1}. "
                f"Synthetic flow: {src} → {dst} via {proto}. "
                f"{pkts:,} synthetic packets, {bytes_:,} synthetic bytes, "
                f"{conns} synthetic connections. "
                f"Simulated timestamp: T+{step * sim_result.get('total_steps', 15)}s (synthetic)."
            ),
            evidence=[
                f"Simulation ID: {sim_id}",
                f"Step: {step + 1} of {k}",
                f"Stage: {stage}",
                f"Synthetic source: {src} ({evt.get('source', '?')})",
                f"Synthetic destination: {dst} ({evt.get('destination', '?')})",
                f"Protocol: {proto}",
                f"Simulated timestamp (epoch): {ts:.0f} (NOT real wall-clock)",
                "SIMULATION ONLY — no real packets transmitted",
            ],
            source_type="simulation",
            source_id=sim_id,
        ))

    # ── 3. Forecast progression findings ──────────────────────────────────────
    for fc in forecasts:
        cur_stage  = fc.get("current_stage", "?")
        next_stage = fc.get("predicted_next_stage", "?")
        conf       = fc.get("confidence", 50)
        step       = fc.get("step", 0)
        feat       = fc.get("supporting_features", [])

        if next_stage and next_stage != cur_stage and next_stage != "—":
            findings.append(_new_finding(
                title=f"{SIM_PREFIX}Forecast: {cur_stage} → {next_stage} (step {step + 1})",
                category=CAT_FORECAST,
                severity=SEVERITY_LOW,
                confidence=conf,
                summary=(
                    f"Simulated forecast at step {step + 1}: "
                    f"current stage '{cur_stage}', "
                    f"predicted next '{next_stage}' "
                    f"(deterministic confidence: {conf}%). "
                    f"Supporting synthetic features: {', '.join(feat[:3]) if feat else 'none'}."
                ),
                evidence=[
                    f"Simulation ID: {sim_id}",
                    f"Step: {step + 1}",
                    f"Current stage: {cur_stage}",
                    f"Predicted next: {next_stage}",
                    f"Confidence: {conf}%",
                    f"Time window: {fc.get('time_window', '?')}",
                    "SIMULATION ONLY — deterministic forecast from fixed stage sequence",
                ],
                source_type="simulation",
                source_id=sim_id,
            ))

    # ── 4. Final simulation state finding ─────────────────────────────────────
    final_stage = stage_seq[-1] if stage_seq else "unknown"
    findings.append(_new_finding(
        title=f"{SIM_PREFIX}Simulation completed — final stage: {final_stage}",
        category=CAT_SIMULATION,
        severity=SEVERITY_MEDIUM,
        confidence=100,
        summary=(
            f"Synthetic attack progression simulation completed all {k} stages. "
            f"Final stage reached: '{final_stage}'. "
            f"This is a prototype simulation result. "
            f"No real network activity occurred."
        ),
        evidence=[
            f"Simulation ID: {sim_id}",
            f"Total stages: {k}",
            f"Final stage: {final_stage}",
            f"Events generated: {len(events)}",
            f"Forecast snapshots: {len(forecasts)}",
            "SIMULATION ONLY — NOT A REAL INCIDENT",
        ],
        source_type="simulation",
        source_id=sim_id,
    ))

    return findings
