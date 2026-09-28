// NEXTRACE AI — Activity Grouping Engine
// Deterministic similarity-based grouping: Packets → normalized indicators → grouped activities.
// One engine feeds both Live Monitoring (packet stream) and Historical analysis (detector indicators),
// so alerts, timeline, risk entities, forecast context and reports all read the same activity objects.
//
// Pipeline per input:
//   1. normalize   — packet / indicator → ActivityInput
//   2. classify    — header metadata (protocol, port, TCP flags) → ActivityCategory
//   3. similarity  — weighted score against every open activity group
//   4. merge       — score ≥ threshold and within the inactivity gap → update group; else start a new one
//   5. derive      — label, severity, confidence, reason, MITRE mapping recomputed from group statistics
//   6. triggers    — an alert is raised only when a group becomes significant, escalates severity,
//                    or materially changes shape (e.g. vertical scan → network sweep)

import type { PacketEvent } from '@/types/live';
import type { SuspiciousEvent } from '@/types/historical';
import type { AlertSeverity } from '@/types/alert';

// ── Tunables (kept small and explicit for demo explainability) ─────────────────
export const GROUPING = {
  /** A group is considered ended after this much silence; later packets start a new group. */
  liveGapMs: 30_000,
  /** Historical indicators are already detector-aggregated, so a wider gap is used. */
  historicalGapMs: 5 * 60_000,
  /** Minimum similarity score required to merge an input into an existing group. */
  threshold: 0.75,
  weights: { category: 0.40, source: 0.25, protocol: 0.15, target: 0.10, port: 0.10 },
  maxActivities: 100,
  maxSamples: 25,
  maxPorts: 200,
} as const;

export type ActivityCategory =
  | 'icmp_recon'
  | 'port_scan'
  | 'auth_probe'
  | 'lateral_movement'
  | 'suspicious_dns'
  | 'data_transfer'
  | 'c2_channel'
  | 'traffic_flood'
  | 'anomalous_flow';

export interface MitreRef { id: string; name: string; tactic: string }

export interface ActivityInput {
  ts: number;              // epoch ms
  src: string;
  dst: string;
  srcPort?: number;
  dstPort: number;
  protocol: string;
  bytes?: number;          // undefined when the source data has no size field
  info?: string;           // header / payload metadata exactly as captured
  hintType?: string;       // historical detector type
  hintSeverity?: AlertSeverity;
  hintReason?: string;
}

export interface ActivitySample {
  ts: number;
  src: string;
  dst: string;
  srcPort?: number;
  dstPort: number;
  protocol: string;
  bytes?: number;
  info?: string;
}

export interface ActivityMilestone {
  ts: number;
  kind: 'detected' | 'escalated' | 'changed';
  text: string;
  severity: AlertSeverity;
}

export interface GroupedActivity {
  id: string;
  category: ActivityCategory;
  label: string;
  /** Material shape within the category (e.g. vertical scan vs network sweep). Only a shape
   *  change — not label wording such as an extra service port — counts as a "materially different" activity. */
  shape: string;
  stage: string;                 // kill-chain stage used across the app
  sources: string[];
  targets: string[];
  protocols: string[];
  ports: number[];               // distinct destination ports (capped)
  portCount: number;             // true distinct count, even past the cap
  firstSeen: number;
  lastSeen: number;
  eventCount: number;
  bytes: number | null;          // null when no input carried a size
  severity: AlertSeverity;
  confidence: number;            // 0–100
  reason: string;
  mitre: MitreRef | null;
  tcpFlags: Record<string, number>;
  payloadPatterns: Record<string, number>;
  detectorReasons: string[];
  detectorConfirmed: boolean;
  hintSeverityMax?: AlertSeverity;  // highest severity reported by a historical detector
  samples: ActivitySample[];
  milestones: ActivityMilestone[];
  /** True once the group passed its minimum-evidence threshold (eligible for alerts / risk). */
  significant: boolean;
  /** `${shape}|${severity}` of the last alert raised for this group. */
  alertKey: string | null;
  alertIds: string[];
}

export interface AlertTrigger {
  kind: 'new' | 'escalated' | 'changed';
  activity: GroupedActivity;
}

export const SEVERITY_RANK: Record<AlertSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

// ── Port knowledge ─────────────────────────────────────────────────────────────
const AUTH_PORTS: Record<number, string> = { 21: 'FTP', 22: 'SSH', 23: 'Telnet' };
const REMOTE_SVC_PORTS: Record<number, string> = { 135: 'RPC', 139: 'NetBIOS', 445: 'SMB', 3389: 'RDP', 5985: 'WinRM', 5986: 'WinRM' };
const WEB_PORTS = new Set([80, 443, 8080, 8443]);

const LATERAL_MITRE: Record<string, MitreRef> = {
  SMB:     { id: 'T1021.002', name: 'Remote Services: SMB/Windows Admin Shares', tactic: 'Lateral Movement' },
  NetBIOS: { id: 'T1021.002', name: 'Remote Services: SMB/Windows Admin Shares', tactic: 'Lateral Movement' },
  RDP:     { id: 'T1021.001', name: 'Remote Services: Remote Desktop Protocol', tactic: 'Lateral Movement' },
  WinRM:   { id: 'T1021.006', name: 'Remote Services: Windows Remote Management', tactic: 'Lateral Movement' },
  RPC:     { id: 'T1021.003', name: 'Remote Services: Distributed Component Object Model', tactic: 'Lateral Movement' },
};

const CATEGORY_STAGE: Record<ActivityCategory, string> = {
  icmp_recon:       'Reconnaissance',
  port_scan:        'Reconnaissance',
  auth_probe:       'Initial Access',
  lateral_movement: 'Lateral Movement',
  suspicious_dns:   'Command & Control',
  data_transfer:    'Data Exfiltration',
  c2_channel:       'Command & Control',
  traffic_flood:    'Impact',
  anomalous_flow:   'Observed Activity',
};

/** Minimum evidence before a group is significant (alert-eligible). Detector-confirmed inputs are always significant. */
const MIN_EVENTS: Record<ActivityCategory, number> = {
  icmp_recon: 5, port_scan: 15, auth_probe: 8, lateral_movement: 5, suspicious_dns: 5,
  data_transfer: 8, c2_channel: 3, traffic_flood: 10, anomalous_flow: 10,
};

const BASE_CONFIDENCE: Record<ActivityCategory, number> = {
  icmp_recon: 60, port_scan: 70, auth_probe: 72, lateral_movement: 70, suspicious_dns: 62,
  data_transfer: 65, c2_channel: 60, traffic_flood: 55, anomalous_flow: 45,
};

// ── Normalization ──────────────────────────────────────────────────────────────
export function fromPacket(e: PacketEvent): ActivityInput {
  const ts = Date.parse(e.timestamp);
  return {
    ts: Number.isNaN(ts) ? Date.now() : ts,
    src: e.src_ip,
    dst: e.dst_ip,
    srcPort: e.src_port,
    dstPort: e.dst_port,
    protocol: e.protocol,
    bytes: e.packet_size,
    info: e.payload_info || undefined,
  };
}

export function fromSuspiciousEvent(e: SuspiciousEvent): ActivityInput {
  return {
    ts: e.timestamp * 1000,
    src: e.src_ip,
    dst: e.dst_ip,
    dstPort: e.port,
    protocol: e.protocol,
    hintType: e.type,
    hintSeverity: e.severity.toUpperCase() as AlertSeverity,
    hintReason: e.reason,
    bytes: e.bytes,
    info: e.payload_info,
  };
}

/** Parses TCP flags from captured header text such as "40000 > 22 [SYN] Seq=0". */
export function parseTcpFlags(info?: string): string | null {
  const m = info?.match(/\[([A-Z]{3}(?:,\s*[A-Z]{3})*)\]/);
  return m ? m[1].replace(/\s+/g, '') : null;
}

function isPrivateIp(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.)/.test(ip);
}

// ── Classification ─────────────────────────────────────────────────────────────
export function classify(x: ActivityInput): ActivityCategory {
  if (x.hintType) {
    const t = x.hintType.toLowerCase();
    if (t.includes('scan') || t.includes('stealth')) return 'port_scan';
    if (t.includes('brute') || t.includes('auth')) return 'auth_probe';
    if (t.includes('icmp')) return 'icmp_recon';
    if (t.includes('c2') || t.includes('backdoor')) return 'c2_channel';
    if (t.includes('transfer') || t.includes('exfil')) return 'data_transfer';
    if (t.includes('rate') || t.includes('flood') || t.includes('dos')) return 'traffic_flood';
    if (t.includes('lateral') || t.includes('smb')) return 'lateral_movement';
    if (t.includes('dns')) return 'suspicious_dns';
    return 'anomalous_flow';
  }
  const proto = x.protocol.toUpperCase();
  if (proto === 'ICMP') return 'icmp_recon';
  if (proto === 'DNS' || x.dstPort === 53) return 'suspicious_dns';
  const flags = parseTcpFlags(x.info);
  if (flags === 'SYN') return 'port_scan';
  if (AUTH_PORTS[x.dstPort]) return 'auth_probe';
  if (REMOTE_SVC_PORTS[x.dstPort]) return 'lateral_movement';
  if (WEB_PORTS.has(x.dstPort)) return 'data_transfer';
  return 'anomalous_flow';
}

// ── Similarity ─────────────────────────────────────────────────────────────────
function sameSubnet24(a: string, b: string): boolean {
  const pa = a.split('.'), pb = b.split('.');
  return pa.length === 4 && pb.length === 4 && pa[0] === pb[0] && pa[1] === pb[1] && pa[2] === pb[2];
}

/**
 * score = 0.40·category + 0.25·source + 0.15·protocol + 0.10·target + 0.10·port
 *  - target: 1 if destination already targeted by the group, 0.5 if in the same /24
 *  - port:   1 if the port was already seen, or the category is a scan (port variation is the behaviour)
 * Category is weighted so that different activity types can never reach the 0.75 threshold.
 */
export function similarity(g: GroupedActivity, x: ActivityInput, category: ActivityCategory): number {
  const w = GROUPING.weights;
  const cat = g.category === category ? 1 : 0;
  const src = g.sources.includes(x.src) ? 1 : 0;
  const proto = g.protocols.includes(x.protocol) ? 1 : 0;
  const tgt = g.targets.includes(x.dst) ? 1 : g.targets.some(t => sameSubnet24(t, x.dst)) ? 0.5 : 0;
  const port = category === 'port_scan' || g.ports.includes(x.dstPort) ? 1 : 0;
  return w.category * cat + w.source * src + w.protocol * proto + w.target * tgt + w.port * port;
}

// ── Derivation helpers ─────────────────────────────────────────────────────────
function dominant(counts: Record<string, number>): string | null {
  let best: string | null = null;
  let max = -1;
  for (const [k, v] of Object.entries(counts)) if (v > max) { best = k; max = v; }
  return best;
}

function servicesOf(g: GroupedActivity, table: Record<number, string>): string[] {
  return Array.from(new Set(g.ports.map(p => table[p]).filter(Boolean)));
}

function maxSeverity(a: AlertSeverity, b?: AlertSeverity): AlertSeverity {
  if (!b) return a;
  return SEVERITY_RANK[b] > SEVERITY_RANK[a] ? b : a;
}

function fmtDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
}

function fmtBytes(b: number): string {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${b} B`;
}

function hostList(ips: string[]): string {
  return ips.length <= 2 ? ips.join(', ') : `${ips[0]} +${ips.length - 1} more`;
}

/** Recomputes every derived field from the group's accumulated statistics. */
function derive(g: GroupedActivity): void {
  const n = g.eventCount;
  const src = hostList(g.sources);
  const dst = hostList(g.targets);
  const dur = fmtDuration(g.lastSeen - g.firstSeen);
  const hint = g.detectorConfirmed ? (g.detectorReasons[0] ?? '') : '';
  let label: string;
  let shape: string = g.category;
  let severity: AlertSeverity;
  let mitre: MitreRef | null;
  let reason: string;

  switch (g.category) {
    case 'icmp_recon': {
      const sweep = g.targets.length >= 3;
      label = sweep ? 'ICMP Ping Sweep' : 'ICMP Reconnaissance';
      shape = sweep ? 'sweep' : 'single-host';
      severity = sweep ? 'MEDIUM' : 'LOW';
      mitre = { id: 'T1018', name: 'Remote System Discovery', tactic: 'Discovery' };
      reason = `${n} ICMP probes from ${src} to ${g.targets.length} host(s) within ${dur}.`;
      break;
    }
    case 'port_scan': {
      const sweep = g.targets.length >= 3 || g.targets.includes('multiple_targets');
      label = sweep ? 'Network Sweep' : 'Vertical Port Scan';
      shape = sweep ? 'sweep' : 'vertical';
      severity = sweep || g.portCount >= 50 ? 'HIGH' : 'MEDIUM';
      mitre = { id: 'T1046', name: 'Network Service Discovery', tactic: 'Discovery' };
      const syn = g.tcpFlags['SYN'] ?? 0;
      reason = sweep
        ? `${src} probed ${g.targets.length} hosts across ${g.portCount} ports within ${dur}.`
        : `${g.portCount} distinct ports probed on ${dst} by ${src} within ${dur}${syn ? `; ${syn} SYN-only packets` : ''}.`;
      break;
    }
    case 'auth_probe': {
      const svc = servicesOf(g, AUTH_PORTS).join('/') || 'authentication service';
      label = g.sources.length > 1 ? `Distributed ${svc} Brute-Force` : `${svc} Brute-Force Attempts`;
      shape = g.sources.length > 1 ? 'distributed' : 'single-source';
      severity = n >= 250 ? 'CRITICAL' : 'HIGH';
      mitre = { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access' };
      reason = `${n} repeated connection attempts to ${svc} on ${dst} from ${src} within ${dur}.`;
      break;
    }
    case 'lateral_movement': {
      const svcs = servicesOf(g, REMOTE_SVC_PORTS);
      label = svcs.length === 1 ? `Lateral Movement via ${svcs[0]}` : `Lateral Movement (${svcs.join('/') || 'remote services'})`;
      shape = g.targets.length >= 2 ? 'multi-target' : 'single-target';
      severity = g.targets.length >= 2 || n >= 150 ? 'CRITICAL' : 'HIGH';
      const portCounts: Record<string, number> = {};
      for (const s of g.samples) {
        const svc = REMOTE_SVC_PORTS[s.dstPort];
        if (svc) portCounts[svc] = (portCounts[svc] ?? 0) + 1;
      }
      mitre = LATERAL_MITRE[dominant(portCounts) ?? svcs[0] ?? 'SMB'] ?? LATERAL_MITRE.SMB;
      reason = `${src} opened ${n} remote-service connections (${svcs.join(', ') || 'admin ports'}) to internal host ${dst} within ${dur}.`;
      break;
    }
    case 'suspicious_dns': {
      const domains = Object.keys(g.payloadPatterns).filter(k => k.startsWith('dns:')).map(k => k.slice(4));
      label = 'Suspicious DNS Queries';
      severity = n >= 60 ? 'HIGH' : 'MEDIUM';
      mitre = { id: 'T1071.004', name: 'Application Layer Protocol: DNS', tactic: 'Command and Control' };
      reason = `${n} DNS queries from ${src}${domains.length ? ` for ${domains.slice(0, 3).join(', ')}` : ''} within ${dur}.`;
      break;
    }
    case 'data_transfer': {
      const external = g.targets.some(t => t !== 'multiple_targets' && !isPrivateIp(t));
      label = external ? 'Outbound Data Transfer' : 'Internal Data Staging';
      shape = external ? 'external' : 'internal';
      severity = g.bytes !== null && g.bytes >= 1_048_576 ? 'CRITICAL' : 'HIGH';
      mitre = external
        ? { id: 'T1041', name: 'Exfiltration Over C2 Channel', tactic: 'Exfiltration' }
        : { id: 'T1074', name: 'Data Staged', tactic: 'Collection' };
      reason = `${n} transfer packets from ${src} to ${dst}${g.bytes !== null ? ` totalling ${fmtBytes(g.bytes)}` : ''} within ${dur}.`;
      break;
    }
    case 'c2_channel':
      label = 'Possible C2 / Backdoor Channel';
      severity = 'HIGH';
      mitre = { id: 'T1571', name: 'Non-Standard Port', tactic: 'Command and Control' };
      reason = `${src} communicated with ${dst} on port(s) ${g.ports.slice(0, 5).join(', ')}.`;
      break;
    case 'traffic_flood':
      label = 'High-Rate Traffic Burst';
      severity = 'MEDIUM';
      mitre = { id: 'T1498', name: 'Network Denial of Service', tactic: 'Impact' };
      reason = `High packet rate from ${src} towards ${dst}.`;
      break;
    default:
      label = 'Anomalous Flow Pattern';
      severity = n >= 50 ? 'MEDIUM' : 'LOW';
      mitre = null;
      reason = `${n} packets flagged by the traffic classifier between ${src} and ${dst} within ${dur}.`;
  }

  if (g.detectorConfirmed && hint) {
    reason = `${hint.split('(Demo')[0].trim()}${n > 1 ? ` (${n} related indicators grouped.)` : ''}`;
  }

  g.label = label;
  g.shape = shape;
  g.severity = g.detectorConfirmed ? maxSeverity(severity, g.hintSeverityMax) : severity;
  g.mitre = mitre;
  g.reason = reason;
  g.confidence = Math.min(97, BASE_CONFIDENCE[g.category] + Math.min(25, Math.round(Math.log2(n + 1) * 3)) + (g.detectorConfirmed ? 5 : 0));
  g.significant = g.detectorConfirmed || n >= MIN_EVENTS[g.category] || (g.category === 'port_scan' && g.portCount >= 8);
}

function newActivity(id: string, x: ActivityInput, category: ActivityCategory): GroupedActivity {
  return {
    id, category, label: '', shape: category, stage: CATEGORY_STAGE[category],
    sources: [], targets: [], protocols: [], ports: [], portCount: 0,
    firstSeen: x.ts, lastSeen: x.ts, eventCount: 0, bytes: null,
    severity: 'LOW', confidence: 0, reason: '', mitre: null,
    tcpFlags: {}, payloadPatterns: {}, detectorReasons: [], detectorConfirmed: false,
    samples: [], milestones: [], significant: false, alertKey: null, alertIds: [],
  };
}

function cloneActivity(g: GroupedActivity): GroupedActivity {
  return {
    ...g,
    sources: [...g.sources], targets: [...g.targets], protocols: [...g.protocols], ports: [...g.ports],
    tcpFlags: { ...g.tcpFlags }, payloadPatterns: { ...g.payloadPatterns },
    detectorReasons: [...g.detectorReasons], samples: [...g.samples],
    milestones: [...g.milestones], alertIds: [...g.alertIds],
  };
}

/** Extracts a stable, count-able artifact from captured header text (DNS name, HTTP request, SMB file, …). */
function payloadPattern(info: string): string {
  const dns = info.match(/query\s+0x[0-9a-f]+\s+(\w+)\s+([\w.-]+)/i);
  if (dns) return `dns:${dns[2]} (${dns[1]})`;
  const http = info.match(/^(GET|POST|PUT|HEAD|DELETE)\s+(\S+)/);
  if (http) return `${http[1]} ${http[2]}`;
  const file = info.match(/file:\s*(\S+)/i);
  if (file) return `SMB file ${file[1]}`;
  return info.replace(/\b(0x[0-9a-f]+|\d+)\b/gi, '#').slice(0, 80);
}

function absorb(g: GroupedActivity, x: ActivityInput): void {
  if (!g.sources.includes(x.src)) g.sources.push(x.src);
  if (x.dst && !g.targets.includes(x.dst)) g.targets.push(x.dst);
  if (!g.protocols.includes(x.protocol)) g.protocols.push(x.protocol);
  if (x.dstPort > 0 && !g.ports.includes(x.dstPort)) {
    g.portCount += 1;
    if (g.ports.length < GROUPING.maxPorts) g.ports.push(x.dstPort);
  }
  g.firstSeen = Math.min(g.firstSeen, x.ts);
  g.lastSeen = Math.max(g.lastSeen, x.ts);
  g.eventCount += 1;
  if (x.bytes !== undefined) g.bytes = (g.bytes ?? 0) + x.bytes;
  const flags = parseTcpFlags(x.info);
  if (flags) g.tcpFlags[flags] = (g.tcpFlags[flags] ?? 0) + 1;
  if (x.info) {
    const key = payloadPattern(x.info);
    if (g.payloadPatterns[key] !== undefined || Object.keys(g.payloadPatterns).length < 8) {
      g.payloadPatterns[key] = (g.payloadPatterns[key] ?? 0) + 1;
    }
  }
  if (x.hintType) {
    g.detectorConfirmed = true;
    g.hintSeverityMax = maxSeverity(g.hintSeverityMax ?? 'LOW', x.hintSeverity);
    if (x.hintReason && !g.detectorReasons.includes(x.hintReason) && g.detectorReasons.length < 5) {
      g.detectorReasons.push(x.hintReason);
    }
  }
  g.samples.push({ ts: x.ts, src: x.src, dst: x.dst, srcPort: x.srcPort, dstPort: x.dstPort, protocol: x.protocol, bytes: x.bytes, info: x.info });
  if (g.samples.length > GROUPING.maxSamples) g.samples.shift();
}

function nextSeq(activities: GroupedActivity[]): number {
  let max = 0;
  for (const a of activities) {
    const n = parseInt(a.id.replace(/\D/g, ''), 10);
    if (n > max) max = n;
  }
  return max + 1;
}

/**
 * Feeds inputs into the grouping engine. Pure: returns new arrays/objects for every touched group.
 * `triggers` lists groups that warrant a NEW alert (first significance, severity escalation, or shape change).
 */
export function ingest(
  activities: GroupedActivity[],
  inputs: ActivityInput[],
  opts: { gapMs: number; idPrefix?: string } = { gapMs: GROUPING.liveGapMs },
): { activities: GroupedActivity[]; triggers: AlertTrigger[] } {
  if (inputs.length === 0) return { activities, triggers: [] };
  const list = activities.slice();
  const touched = new Map<string, number>(); // id → index in list
  const before = new Map<string, { label: string; shape: string; severity: AlertSeverity; significant: boolean }>();
  let seq = nextSeq(list);
  const prefix = opts.idPrefix ?? 'ACT';

  for (const x of [...inputs].sort((a, b) => a.ts - b.ts)) {
    const category = classify(x);
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < list.length; i++) {
      const g = list[i];
      if (x.ts - g.lastSeen > opts.gapMs) continue; // group ended — never reopen
      const s = similarity(g, x, category);
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    }

    let idx: number;
    if (bestIdx >= 0 && bestScore >= GROUPING.threshold) {
      idx = bestIdx;
      const g = list[idx];
      if (!touched.has(g.id)) {
        before.set(g.id, { label: g.label, shape: g.shape, severity: g.severity, significant: g.significant });
        list[idx] = cloneActivity(g);
        touched.set(g.id, idx);
      }
    } else {
      const g = newActivity(`${prefix}-${String(seq++).padStart(4, '0')}`, x, category);
      list.push(g);
      idx = list.length - 1;
      touched.set(g.id, idx);
      before.set(g.id, { label: '', shape: '', severity: 'LOW', significant: false });
    }
    absorb(list[idx], x);
  }

  const triggers: AlertTrigger[] = [];
  for (const [id, idx] of touched) {
    const g = list[idx];
    derive(g);
    const prev = before.get(id)!;
    if (!g.significant) continue;

    if (!prev.significant) {
      g.milestones.push({ ts: g.lastSeen, kind: 'detected', text: `${g.label} detected — ${g.reason}`, severity: g.severity });
    } else if (SEVERITY_RANK[g.severity] > SEVERITY_RANK[prev.severity]) {
      g.milestones.push({ ts: g.lastSeen, kind: 'escalated', text: `${g.label} escalated to ${g.severity} — ${g.reason}`, severity: g.severity });
    } else if (g.shape !== prev.shape) {
      g.milestones.push({ ts: g.lastSeen, kind: 'changed', text: `${prev.label} evolved into ${g.label} — ${g.reason}`, severity: g.severity });
    }

    const key = `${g.shape}|${g.severity}`;
    if (g.alertKey === null) {
      triggers.push({ kind: 'new', activity: g });
      g.alertKey = key;
    } else if (key !== g.alertKey) {
      const prevSev = g.alertKey.split('|')[1] as AlertSeverity;
      if (SEVERITY_RANK[g.severity] > SEVERITY_RANK[prevSev]) {
        triggers.push({ kind: 'escalated', activity: g });
        g.alertKey = key;
      } else if (SEVERITY_RANK[g.severity] === SEVERITY_RANK[prevSev]) {
        triggers.push({ kind: 'changed', activity: g });
        g.alertKey = key;
      }
      // A severity decrease never raises an alert.
    }
  }

  // Bound memory: keep the newest groups, preferring significant ones.
  let result = list;
  if (result.length > GROUPING.maxActivities) {
    result = [...result]
      .sort((a, b) => Number(b.significant) - Number(a.significant) || b.lastSeen - a.lastSeen)
      .slice(0, GROUPING.maxActivities)
      .sort((a, b) => a.firstSeen - b.firstSeen);
  }
  return { activities: result, triggers };
}

/** Groups historical detector indicators with the same engine used for live traffic. */
export function groupHistoricalEvents(events: SuspiciousEvent[]): GroupedActivity[] {
  return ingest([], events.map(fromSuspiciousEvent), { gapMs: GROUPING.historicalGapMs, idPrefix: 'HACT' }).activities;
}

export function isActivityActive(a: GroupedActivity, now = Date.now()): boolean {
  return now - a.lastSeen <= GROUPING.liveGapMs;
}

export function significantActivities(activities: GroupedActivity[]): GroupedActivity[] {
  return activities.filter(a => a.significant);
}

export { fmtBytes as formatActivityBytes, fmtDuration as formatActivityDuration };
