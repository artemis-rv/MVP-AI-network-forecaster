"""
NEXTRACE AI — Forensic Analysis Orchestrator

Builds the complete ForensicAnalysis object from a completed historical job.
Consumes the historical result — does NOT re-parse the PCAP.

IMPORTANT:
- All conclusions are framed as observations, indicators, or hypotheses.
- Language is deliberately cautious: "consistent with", "suggests", "possible".
- No machine learning. No real LLM. Pure deterministic heuristics.
- All final assessments include explicit confidence and limitation statements.
"""
from __future__ import annotations

import time
import uuid
from typing import Any

from backend.forensic.integrity import build_integrity
from backend.forensic.anti_forensic import detect_anti_forensic_indicators
from backend.forensic.hypotheses import generate_hypotheses


# ── Evidence Summary Builder ──────────────────────────────────────────────────

def _build_evidence_summary(result: dict[str, Any]) -> dict[str, Any]:
    """
    Derives a structured evidence summary from the historical result.
    Every item references actual evidence fields — nothing is fabricated.
    """
    events    = result.get("suspicious_events", [])
    windows   = result.get("temporal_windows", [])
    entities  = result.get("entity_relationships", [])
    protocols = result.get("protocol_distribution", [])
    src_ips   = result.get("top_src_ips", [])
    dst_ips   = result.get("top_dst_ips", [])
    ports     = result.get("top_dst_ports", [])
    t_start   = result.get("start_timestamp")
    t_end     = result.get("end_timestamp")
    duration  = result.get("duration_seconds", 0)

    # ── Network Evidence ──────────────────────────────────────────────────────
    network_evidence: list[str] = []

    # Protocol activity
    for p in protocols[:3]:
        network_evidence.append(
            f"Protocol activity observed: {p['protocol']} ({p['count']} packets)."
        )

    # Top source/destination relationships
    sus_pairs = [
        (r.get("src_ip"), r.get("dst_ip"))
        for r in entities if r.get("is_suspicious")
    ]
    if sus_pairs:
        for src, dst in sus_pairs[:3]:
            network_evidence.append(
                f"Suspicious communication pair observed: {src} → {dst}."
            )

    # Top ports
    auth_ports = {22, 3389, 23, 21, 1433, 3306, 5432}
    auth_observed = [p for p in ports if p.get("port") in auth_ports]
    if auth_observed:
        network_evidence.append(
            f"Authentication service port activity observed: "
            f"{', '.join(str(p['port']) for p in auth_observed)}."
        )

    # Unusual connection patterns
    high_port_entities = [r for r in entities if len(r.get("ports", [])) >= 10]
    if high_port_entities:
        network_evidence.append(
            f"{len(high_port_entities)} host relationship(s) show contact with "
            f"10 or more unique destination ports, which may indicate systematic probing."
        )

    # ── Temporal Evidence ─────────────────────────────────────────────────────
    temporal_evidence: list[str] = []

    if windows:
        sus_windows = [
            w for w in windows if w.get("suspicious_ratio", 0) > 0.1
        ]
        peak_win = max(windows, key=lambda w: w.get("suspicious_ratio", 0))
        first_win_ts = min(w.get("window_start", float("inf")) for w in windows
                           if any(e["timestamp"] >= w.get("window_start", 0)
                                  and e["timestamp"] < w.get("window_end", 0)
                                  for e in events)) if events else None

        if events:
            first_event_ts = min(e["timestamp"] for e in events)
            temporal_evidence.append(
                f"First suspicious indicator observed at "
                f"T+{first_event_ts - t_start:.1f}s into capture."
            )

        temporal_evidence.append(
            f"Peak suspicious activity window: window #{peak_win['window_index']} "
            f"(suspicious ratio: {peak_win.get('suspicious_ratio', 0):.0%})."
        )

        if len(sus_windows) > 1:
            temporal_evidence.append(
                f"{len(sus_windows)} of {len(windows)} temporal windows contain "
                f"elevated suspicious activity ratios."
            )

        temporal_evidence.append(
            f"Capture covers {duration:.1f}s across {len(windows)} temporal windows."
        )

    # Check for activity gaps
    if events and len(events) >= 2:
        sorted_ts = sorted(e["timestamp"] for e in events)
        gaps = [(sorted_ts[i+1] - sorted_ts[i]) for i in range(len(sorted_ts)-1)]
        max_gap = max(gaps)
        if max_gap >= 20.0:
            temporal_evidence.append(
                f"A gap of {max_gap:.1f}s was observed between consecutive "
                f"suspicious indicators. Activity within this interval is unobserved."
            )

    # ── Entity Evidence ───────────────────────────────────────────────────────
    entity_evidence: list[str] = []

    if src_ips:
        top_src = src_ips[0]
        entity_evidence.append(
            f"Highest-activity source: {top_src['ip']} "
            f"({top_src['count']} packets observed)."
        )
    if dst_ips:
        top_dst = dst_ips[0]
        entity_evidence.append(
            f"Highest-activity destination: {top_dst['ip']} "
            f"({top_dst['count']} packets observed)."
        )

    sus_pairs_detail = [r for r in entities if r.get("is_suspicious")]
    for rel in sus_pairs_detail[:3]:
        entity_evidence.append(
            f"Suspicious pair: {rel.get('src_ip')} → {rel.get('dst_ip')}: "
            f"{rel.get('packet_count')} packets, {rel.get('byte_count', 0):,} bytes, "
            f"protocols: {', '.join(rel.get('protocols', []))}."
        )

    return {
        "network_evidence": network_evidence,
        "temporal_evidence": temporal_evidence,
        "entity_evidence": entity_evidence,
    }


# ── Final Assessment Generator ─────────────────────────────────────────────────

def _build_final_assessment(
    hist_result: dict[str, Any],
    hypotheses: list[dict[str, Any]],
    indicators: list[dict[str, Any]],
    is_demo: bool,
) -> dict[str, Any]:
    """
    Generates a deterministic final forensic assessment.
    Uses cautious language throughout — never claims certainty.
    """
    events     = hist_result.get("suspicious_events", [])
    n_events   = len(events)
    n_hyp      = len(hypotheses)
    n_ind      = len(indicators)
    has_sus    = n_events > 0
    top_hyps   = [h for h in hypotheses if h["status"] in ("SUPPORTED", "PLAUSIBLE")]

    # Derive overall confidence from hypotheses
    if hypotheses:
        avg_conf = sum(h["confidence"] for h in hypotheses) / len(hypotheses)
    else:
        avg_conf = 0

    overall_conf = min(80, int(avg_conf))  # cap at 80 — prototype never claims high certainty

    # Activity pattern text
    if top_hyps:
        activity_desc = " and ".join(
            h["title"].replace("H1 — Possible ", "").replace("H2 — Possible ", "")
             .replace("H3 — Possible ", "").replace("H4 — Possible ", "")
             .replace("H5 — Possible ", "")
            for h in top_hyps[:2]
        )
        assessment_text = (
            f"Observed activity is consistent with {activity_desc}. "
            f"{n_events} heuristic indicator(s) were detected across the capture, "
            f"with {len(top_hyps)} hypothesis/hypotheses reaching Supported or Plausible status. "
            f"Findings suggest this activity warrants further investigation."
        )
    elif has_sus:
        assessment_text = (
            f"{n_events} suspicious indicator(s) were observed. "
            f"Available evidence is insufficient to establish a clear activity pattern. "
            f"Individual indicators may be consistent with benign or malicious activity."
        )
    else:
        assessment_text = (
            "No suspicious indicators were detected in the available capture. "
            "Observed traffic appears consistent with normal network activity "
            "within the analyzed window."
        )

    # Key evidence items
    key_evidence: list[str] = []
    for h in top_hyps[:3]:
        if h.get("supporting_evidence"):
            key_evidence.append(h["supporting_evidence"][0])
    if not key_evidence and events:
        key_evidence = [e.get("reason", "").split("(Demo")[0].strip() for e in events[:3]]

    # Limitations
    limitations: list[str] = [
        "This is a prototype forensic reasoning model. All conclusions require expert human review.",
        "Heuristic detections are based on flow-level features and packet metadata only.",
        "Application-layer content and encryption state are not available for analysis.",
    ]
    if is_demo:
        limitations.insert(0,
            "SIMULATED EVIDENCE: All data in this analysis is synthetically generated. "
            "This does not represent a real incident or real network traffic."
        )
    for ind in indicators[:2]:
        limitations.append(f"Evidence limitation: {ind['type']} — {ind['description'][:100]}…")

    # Anti-forensic notes
    af_notes: list[str] = []
    for ind in indicators:
        af_notes.append(
            f"{ind['type']} (severity: {ind['severity']}, confidence: {ind['confidence']}%): "
            f"{ind['description'][:120]}…"
        )
    if not af_notes:
        af_notes = ["No evidence-limitation or anti-forensic indicators detected."]

    return {
        "assessment_text":     assessment_text,
        "overall_confidence":  overall_conf,
        "activity_pattern":    activity_desc if top_hyps else "Undetermined",
        "key_evidence":        key_evidence,
        "limitations":         limitations,
        "anti_forensic_notes": af_notes,
        "prototype_label":     "Prototype Forensic Reasoning",
        "cautionary_note": (
            "Language in this assessment is deliberately cautious: 'consistent with', "
            "'suggests', 'possible', 'may indicate'. "
            "No finding in this report is legally definitive. "
            "No attacker identity is confirmed. "
            "This report is NOT court-admissible evidence."
        ),
    }


# ── Public Orchestrator ────────────────────────────────────────────────────────

def run_forensic_analysis(
    job: dict[str, Any],
    hist_result: dict[str, Any],
) -> dict[str, Any]:
    """
    Full forensic analysis pipeline over a completed historical job.

    Args:
        job:         The _JOBS entry (from historical API).
        hist_result: The HistoricalResult dict (job["result"]).

    Returns:
        Complete ForensicAnalysis dict.
    """
    is_demo: bool = job.get("is_demo", False)

    # 1 — Evidence integrity
    integrity = build_integrity(job, hist_result)

    # 2 — Evidence summary
    evidence_summary = _build_evidence_summary(hist_result)

    # 3 — Anti-forensic indicators
    af_indicators = detect_anti_forensic_indicators(hist_result, is_demo=is_demo)

    # 4 — Hypotheses
    hypotheses = generate_hypotheses(hist_result)

    # 5 — Final assessment
    final_assessment = _build_final_assessment(
        hist_result, hypotheses, af_indicators, is_demo=is_demo
    )

    return {
        "id":                        f"FA-{str(uuid.uuid4())[:8].upper()}",
        "historical_job_id":         job.get("job_id"),
        "status":                    "completed",
        "is_demo":                   is_demo,
        "created_at":                time.time(),
        "integrity":                 integrity,
        "evidence_summary":          evidence_summary,
        "anti_forensic_indicators":  af_indicators,
        "hypotheses":                hypotheses,
        "final_assessment":          final_assessment,
        "prototype_disclaimer": (
            "NEXTRACE AI Prototype Forensic Reasoning. "
            "All findings are deterministic heuristic indicators only. "
            "This is NOT a legally admissible forensic report. "
            "Expert human review is required before acting on any finding."
        ),
    }
