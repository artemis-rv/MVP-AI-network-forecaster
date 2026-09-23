"""
NEXTRACE AI — Anti-Forensic / Evidence Limitation Indicator Module

Implements DETERMINISTIC heuristics to identify patterns that may limit
evidence completeness or suggest anti-forensic behaviour.

CRITICAL DISCLAIMER:
These are INDICATORS ONLY, not proof of attacker intent.
Each finding is labeled as an indicator/hypothesis, not a confirmed finding.
All confidence values are deterministic heuristic estimates, not statistical probabilities.
"""
from __future__ import annotations

import uuid
from typing import Any


# ── Severity / confidence helpers ─────────────────────────────────────────────

def _make_indicator(
    itype: str,
    severity: str,
    confidence: int,
    timestamp: float | None,
    source: str,
    destination: str,
    description: str,
    evidence_basis: str,
) -> dict[str, Any]:
    return {
        "id":             str(uuid.uuid4()),
        "type":           itype,
        "severity":       severity,       # LOW | MEDIUM | HIGH
        "confidence":     confidence,     # deterministic pct (0-100)
        "timestamp":      timestamp,
        "source":         source,
        "destination":    destination,
        "description":    description,
        "evidence_basis": evidence_basis,
        "indicator_note": (
            "This is an indicator only. It does not confirm attacker intent. "
            "Further investigation is required before drawing conclusions."
        ),
    }


# ── Gap threshold (seconds) ───────────────────────────────────────────────────
_TRAFFIC_GAP_SECONDS = 30.0   # inter-event gap that triggers a gap indicator
_SPARSE_EVENT_COUNT  = 2      # suspicious events with no surrounding baseline


def detect_anti_forensic_indicators(
    hist_result: dict[str, Any],
    is_demo: bool = False,
) -> list[dict[str, Any]]:
    """
    Run all anti-forensic/evidence-limitation heuristics over a completed
    historical result.  Returns a list of indicator dicts (may be empty).

    Args:
        hist_result: The full HistoricalResult dict.
        is_demo:     Whether this is synthetic demo data.

    Returns:
        Sorted list of indicators (by timestamp, then severity).
    """
    indicators: list[dict[str, Any]] = []

    windows:  list[dict] = hist_result.get("temporal_windows", [])
    events:   list[dict] = hist_result.get("suspicious_events", [])
    entities: list[dict] = hist_result.get("entity_relationships", [])
    timeline: list[dict] = hist_result.get("activity_timeline", [])

    t_start: float | None = hist_result.get("start_timestamp")
    t_end:   float | None = hist_result.get("end_timestamp")

    # ── 1. Traffic Gaps ────────────────────────────────────────────────────────
    # Look for large gaps between consecutive suspicious events or windows.
    event_ts = sorted(e["timestamp"] for e in events)
    for i in range(1, len(event_ts)):
        gap = event_ts[i] - event_ts[i - 1]
        if gap >= _TRAFFIC_GAP_SECONDS:
            indicators.append(_make_indicator(
                itype="Potential Traffic Gap",
                severity="MEDIUM",
                confidence=55,
                timestamp=event_ts[i - 1],
                source="—",
                destination="—",
                description=(
                    f"A gap of {gap:.1f}s was observed between consecutive "
                    f"suspicious indicator timestamps. Activity that occurred during "
                    f"this interval may be unobserved or absent from the capture."
                ),
                evidence_basis=(
                    f"Consecutive suspicious event timestamps differ by {gap:.1f}s, "
                    f"exceeding the {_TRAFFIC_GAP_SECONDS}s gap threshold."
                ),
            ))

    # ── 2. Capture Boundary Limitation ────────────────────────────────────────
    # If the first/last suspicious event is within 5s of the capture boundary,
    # activity may extend beyond the observed window.
    if events and t_start is not None and t_end is not None:
        first_sus = min(e["timestamp"] for e in events)
        last_sus  = max(e["timestamp"] for e in events)

        if (first_sus - t_start) < 5.0:
            indicators.append(_make_indicator(
                itype="Capture Boundary Limitation",
                severity="MEDIUM",
                confidence=60,
                timestamp=t_start,
                source="—",
                destination="—",
                description=(
                    "The earliest suspicious indicator appears near the beginning "
                    "of the capture window. Activity predating this capture may not "
                    "be represented in the available evidence."
                ),
                evidence_basis=(
                    f"First suspicious event at T+{first_sus - t_start:.1f}s "
                    f"(capture starts at T=0)."
                ),
            ))

        if (t_end - last_sus) < 5.0:
            indicators.append(_make_indicator(
                itype="Capture Boundary Limitation",
                severity="MEDIUM",
                confidence=60,
                timestamp=last_sus,
                source="—",
                destination="—",
                description=(
                    "The most recent suspicious indicator appears near the end "
                    "of the capture window. Activity that continued after capture "
                    "termination may not be represented in the available evidence."
                ),
                evidence_basis=(
                    f"Last suspicious event at T+{t_end - last_sus:.1f}s before "
                    f"capture end."
                ),
            ))

    # ── 3. Potential Incomplete Session ───────────────────────────────────────
    # Flows where last_seen is very close to the capture end — session may not
    # have concluded within the capture window.
    if t_end is not None:
        for rel in entities:
            ls = rel.get("last_seen")
            if ls is not None and (t_end - ls) < 3.0 and rel.get("is_suspicious"):
                indicators.append(_make_indicator(
                    itype="Potential Incomplete Session",
                    severity="LOW",
                    confidence=45,
                    timestamp=ls,
                    source=rel.get("src_ip", "—"),
                    destination=rel.get("dst_ip", "—"),
                    description=(
                        f"Flow between {rel.get('src_ip')} → {rel.get('dst_ip')} "
                        f"terminates at or near the capture boundary. "
                        f"TCP session closure may not be captured."
                    ),
                    evidence_basis=(
                        f"Flow last_seen={ls:.1f}, capture end={t_end:.1f}; "
                        f"delta={t_end - ls:.2f}s."
                    ),
                ))

    # ── 4. Unusual Packet Pattern ─────────────────────────────────────────────
    # Very high mean packet size in a window alongside low flow count may
    # indicate fragmentation or unusual transfer patterns.
    for win in windows:
        mean_pkt = win.get("mean_packet_size", 0)
        flow_ct  = win.get("flow_count", 0)
        byte_ct  = win.get("byte_count", 0)
        if mean_pkt > 1400 and flow_ct <= 3 and byte_ct > 100_000:
            indicators.append(_make_indicator(
                itype="Unusual Packet Pattern",
                severity="LOW",
                confidence=40,
                timestamp=win.get("window_start"),
                source="—",
                destination="—",
                description=(
                    f"Window {win.get('window_index')}: mean packet size of "
                    f"{mean_pkt:.0f} bytes with only {flow_ct} flows and "
                    f"{byte_ct:,} bytes observed. May indicate large frame sizes, "
                    f"fragmentation, or unusual transfer patterns."
                ),
                evidence_basis=(
                    f"mean_packet_size={mean_pkt:.0f}, flow_count={flow_ct}, "
                    f"byte_count={byte_ct:,} in window {win.get('window_index')}."
                ),
            ))

    # ── 5. Sparse Evidence Region ─────────────────────────────────────────────
    # A suspicious event with no normal baseline traffic in the same window.
    win_map: dict[int, dict] = {w["window_index"]: w for w in windows}
    normal_ts = {e["timestamp"] for e in timeline if e.get("entry_type") == "normal"}

    for ev in events:
        ev_ts = ev["timestamp"]
        # Find which window this event falls in
        for win in windows:
            if win["window_start"] <= ev_ts < win["window_end"]:
                # Check if there's any normal traffic timestamp nearby (within window)
                has_normal = any(
                    win["window_start"] <= nt < win["window_end"] for nt in normal_ts
                )
                baseline_pkts = win.get("packet_count", 0) - (
                    win.get("tcp_count", 0) * win.get("suspicious_ratio", 0)
                )
                if not has_normal and win.get("packet_count", 0) < 20:
                    indicators.append(_make_indicator(
                        itype="Sparse Evidence Region",
                        severity="LOW",
                        confidence=38,
                        timestamp=ev_ts,
                        source=ev.get("src_ip", "—"),
                        destination=ev.get("dst_ip", "—"),
                        description=(
                            f"Suspicious indicator detected in a window "
                            f"(#{win.get('window_index')}) with very low overall "
                            f"packet volume ({win.get('packet_count')} packets). "
                            f"Surrounding baseline context is limited."
                        ),
                        evidence_basis=(
                            f"Window {win.get('window_index')}: packet_count="
                            f"{win.get('packet_count')}, no normal baseline "
                            f"activity entries in same window."
                        ),
                    ))
                break

    # De-duplicate by (type, source, destination) to avoid repetition
    seen: set[tuple] = set()
    unique: list[dict] = []
    for ind in indicators:
        key = (ind["type"], ind["source"], ind["destination"])
        if key not in seen:
            seen.add(key)
            unique.append(ind)

    # Sort: by timestamp (None last), then severity order
    _sev_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    unique.sort(key=lambda i: (
        i["timestamp"] if i["timestamp"] is not None else float("inf"),
        _sev_order.get(i["severity"], 99),
    ))

    return unique
