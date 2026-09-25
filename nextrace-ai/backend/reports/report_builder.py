"""
NEXTRACE AI — Report Builder (Step 8)

Builds complete Report objects from completed historical/forensic or simulation data.
Stores generated reports in lightweight in-memory storage.

ISOLATION:
  - Historical builder reads _HIST_JOBS + _FORENSIC_JOBS only.
  - Simulation builder reads engine._SIMULATIONS only (via engine.get_result).
  - NEVER reads: live session, forecast state, investigation state.
  - NEVER mutates source data.

DISCLAIMER: All reports are prototype output. No report section contains
fabricated evidence. Language is deliberately cautious throughout.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

from backend.reports.findings import build_historical_findings, build_simulation_findings

# ── In-memory report store ─────────────────────────────────────────────────────
# Keyed by report_id. Never shared with any other module's state.
_REPORTS: dict[str, dict[str, Any]] = {}


def list_reports() -> list[dict[str, Any]]:
    """Return all stored report summaries."""
    summaries = []
    for r in _REPORTS.values():
        summaries.append({
            "report_id":    r["report_id"],
            "report_type":  r["report_type"],
            "source_id":    r["source_id"],
            "title":        r["title"],
            "generated_at": r["generated_at"],
            "status":       r["status"],
            "finding_count":len(r.get("findings", [])),
        })
    # Most recent first
    return sorted(summaries, key=lambda x: x["generated_at"], reverse=True)


def get_report(report_id: str) -> dict[str, Any] | None:
    return _REPORTS.get(report_id)


# ── Historical Report Builder ──────────────────────────────────────────────────

def build_historical_report(job_id: str) -> dict[str, Any]:
    """
    Build a historical forensic report from a completed historical + forensic job.

    Raises ValueError if either job is not completed.
    """
    # Import here to avoid circular imports at module load time
    from backend.api.historical import _JOBS as _HIST_JOBS
    from backend.api.forensic import _FORENSIC_JOBS

    hist_job = _HIST_JOBS.get(job_id)
    if not hist_job:
        raise ValueError(f"Historical job '{job_id}' not found.")
    hist_status = str(hist_job.get("status", "")).strip().lower()
    if hist_status != "completed":
        raise ValueError(
            f"Historical job '{job_id}' is not completed "
            f"(status: {hist_job.get('status')}). "
            f"Cannot generate report from incomplete analysis."
        )

    forensic_job = _FORENSIC_JOBS.get(job_id)
    if not forensic_job:
        raise ValueError(
            f"No forensic analysis found for historical job '{job_id}'. "
            f"Complete forensic analysis first."
        )
    
    forensic_status = str(forensic_job.get("status", "")).strip().lower()
    if forensic_status != "completed":
        raise ValueError(
            f"Forensic analysis for job '{job_id}' is not completed "
            f"(status: {forensic_job.get('status')}). "
            f"Cannot generate report from incomplete analysis."
        )

    hist_result = hist_job.get("result", {}) or {}
    forensic_result = forensic_job.get("result", {}) or {}
    filename = hist_job.get("filename", "unknown.pcap")
    is_demo = hist_job.get("is_demo", False)

    integrity = forensic_result.get("integrity", {}) or {}
    ev_summary = forensic_result.get("evidence_summary", {}) or {}
    indicators = forensic_result.get("anti_forensic_indicators", []) or []
    hypotheses = forensic_result.get("hypotheses", []) or []
    assessment = forensic_result.get("final_assessment", {}) or {}

    sus_events = hist_result.get("suspicious_events", []) or []
    windows = hist_result.get("temporal_windows", []) or []
    entities = hist_result.get("entity_relationships", []) or []
    protocols = hist_result.get("protocol_distribution", []) or []
    src_ips = hist_result.get("top_src_ips", []) or []
    dst_ips = hist_result.get("top_dst_ips", []) or []
    dst_ports = hist_result.get("top_dst_ports", []) or []

    duration = hist_result.get("duration_seconds", 0)
    pkt_count = (
        hist_result.get("packet_count")
        if hist_result.get("packet_count") is not None
        else (hist_result.get("total_packets") if hist_result.get("total_packets") is not None else integrity.get("packet_count", 0))
    )
    flow_count = (
        hist_result.get("flow_count")
        if hist_result.get("flow_count") is not None
        else (hist_result.get("total_flows") if hist_result.get("total_flows") is not None else integrity.get("flow_count", 0))
    )

    findings = build_historical_findings(hist_job, forensic_result)
























    # Count high-severity findings
    high_count   = sum(1 for f in findings if f["severity"] in ("HIGH", "CRITICAL"))
    medium_count = sum(1 for f in findings if f["severity"] == "MEDIUM")

    # Activity pattern from assessment
    activity_pat = assessment.get("activity_pattern", "Undetermined")
    overall_conf = assessment.get("overall_confidence", 0)

    sections = [
        # 1 — Executive Summary
        {
            "order":   1,
            "title":   "Executive Summary",
            "content": {
                "job_id":            job_id,
                "filename":          filename,
                "is_demo":           is_demo,
                "total_packets":     pkt_count,
                "packet_count":      pkt_count,
                "total_flows":       flow_count,
                "flow_count":        flow_count,
                "duration_seconds":  duration,
                "suspicious_events": len(sus_events),
                "activity_pattern":  activity_pat,
                "overall_confidence":overall_conf,
                "assessment_text":   assessment.get("assessment_text", ""),
                "finding_count":     len(findings),
                "high_findings":     high_count,
                "medium_findings":   medium_count,
            },
            "evidence_refs": [
                f"Source: historical job {job_id}",
                f"File: {filename}",
            ],
        },

        # 2 — Evidence Integrity
        {
            "order":   2,
            "title":   "Evidence Integrity",
            "content": {
                "status":             integrity.get("status", "UNAVAILABLE"),
                "sha256":             integrity.get("sha256"),
                "filename":           integrity.get("filename", filename),
                "file_size":          integrity.get("file_size", 0),
                "packet_count":       integrity.get("packet_count", pkt_count),
                "total_packets":      pkt_count,
                "flow_count":         integrity.get("flow_count", flow_count),
                "total_flows":        flow_count,
                "upload_timestamp":   integrity.get("upload_timestamp"),
                "processing_start":   integrity.get("processing_start"),
                "processing_completed": integrity.get("processing_completed"),
                "analysis_status":    integrity.get("analysis_status", "completed"),
                "disclaimer":         integrity.get("disclaimer", ""),
            },
            "evidence_refs": [
                f"SHA-256: {(integrity.get('sha256') or 'N/A')[:32]}{'…' if integrity.get('sha256') and len(integrity['sha256']) > 32 else ''}",
                f"Integrity status: {integrity.get('status', 'UNAVAILABLE')}",
                f"Source: historical job {job_id}",
            ],
        },

        # 3 — Network Activity
        {
            "order":   3,
            "title":   "Network Activity",
            "content": {
                "total_packets":        pkt_count,
                "packet_count":         pkt_count,
                "total_flows":          flow_count,
                "flow_count":           flow_count,
                "duration_seconds":     duration,
                "temporal_windows":     len(windows),
                "protocol_distribution": protocols[:10],
                "top_src_ips":          src_ips[:5],
                "top_dst_ips":          dst_ips[:5],
                "top_dst_ports":        dst_ports[:10],
                "network_evidence":     ev_summary.get("network_evidence", []),
                "entity_evidence":      ev_summary.get("entity_evidence", []),
            },
            "evidence_refs": [
                f"Packets: {pkt_count:,}",
                f"Flows: {flow_count:,}",
                f"Duration: {duration:.1f}s",
                f"Source: historical job {job_id}",
            ],
        },

        # 4 — Suspicious Indicators
        {
            "order":   4,
            "title":   "Suspicious Indicators",
            "content": {
                "indicator_count":  len(sus_events),
                "indicators":       sus_events[:20],
                "entity_relationships": [r for r in entities if r.get("is_suspicious")][:10],
                "temporal_evidence": ev_summary.get("temporal_evidence", []),
            },
            "evidence_refs": [
                f"Total suspicious events: {len(sus_events)}",
                f"Source: historical job {job_id}",
            ],
        },

        # 5 — Activity Timeline
        {
            "order":   5,
            "title":   "Activity Timeline",
            "content": {
                "temporal_windows": windows[:30],
                "suspicious_events_timeline": sorted(
                    [{"ts": e.get("timestamp"), "type": e.get("indicator_type", e.get("type", "?")),
                      "src": e.get("src_ip", "?"), "dst": e.get("dst_ip", "?")}
                     for e in sus_events],
                    key=lambda x: x.get("ts") or 0
                )[:20],
                "capture_start": hist_result.get("start_timestamp"),
                "capture_end":   hist_result.get("end_timestamp"),
                "duration_seconds": duration,
            },
            "evidence_refs": [
                f"Windows: {len(windows)}",
                f"Suspicious events: {len(sus_events)}",
                f"Source: historical job {job_id}",
            ],
        },

        # 6 — Anti-Forensic Indicators
        {
            "order":   6,
            "title":   "Anti-Forensic Indicators",
            "content": {
                "indicator_count": len(indicators),
                "indicators":      indicators,
                "anti_forensic_notes": assessment.get("anti_forensic_notes", []),
            },
            "evidence_refs": [
                f"Anti-forensic indicators: {len(indicators)}",
                f"Source: historical job {job_id}",
            ],
        },

        # 7 — Forensic Hypotheses
        {
            "order":   7,
            "title":   "Forensic Hypotheses",
            "content": {
                "hypothesis_count": len(hypotheses),
                "hypotheses":       hypotheses,
                "supported_count":  sum(1 for h in hypotheses if h.get("status") == "SUPPORTED"),
                "plausible_count":  sum(1 for h in hypotheses if h.get("status") == "PLAUSIBLE"),
            },
            "evidence_refs": [
                f"Hypotheses evaluated: {len(hypotheses)}",
                f"Source: historical job {job_id}",
            ],
        },

        # 8 — Final Assessment
        {
            "order":   8,
            "title":   "Final Assessment",
            "content": {
                "assessment_text":    assessment.get("assessment_text", ""),
                "overall_confidence": overall_conf,
                "activity_pattern":   activity_pat,
                "key_evidence":       assessment.get("key_evidence", []),
                "anti_forensic_notes":assessment.get("anti_forensic_notes", []),
                "prototype_label":    assessment.get("prototype_label", "Prototype Forensic Reasoning"),
                "cautionary_note":    assessment.get("cautionary_note", ""),
            },
            "evidence_refs": [
                f"Overall confidence: {overall_conf}%",
                f"Activity pattern: {activity_pat}",
                f"Source: historical job {job_id}",
            ],
        },

        # 9 — Limitations
        {
            "order":   9,
            "title":   "Limitations",
            "content": {
                "limitations":          assessment.get("limitations", []),
                "prototype_disclaimer": forensic_result.get("prototype_disclaimer", ""),
                "is_demo":              is_demo,
                "coverage_note":        (
                    "Analysis covers only the provided PCAP capture window. "
                    "Activity outside this window is unobserved."
                ),
            },
            "evidence_refs": [
                f"Source: historical job {job_id}",
            ],
        },
    ]

    report_id = f"RPT-HIST-{str(uuid.uuid4())[:8].upper()}"
    report = {
        "report_id":    report_id,
        "report_type":  "historical",
        "source_id":    job_id,
        "title":        f"Historical Forensic Report — {filename}",
        "generated_at": time.time(),
        "status":       "GENERATED",
        "sections":     sections,
        "findings":     findings,
        "disclaimer": (
            "PROTOTYPE FORENSIC ANALYSIS. "
            "Findings are derived from available captured evidence and deterministic "
            "prototype reasoning. They are NOT legal conclusions or attribution. "
            "Expert human review is required before acting on any finding."
        ),
        "metadata": {
            "job_id":         job_id,
            "filename":       filename,
            "is_demo":        is_demo,
            "forensic_id":    forensic_job.get("forensic_id"),
            "generated_at":   time.time(),
            "analysis_status":"completed",
        },
    }

    _REPORTS[report_id] = report
    return report


# ── Simulation Report Builder ──────────────────────────────────────────────────

def build_simulation_report(simulation_id: str) -> dict[str, Any]:
    """
    Build a simulation report from a completed simulation.

    Raises ValueError if simulation is not completed.
    """
    from backend.simulator import engine

    try:
        state = engine.get_state(simulation_id)
    except KeyError:
        raise ValueError(f"Simulation '{simulation_id}' not found.")

    if state.status not in ("completed", "stopped"):
        raise ValueError(
            f"Simulation '{simulation_id}' is not completed "
            f"(status: {state.status}). "
            f"Cannot generate report from a running or idle simulation."
        )

    sim_result = engine.get_result(simulation_id)
    findings   = build_simulation_findings(sim_result)

    scenario      = sim_result.get("scenario_label", sim_result.get("scenario", "unknown"))
    k             = sim_result.get("k", 0)
    events        = sim_result.get("generated_events",   []) or []
    forecasts     = sim_result.get("forecast_snapshots", []) or []
    stage_profs   = sim_result.get("stage_profiles",     []) or []
    stage_seq     = sim_result.get("stage_sequence",     []) or []
    disclaimer    = sim_result.get("disclaimer", "SIMULATION DATA — NOT REAL NETWORK TRAFFIC.")

    sections = [
        # 1 — Simulation Summary
        {
            "order":   1,
            "title":   "Simulation Summary",
            "content": {
                "simulation_id":   simulation_id,
                "scenario":        scenario,
                "k":               k,
                "status":          sim_result.get("status"),
                "total_steps":     sim_result.get("total_steps", k),
                "completed_steps": sim_result.get("current_step", k - 1) + 1,
                "stage_sequence":  stage_seq,
                "disclaimer":      disclaimer,
            },
            "evidence_refs": [
                f"Simulation ID: {simulation_id}",
                f"Scenario: {scenario}",
                f"K={k}",
                "SIMULATION ONLY — NO REAL NETWORK TRAFFIC",
            ],
        },

        # 2 — Scenario Configuration
        {
            "order":   2,
            "title":   "Scenario Configuration",
            "content": {
                "scenario_id":      sim_result.get("scenario"),
                "scenario_label":   scenario,
                "k":                k,
                "stage_sequence":   stage_seq,
                "total_stages":     len(stage_seq),
                "window_seconds":   state.window_seconds,
                "speed":            state.speed,
            },
            "evidence_refs": [
                f"Scenario: {scenario}",
                f"Window: {state.window_seconds}s",
                f"Speed: {state.speed}x",
                "SIMULATION ONLY",
            ],
        },

        # 3 — Stage Progression
        {
            "order":   3,
            "title":   "Stage Progression",
            "content": {
                "stages_traversed": len(events),
                "stage_sequence":   stage_seq,
                "events": [
                    {
                        "step":        e.get("step"),
                        "stage":       e.get("stage"),
                        "source":      e.get("source_label", e.get("source")),
                        "destination": e.get("destination_label", e.get("destination")),
                        "protocol":    e.get("protocol"),
                        "packet_count":e.get("packet_count"),
                        "byte_count":  e.get("byte_count"),
                        "timestamp":   e.get("timestamp"),
                    }
                    for e in events
                ],
            },
            "evidence_refs": [
                f"Stages: {len(events)} of {k}",
                f"Source: simulation {simulation_id}",
                "SIMULATION ONLY",
            ],
        },

        # 4 — Synthetic Activity
        {
            "order":   4,
            "title":   "Synthetic Activity",
            "content": {
                "total_synthetic_packets": sum(e.get("packet_count", 0) for e in events),
                "total_synthetic_bytes":   sum(e.get("byte_count", 0)   for e in events),
                "total_synthetic_connections": sum(e.get("connection_count", 0) for e in events),
                "events":                  events[:20],
                "note":                    "ALL VALUES ARE SYNTHETIC. No real packets were generated.",
            },
            "evidence_refs": [
                "SYNTHETIC DATA ONLY",
                f"Source: simulation {simulation_id}",
            ],
        },

        # 5 — Forecast Progression
        {
            "order":   5,
            "title":   "Forecast Progression",
            "content": {
                "forecast_count":   len(forecasts),
                "forecasts":        forecasts,
                "avg_confidence":   (
                    round(sum(f.get("confidence", 0) for f in forecasts) / len(forecasts))
                    if forecasts else 0
                ),
                "note":             "Forecasts are deterministic from the fixed stage sequence. Not predictive AI.",
            },
            "evidence_refs": [
                f"Forecast snapshots: {len(forecasts)}",
                f"Source: simulation {simulation_id}",
                "SIMULATION ONLY",
            ],
        },

        # 6 — Feature Windows
        {
            "order":   6,
            "title":   "Feature Windows",
            "content": {
                "stage_profiles": stage_profs,
                "note": (
                    "Synthetic feature profiles mirror the temporal window feature schema "
                    "for visual consistency. Values are deterministic per stage."
                ),
            },
            "evidence_refs": [
                f"Stage profiles: {len(stage_profs)}",
                f"Source: simulation {simulation_id}",
            ],
        },

        # 7 — Final Simulation State
        {
            "order":   7,
            "title":   "Final Simulation State",
            "content": {
                "final_stage":    stage_seq[-1] if stage_seq else "unknown",
                "status":         sim_result.get("status"),
                "current_step":   sim_result.get("current_step"),
                "total_steps":    sim_result.get("total_steps", k),
                "final_event":    events[-1] if events else None,
                "final_forecast": forecasts[-1] if forecasts else None,
            },
            "evidence_refs": [
                f"Final stage: {stage_seq[-1] if stage_seq else 'unknown'}",
                f"Source: simulation {simulation_id}",
                "SIMULATION ONLY",
            ],
        },

        # 8 — Disclaimer
        {
            "order":   8,
            "title":   "Simulation Disclaimer",
            "content": {
                "disclaimer":          disclaimer,
                "synthetic_note":      "All entities, IPs, packets, and observations are entirely synthetic.",
                "no_real_traffic":     True,
                "prototype_label":     "NEXTRACE AI Prototype Simulation",
                "legal_note": (
                    "This report must NOT be presented as evidence of a real security incident. "
                    "No real network infrastructure was involved."
                ),
            },
            "evidence_refs": [
                f"Source: simulation {simulation_id}",
                "SIMULATION ONLY — NOT A REAL INCIDENT",
            ],
        },
    ]

    report_id = f"RPT-SIM-{str(uuid.uuid4())[:8].upper()}"
    report = {
        "report_id":   report_id,
        "report_type": "simulation",
        "source_id":   simulation_id,
        "title":       f"Simulation Report — {scenario} (K={k})",
        "generated_at": time.time(),
        "status":      "GENERATED",
        "sections":    sections,
        "findings":    findings,
        "disclaimer":  (
            "SIMULATION ONLY — NO REAL NETWORK TRAFFIC WAS GENERATED. "
            "All entities, events, and observations are synthetically generated in-memory. "
            "This report MUST NOT be presented as evidence of a real security incident."
        ),
        "metadata": {
            "simulation_id": simulation_id,
            "scenario":      scenario,
            "k":             k,
            "status":        sim_result.get("status"),
            "generated_at":  time.time(),
        },
    }

    _REPORTS[report_id] = report
    return report
