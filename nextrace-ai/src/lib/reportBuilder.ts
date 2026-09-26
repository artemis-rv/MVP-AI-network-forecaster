// NEXTRACE AI — Structured report builder
// One builder for every "Generate Report" entry point (Attack Prediction, Historical, Forensic).
// Reports are assembled from the same state the pages render — grouped activities, risk entities,
// alerts, forecast, forensic reasoning — so a report never contains data the analyst has not seen.
// Output uses the existing `Report` shape, so ReportPage and the JSON / Markdown / PDF exporters work unchanged.

import type { Report, ReportSection, Finding, FindingSeverity } from '@/types/report';
import type { Alert } from '@/types/alert';
import type { ForecastResult } from '@/types/forecast';
import type { SessionStatus, TemporalState } from '@/types/live';
import type { HistoricalResult } from '@/types/historical';
import type {
  EvidenceIntegrity, Hypothesis, FinalAssessment, AntiForensicIndicator,
} from '@/types/forensic';
import type { TrafficSummary } from '@/store/liveStore';
import {
  type GroupedActivity, GROUPING, SEVERITY_RANK, significantActivities,
  formatActivityBytes, formatActivityDuration,
} from '@/lib/activityGrouping';
import { deriveRiskEntities } from '@/utils/entityRisk';

const nowSec = () => Math.floor(Date.now() / 1000);

function stamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
}

function range(a: GroupedActivity): string {
  return `${clock(a.firstSeen)}–${clock(a.lastSeen)} (${formatActivityDuration(a.lastSeen - a.firstSeen)})`;
}

function worst(activities: GroupedActivity[]): FindingSeverity | 'NONE' {
  let best: FindingSeverity | 'NONE' = 'NONE';
  for (const a of activities) if (best === 'NONE' || SEVERITY_RANK[a.severity] > SEVERITY_RANK[best]) best = a.severity;
  return best;
}

function activityLine(a: GroupedActivity): string {
  const targets = a.targets.length > 3 ? `${a.targets.slice(0, 3).join(', ')} +${a.targets.length - 3}` : a.targets.join(', ');
  return `[${a.severity}] ${a.id} ${a.label} — ${a.sources.join(', ')} → ${targets} · ${a.protocols.join('/')} · ` +
    `${a.eventCount} events · ${a.portCount ? `${a.portCount} port(s)` : "ports n/a"} · ${range(a)} · confidence ${a.confidence}%`;
}

function activityFinding(a: GroupedActivity, source: Finding['source_type'], sourceId: string): Finding {
  return {
    id: a.id,
    title: a.label,
    category: 'Suspicious Activity',
    severity: a.severity,
    confidence: a.confidence,
    summary: a.reason,
    evidence: [
      `Source: ${a.sources.join(', ')}`,
      `Target(s): ${a.targets.join(', ')}`,
      `Protocol(s): ${a.protocols.join(', ')} · ports: ${a.ports.slice(0, 12).join(', ')}${a.portCount > 12 ? ' …' : ''}`,
      `Events grouped: ${a.eventCount} · time range ${range(a)}`,
      ...(a.bytes !== null ? [`Bytes: ${formatActivityBytes(a.bytes)}`] : []),
      ...(Object.keys(a.tcpFlags).length ? [`TCP flags: ${Object.entries(a.tcpFlags).map(([f, c]) => `${f}×${c}`).join(', ')}`] : []),
      ...(a.mitre ? [`MITRE ATT&CK: ${a.mitre.id} ${a.mitre.name} (${a.mitre.tactic})`] : []),
    ],
    source_type: source,
    source_id: sourceId,
    created_at: Math.floor(a.firstSeen / 1000),
  };
}

function entitySection(order: number, activities: GroupedActivity[]): ReportSection {
  const { entities } = deriveRiskEntities(activities);
  return {
    order,
    title: 'Suspicious Entities',
    content: {
      summary: entities.length
        ? `${entities.length} entities are involved in suspicious activity. Risk is computed from observed behaviour only.`
        : 'No suspicious entities detected.',
      entities: entities.map(e =>
        `${e.ip} — ${e.status}, risk ${e.riskScore}/100 (${e.riskLevel}); ${e.reasons.join('; ')}`),
    },
    evidence_refs: entities.flatMap(e => e.activityIds).filter((v, i, arr) => arr.indexOf(v) === i),
  };
}

function timelineLines(activities: GroupedActivity[]): string[] {
  return activities
    .flatMap(a => a.milestones.map(m => ({ ts: m.ts, text: `${clock(m.ts)} [${m.severity}] ${m.text}` })))
    .sort((a, b) => a.ts - b.ts)
    .map(m => m.text);
}

function mitreSection(order: number, activities: GroupedActivity[]): ReportSection {
  const byTech = new Map<string, { tactic: string; name: string; ids: string[] }>();
  for (const a of activities) {
    if (!a.mitre) continue;
    const e = byTech.get(a.mitre.id) ?? { tactic: a.mitre.tactic, name: a.mitre.name, ids: [] };
    e.ids.push(a.id);
    byTech.set(a.mitre.id, e);
  }
  return {
    order,
    title: 'MITRE ATT&CK Mapping',
    content: {
      techniques: Array.from(byTech.entries()).map(([id, e]) => `${id} ${e.name} — tactic: ${e.tactic} — activities: ${e.ids.join(', ')}`),
      note: 'Techniques are mapped deterministically from each activity type and dominant service port.',
    },
    evidence_refs: Array.from(byTech.keys()),
  };
}

const KILL_CHAIN = ['Reconnaissance', 'Initial Access', 'Lateral Movement', 'Command & Control', 'Data Exfiltration', 'Impact', 'Observed Activity'];

/** Observed stages in kill-chain order (activities often start together, so time order would mislead). */
function stageProgression(activities: GroupedActivity[]): string {
  const seen = new Set(activities.map(a => a.stage));
  const stages = KILL_CHAIN.filter(s => seen.has(s));
  return stages.length ? stages.join(' → ') : 'No attack stages observed';
}

/** "What should be investigated next" — derived from the highest-risk entities and activity types. */
export function nextSteps(activities: GroupedActivity[]): string[] {
  const { entities } = deriveRiskEntities(activities);
  const steps: string[] = [];
  const top = entities[0];
  if (top) steps.push(`Prioritise ${top.ip} (${top.status}, risk ${top.riskScore}) — review ${top.topActivity}.`);
  const pivot = entities.find(e => e.status === 'Compromised pivot');
  if (pivot) steps.push(`${pivot.ip} is both targeted and originating activity — check it for compromise.`);
  const transfer = activities.find(a => a.category === 'data_transfer');
  if (transfer) steps.push(`Confirm what data left ${transfer.sources[0]} towards ${transfer.targets.join(', ')} (${transfer.id}).`);
  const auth = activities.find(a => a.category === 'auth_probe');
  if (auth) steps.push(`Check authentication logs on ${auth.targets.join(', ')} for successful logins after ${clock(auth.firstSeen)}.`);
  if (steps.length === 0) steps.push('No suspicious activity requires follow-up.');
  return steps;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE SESSION REPORT (Attack Prediction / Live Monitoring)
// ═══════════════════════════════════════════════════════════════════════════

export interface LiveReportInput {
  runId: string | null;
  runStartedAt: number | null;
  session: SessionStatus | null;
  windowSeconds: number;
  activities: GroupedActivity[];
  alerts: Alert[];
  forecast: ForecastResult | null;
  temporal: TemporalState | null;
  traffic: TrafficSummary;
}

export function buildLiveSessionReport(input: LiveReportInput): Report {
  const acts = significantActivities(input.activities);
  const sessionId = input.runId ?? input.session?.session_id ?? 'live-session';
  const reportId = `RPT-LIVE-${stamp()}`;
  const activityIds = new Set(acts.map(a => a.id));
  const alerts = input.alerts.filter(al => al.tags?.some(t => activityIds.has(t)));
  const f = input.forecast;
  const hasForecast = !!f && f.current_stage !== 'No Active Session';
  const sev = worst(acts);
  const t = input.traffic;
  const protoMix = Object.entries(t.protocols).sort((a, b) => b[1] - a[1])
    .map(([p, c]) => `${p} ${t.total ? Math.round((c / t.total) * 100) : 0}%`).join(', ');

  const sections: ReportSection[] = [
    {
      order: 1,
      title: 'Executive Summary',
      content: {
        summary: acts.length
          ? `${t.suspicious.toLocaleString()} suspicious packets were grouped into ${acts.length} activities, raising ${alerts.length} alert(s). ` +
            `Highest severity: ${sev}. Observed progression: ${stageProgression(acts)}.`
          : `No suspicious activity was grouped during this session (${t.total.toLocaleString()} packets observed).`,
        overall_severity: sev,
        what_to_investigate_next: nextSteps(acts),
      },
      evidence_refs: [],
    },
    {
      order: 2,
      title: 'Capture / Source Information',
      content: {
        session_id: sessionId,
        capture_source: 'Live Monitoring — demo traffic generator (synthetic packets, not real network telemetry)',
        started: input.runStartedAt ? new Date(input.runStartedAt).toLocaleString() : 'Unknown',
        observed_period: t.firstTs && t.lastTs ? `${clock(t.firstTs)} – ${clock(t.lastTs)}` : 'No packets observed',
        temporal_window: `${input.windowSeconds}s`,
        session_state: input.session?.running ? 'Running at report time' : 'Stopped',
      },
      evidence_refs: [],
    },
    {
      order: 3,
      title: 'Key Network Evidence',
      content: {
        packets_observed: t.total,
        suspicious_packets: t.suspicious,
        benign_packets: t.benign,
        bytes_observed: formatActivityBytes(t.bytes),
        protocol_mix: protoMix || 'n/a',
        latest_window: input.temporal
          ? `${input.temporal.packet_count} packets, ${input.temporal.unique_dst_ips} destination hosts, ` +
            `${input.temporal.unique_dst_ports} destination ports, suspicious ratio ${(input.temporal.suspicious_ratio * 100).toFixed(1)}%`
          : 'No completed temporal window',
      },
      evidence_refs: [],
    },
    entitySection(4, acts),
    {
      order: 5,
      title: 'Grouped Activities & Alerts',
      content: {
        grouping_rule: 'Packets are grouped when similarity (category 0.40, source 0.25, protocol 0.15, target 0.10, port 0.10) ≥ 0.75 within a 30s inactivity window.',
        activities: acts.map(activityLine),
        alerts_raised: alerts.map(al => `${al.id} [${al.severity}] ${al.title} — ${al.event_count} events, status ${al.status}`),
      },
      evidence_refs: acts.map(a => a.id),
    },
    {
      order: 6,
      title: 'Major Timeline Events',
      content: { events: timelineLines(acts) },
      evidence_refs: [],
    },
    {
      order: 7,
      title: 'Attack Forecast',
      content: hasForecast && f
        ? {
            current_stage: f.current_stage,
            predicted_next_stage: f.predicted_next_stage,
            confidence: `${Math.round(f.confidence * 100)}%`,
            likely_target: f.target,
            time_window: f.time_window,
            supporting_features: f.supporting_features,
            basis: `Rule-based forecast from the latest observed temporal window of session ${sessionId}.`,
          }
        : { status: 'No forecast available — the session produced no completed temporal window.' },
      evidence_refs: [],
    },
    mitreSection(8, acts),
    {
      order: 9,
      title: 'Evidence Limitations',
      content: {
        limitations: [
          'Traffic originates from the demo packet generator; it is synthetic and not captured from a real network.',
          'Detection uses deterministic header-level heuristics (protocol, port, TCP flags), not signatures or a trained model.',
          'Payload content is limited to the one-line header summary recorded per packet.',
          'The forecast is a rule-based projection from temporal features, not a trained predictive model.',
          `Only the last ${GROUPING.maxSamples} packets of each activity are retained as samples; counts cover all grouped packets.`,
        ],
      },
      evidence_refs: [],
    },
  ];

  const findings: Finding[] = acts.map(a => activityFinding(a, 'live', sessionId));
  if (hasForecast && f && !f.is_benign) {
    findings.push({
      id: `${sessionId}-forecast`,
      title: `Predicted next stage: ${f.predicted_next_stage}`,
      category: 'Forecast',
      severity: f.confidence >= 0.75 ? 'HIGH' : 'MEDIUM',
      confidence: Math.round(f.confidence * 100),
      summary: `Current stage ${f.current_stage}; likely next ${f.predicted_next_stage} targeting ${f.target} within ${f.time_window}.`,
      evidence: f.supporting_features,
      source_type: 'live',
      source_id: sessionId,
      created_at: nowSec(),
    });
  }

  return {
    report_id: reportId,
    report_type: 'live',
    source_id: sessionId,
    title: `Live Session Incident Report — ${sessionId}`,
    generated_at: nowSec(),
    status: 'GENERATED',
    sections,
    findings,
    disclaimer: 'Prototype report generated from a simulated live session. Findings are heuristic and require analyst validation.',
    metadata: {
      session_id: sessionId,
      capture_source: 'Live demo traffic generator',
      is_demo: true,
      generated_at: nowSec(),
      analysis_status: input.session?.running ? 'session running' : 'session stopped',
      local: true,
    },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HISTORICAL / FORENSIC REPORT
// ═══════════════════════════════════════════════════════════════════════════

export interface ForensicReportPart {
  forensicId: string | null;
  integrity: EvidenceIntegrity | null;
  hypotheses: Hypothesis[];
  finalAssessment: FinalAssessment | null;
  indicators: AntiForensicIndicator[];
}

/** Adapts forensic store state; returns null unless forensic analysis completed for this job. */
export function forensicPartFrom(fz: {
  selectedHistoricalJobId: string | null;
  status: string;
  forensicId: string | null;
  integrity: EvidenceIntegrity | null;
  hypotheses: Hypothesis[];
  finalAssessment: FinalAssessment | null;
  antiForensicIndicators: AntiForensicIndicator[];
}, jobId: string): ForensicReportPart | null {
  if (fz.selectedHistoricalJobId !== jobId || String(fz.status).toLowerCase() !== 'completed') return null;
  return {
    forensicId: fz.forensicId,
    integrity: fz.integrity,
    hypotheses: fz.hypotheses,
    finalAssessment: fz.finalAssessment,
    indicators: fz.antiForensicIndicators,
  };
}

export interface HistoricalReportInput {
  jobId: string;
  filename: string;
  isDemo: boolean;
  result: HistoricalResult;
  activities: GroupedActivity[];
  forensic?: ForensicReportPart | null;
}

export function historicalLimitations(input: { isDemo: boolean; result: HistoricalResult }): string[] {
  return [
    ...(input.isDemo ? ['The capture is the built-in demo dataset; packets are synthetic.'] : []),
    'Suspicious activity is detected with threshold heuristics over header metadata, not signatures or a trained model.',
    'Payload content is not retained in the analysis result; only header-level metadata is available.',
    'Detector indicators carry no per-indicator byte counts; volumes are host-pair totals from observed flows.',
    `Temporal features are aggregated in ${input.result.window_seconds}s windows; shorter bursts are averaged out.`,
    'Offline captures cannot be forecast forward; only the observed stage progression is reported.',
  ];
}

export function buildHistoricalReport(input: HistoricalReportInput): Report {
  const acts = significantActivities(input.activities);
  const r = input.result;
  const fz = input.forensic;
  const sev = worst(acts);
  const protoMix = r.protocol_distribution
    .map(p => `${p.protocol} ${r.packet_count ? Math.round((p.count / r.packet_count) * 100) : 0}%`).join(', ');
  const suspiciousPairs = r.entity_relationships.filter(e => e.is_suspicious);

  const sections: ReportSection[] = [
    {
      order: 1,
      title: 'Executive Summary',
      content: {
        summary: acts.length
          ? `${r.suspicious_events.length} detector indicators were grouped into ${acts.length} activities. ` +
            `Highest severity: ${sev}. Observed progression: ${stageProgression(acts)}.`
          : `No suspicious activity was detected in ${r.packet_count.toLocaleString()} packets.`,
        overall_severity: sev,
        forensic_assessment: fz?.finalAssessment?.assessment_text ?? 'Forensic reasoning not run for this capture.',
        what_to_investigate_next: nextSteps(acts),
      },
      evidence_refs: [],
    },
    {
      order: 2,
      title: 'Capture / Source Information',
      content: {
        analysis_id: input.jobId,
        forensic_id: fz?.forensicId ?? 'n/a',
        capture_file: input.filename || 'unknown',
        capture_period: `${new Date(r.start_timestamp * 1000).toLocaleString()} – ${new Date(r.end_timestamp * 1000).toLocaleTimeString()}`,
        duration: formatActivityDuration(r.duration_seconds * 1000),
        packets: r.packet_count,
        flows: r.flow_count,
        evidence_hash_sha256: fz?.integrity?.sha256 ?? 'Not computed (run Forensic Analysis)',
        integrity_status: fz?.integrity?.status ?? 'Not assessed',
      },
      evidence_refs: [],
    },
    {
      order: 3,
      title: 'Key Network Evidence',
      content: {
        protocol_mix: protoMix || 'n/a',
        top_sources: r.top_src_ips.slice(0, 5).map(x => `${x.ip} (${x.count} packets)`),
        top_destination_ports: r.top_dst_ports.slice(0, 5).map(x => `${x.port} (${x.count})`),
        suspicious_host_pairs: suspiciousPairs.slice(0, 10).map(e =>
          `${e.src_ip} → ${e.dst_ip}: ${e.packet_count} packets, ${formatActivityBytes(e.byte_count)}, ports ${e.ports.slice(0, 6).join(', ')}`),
      },
      evidence_refs: [],
    },
    entitySection(4, acts),
    {
      order: 5,
      title: 'Grouped Activities',
      content: {
        grouping_rule: 'Detector indicators are merged when similarity (category 0.40, source 0.25, protocol 0.15, target 0.10, port 0.10) ≥ 0.75 within 5 minutes.',
        activities: acts.map(activityLine),
      },
      evidence_refs: acts.map(a => a.id),
    },
    {
      order: 6,
      title: 'Major Timeline Events',
      content: {
        events: timelineLines(acts),
        normal_traffic: `${r.packet_count.toLocaleString()} packets across ${r.temporal_windows.length} windows; normal traffic is summarised, not listed.`,
      },
      evidence_refs: [],
    },
    {
      order: 7,
      title: 'Attack Progression',
      content: {
        observed_progression: stageProgression(acts),
        forecast: 'Not applicable to an offline capture — see Attack Prediction for live forecasting.',
      },
      evidence_refs: [],
    },
    mitreSection(8, acts),
  ];

  if (fz && fz.hypotheses.length) {
    sections.push({
      order: 9,
      title: 'Forensic Hypotheses',
      content: {
        hypotheses: fz.hypotheses.map(h => `${h.title} — ${h.status.replace('_', ' ')}, ${h.confidence}% (${h.supporting_evidence.length} supporting / ${h.contradicting_evidence.length} contradicting)`),
      },
      evidence_refs: fz.hypotheses.map(h => h.id),
    });
  }

  sections.push({
    order: sections.length + 1,
    title: 'Evidence Limitations',
    content: {
      limitations: [
        ...historicalLimitations(input),
        ...(fz?.finalAssessment?.limitations ?? []),
      ].filter((v, i, arr) => arr.indexOf(v) === i),
      evidence_limitation_indicators: (fz?.indicators ?? []).map(i => `[${i.severity}] ${i.type}: ${i.description}`),
    },
    evidence_refs: (fz?.indicators ?? []).map(i => i.id),
  });

  const findings: Finding[] = acts.map(a => activityFinding(a, 'historical', input.jobId));
  for (const h of fz?.hypotheses ?? []) {
    if (h.status !== 'SUPPORTED' && h.status !== 'PLAUSIBLE') continue;
    findings.push({
      id: h.id,
      title: h.title,
      category: 'Hypothesis',
      severity: h.confidence >= 70 ? 'HIGH' : 'MEDIUM',
      confidence: h.confidence,
      summary: h.description,
      evidence: h.supporting_evidence,
      source_type: 'historical',
      source_id: input.jobId,
      created_at: nowSec(),
    });
  }

  return {
    report_id: `RPT-HIST-${stamp()}`,
    report_type: 'historical',
    source_id: input.jobId,
    title: `Forensic Analysis Report — ${input.filename || input.jobId}`,
    generated_at: nowSec(),
    status: 'GENERATED',
    sections,
    findings,
    disclaimer: 'Prototype forensic report. Heuristic findings require expert validation and are not legally admissible evidence.',
    metadata: {
      job_id: input.jobId,
      filename: input.filename,
      is_demo: input.isDemo,
      forensic_id: fz?.forensicId ?? undefined,
      generated_at: nowSec(),
      analysis_status: fz?.finalAssessment ? 'historical + forensic completed' : 'historical completed',
      local: true,
    },
  };
}
