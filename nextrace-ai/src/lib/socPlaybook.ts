// NEXTRACE AI — SOC playbook
// Deterministic analyst knowledge applied to grouped activities, so every surface (alert, timeline,
// inspector, investigation, reports, PDF) explains an activity, names the affected assets and
// recommends the same actions. Nothing here invents data: every sentence is filled from the
// activity's own observed fields, and anything the network cannot show is stated as unknown.

import {
  type ActivityCategory, type GroupedActivity, SEVERITY_RANK,
  formatActivityBytes, formatActivityDuration,
} from '@/lib/activityGrouping';
import type { AlertSeverity } from '@/types/alert';

// ── Asset roles ───────────────────────────────────────────────────────────────

export type AssetRole = 'Workstation' | 'Server' | 'Network range' | 'External';

export function isInternalIp(ip: string): boolean {
  return /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip);
}

/** Same role rule as the live network map: private .100+ are servers, other private hosts workstations. */
export function assetRole(ip: string): AssetRole {
  if (!isInternalIp(ip)) return 'External';
  if (ip.includes('/')) return 'Network range';
  return parseInt(ip.split('.')[3] ?? '0', 10) >= 100 ? 'Server' : 'Workstation';
}

const realHosts = (ips: string[]) => ips.filter(ip => ip && ip !== 'multiple_targets');

// ── Affected assets ───────────────────────────────────────────────────────────

export interface AffectedAsset {
  ip: string;
  role: AssetRole;
  /** How the asset is affected, in one short phrase. */
  impact: string;
  activityIds: string[];
  severity: AlertSeverity;
}

/** Categories where the originating internal host is itself the victim (infected / leaking). */
const SOURCE_IS_VICTIM: Partial<Record<ActivityCategory, string>> = {
  suspicious_dns: 'Likely infected — beaconing over DNS',
  data_transfer: 'Data leaving this host',
  c2_channel: 'Possible backdoor on this host',
  lateral_movement: 'Likely compromised — originating lateral movement',
};

const TARGET_IMPACT: Record<ActivityCategory, string> = {
  icmp_recon: 'Being discovered by host sweep',
  port_scan: 'Services being mapped',
  auth_probe: 'Credential attack on login service',
  lateral_movement: 'Remote admin access attempted',
  suspicious_dns: '',
  data_transfer: 'Receiving staged data',
  c2_channel: 'Contacted over non-standard port',
  traffic_flood: 'Availability at risk',
  anomalous_flow: 'Unusual traffic received',
};

/** Internal hosts impacted by one activity. External peers are threat infrastructure, not assets. */
export function affectedAssetsOf(a: GroupedActivity): AffectedAsset[] {
  const out: AffectedAsset[] = [];
  const victimImpact = SOURCE_IS_VICTIM[a.category];
  if (victimImpact) {
    for (const ip of realHosts(a.sources)) {
      if (isInternalIp(ip)) out.push({ ip, role: assetRole(ip), impact: victimImpact, activityIds: [a.id], severity: a.severity });
    }
  }
  const targetImpact = TARGET_IMPACT[a.category];
  // A DNS resolver only relays the lookups; it is not the affected asset.
  if (targetImpact) {
    for (const ip of realHosts(a.targets)) {
      if (isInternalIp(ip) && !out.some(x => x.ip === ip)) {
        out.push({ ip, role: assetRole(ip), impact: targetImpact, activityIds: [a.id], severity: a.severity });
      }
    }
  }
  return out;
}

/** Affected assets across activities, merged per host (highest severity wins, impacts combined). */
export function affectedAssets(activities: GroupedActivity[]): AffectedAsset[] {
  const byIp = new Map<string, AffectedAsset>();
  for (const a of activities) {
    for (const x of affectedAssetsOf(a)) {
      const cur = byIp.get(x.ip);
      if (!cur) { byIp.set(x.ip, { ...x }); continue; }
      if (!cur.impact.includes(x.impact)) cur.impact = `${cur.impact}; ${x.impact}`;
      if (!cur.activityIds.includes(a.id)) cur.activityIds.push(a.id);
      if (SEVERITY_RANK[x.severity] > SEVERITY_RANK[cur.severity]) cur.severity = x.severity;
    }
  }
  return Array.from(byIp.values()).sort((p, q) => SEVERITY_RANK[q.severity] - SEVERITY_RANK[p.severity]);
}

export function assetLine(x: AffectedAsset): string {
  return `${x.ip} (${x.role}) — ${x.impact}`;
}

// ── Plain-language explanation ────────────────────────────────────────────────

const SERVICE: Record<number, string> = {
  21: 'FTP', 22: 'SSH', 23: 'Telnet', 135: 'RPC', 139: 'NetBIOS', 445: 'SMB', 3389: 'RDP', 5985: 'WinRM', 5986: 'WinRM',
};

function services(a: GroupedActivity): string {
  const s = Array.from(new Set(a.ports.map(p => SERVICE[p]).filter(Boolean)));
  return s.length ? s.join('/') : 'the service';
}

function hosts(ips: string[]): string {
  const h = realHosts(ips);
  if (h.length === 0) return 'several hosts';
  return h.length <= 2 ? h.join(' and ') : `${h[0]} and ${h.length - 1} other hosts`;
}

function domainsOf(a: GroupedActivity): string[] {
  return Object.keys(a.payloadPatterns).filter(k => k.startsWith('dns:')).map(k => k.slice(4).replace(/\s*\(.*\)$/, ''));
}

/**
 * How much happened. Live activities count packets; historical activities count detector indicators,
 * each of which already summarises a burst of packets — so they are described as flagged bursts.
 */
function volume(a: GroupedActivity, noun: string): string {
  const n = a.eventCount.toLocaleString();
  return a.detectorConfirmed ? `${n} flagged burst${a.eventCount === 1 ? '' : 's'} of ${noun}` : `${n} ${noun}`;
}

/** One or two sentences a non-specialist can act on. */
export function explainActivity(a: GroupedActivity): string {
  const src = hosts(a.sources);
  const dst = hosts(a.targets);
  // Omitted when unknown: detector indicators can share one timestamp and may carry no port.
  const inDur = a.lastSeen > a.firstSeen ? ` in ${formatActivityDuration(a.lastSeen - a.firstSeen)}` : '';
  const ports = a.portCount > 0 ? `${a.portCount} different ports` : 'multiple ports';
  switch (a.category) {
    case 'port_scan':
      return a.shape === 'sweep'
        ? `${src} is checking ${dst} for open services (${ports}${inDur}). Attackers map a network like this before choosing what to attack.`
        : `${src} tried ${ports} on ${dst}${inDur} to see which services are running. This is usually the first step before an attack.`;
    case 'icmp_recon':
      return `${src} sent ${volume(a, 'pings')} to ${dst}${inDur} to find out which machines are online.`;
    case 'auth_probe':
      return `${src} made ${volume(a, 'login attempts')} to ${services(a)} on ${dst}${inDur}, which looks like password guessing. ` +
        `The traffic is encrypted, so the network cannot show whether any attempt succeeded. Check the server's login records.`;
    case 'lateral_movement':
      return `${src}, a machine inside the network, is connecting to ${dst} through Windows remote-admin services (${services(a)}). ` +
        `Attackers use these connections to spread from one compromised computer to the next.`;
    case 'suspicious_dns': {
      const d = domainsOf(a);
      return `${src} made ${volume(a, 'lookups')} for unusual domain names${d.length ? ` (${d.slice(0, 3).join(', ')})` : ''}. ` +
        `Malware often uses DNS like this to receive commands without being noticed.`;
    }
    case 'data_transfer': {
      const external = realHosts(a.targets).some(t => !isInternalIp(t));
      const size = a.bytes !== null ? formatActivityBytes(a.bytes) : 'data';
      return external
        ? `${src} sent ${size} to ${dst}, outside the network${inDur}. If nobody expected this transfer, data may be leaking.`
        : `${src} moved ${size} to ${dst}${inDur}. Attackers often gather data in one place like this before taking it out.`;
    }
    case 'c2_channel':
      return `${src} talked to ${dst} on unusual port(s) ${a.ports.slice(0, 4).join(', ')}. Backdoors and remote-control malware often use ports like these.`;
    case 'traffic_flood':
      return `${src} is sending traffic to ${dst} at a very high rate, which can slow down or knock the service offline.`;
    default:
      return `${volume(a, 'packets')} between ${src} and ${dst} did not match normal behaviour. They need a closer look before anyone acts on them.`;
  }
}

// ── Recommended actions ───────────────────────────────────────────────────────

export type ActionPriority = 'Immediate' | 'Next' | 'Follow-up';

export interface RecommendedAction {
  priority: ActionPriority;
  action: string;
  /** Why this action, tied to observed evidence. */
  rationale: string;
  activityIds: string[];
}

const PRIORITY_RANK: Record<ActionPriority, number> = { Immediate: 0, Next: 1, 'Follow-up': 2 };

function act(priority: ActionPriority, action: string, rationale: string, a: GroupedActivity): RecommendedAction {
  return { priority, action, rationale, activityIds: [a.id] };
}

function clock(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-US', { hour12: false });
}

/** Prioritised containment → investigation → hardening steps for one activity. */
export function recommendedActionsFor(a: GroupedActivity): RecommendedAction[] {
  const src = hosts(a.sources);
  const dst = hosts(a.targets);
  const ports = a.ports.slice(0, 6).join(', ');
  switch (a.category) {
    case 'icmp_recon':
      return [
        act('Immediate', `Confirm whether ${src} is an authorised scanner; if not, block it at the firewall.`, `${volume(a, 'ping probes')} from ${src} (${a.id}).`, a),
        act('Next', `Restrict ICMP echo from untrusted hosts to ${dst}.`, 'Host discovery works because hosts answer pings.', a),
        act('Follow-up', `Watch ${src} for port scans or login attempts against the hosts that answered.`, 'Discovery normally comes before targeting.', a),
      ];
    case 'port_scan':
      return [
        act('Immediate', `Confirm whether ${src} is an authorised scanner; if not, block it at the firewall.`, `${volume(a, 'probes')} from ${src} (${a.id}).`, a),
        act('Next', `Review which probed ports are actually open on ${dst} and close services that are not needed.`, a.portCount ? `${a.portCount} distinct ports probed.` : 'Probed ports were not recorded by the detector.', a),
        act('Follow-up', `Watch ${src} for follow-on login attempts or exploitation.`, 'Reconnaissance normally precedes an attack.', a),
      ];
    case 'auth_probe':
      return [
        act('Immediate', `Block ${src} from ${services(a)} (port ${ports}) on ${dst}.`, `${volume(a, 'repeated login attempts')} (${a.id}).`, a),
        act('Immediate', `Check the login logs on ${dst} for a successful login from ${src} after ${clock(a.firstSeen)}.`, 'The encrypted traffic cannot show whether an attempt succeeded.', a),
        act('Next', `Enforce key-based login or MFA and an account-lockout policy on ${services(a)}.`, 'This stops password guessing from working.', a),
        act('Follow-up', 'If any login succeeded, reset the credentials involved and review what that session did.', 'A successful login would mean the attacker has initial access.', a),
      ];
    case 'lateral_movement':
      return [
        act('Immediate', `Isolate ${src} from the network (EDR containment).`, `It opened ${a.eventCount} remote-admin connections to ${dst} (${a.id}).`, a),
        act('Immediate', `Collect logon and service-creation evidence on ${dst} (Windows events 4624 type 3/10, 7045, 5140).`, `This shows whether ${services(a)} was used to run code.`, a),
        act('Next', `Allow ${services(a)} to ${dst} only from admin jump hosts.`, 'Workstation-to-server admin traffic should not be possible.', a),
        act('Follow-up', `Reset credentials used on ${src} and look for the same pattern on other hosts.`, 'Lateral movement usually relies on stolen credentials.', a),
      ];
    case 'suspicious_dns': {
      const d = domainsOf(a);
      return [
        act('Immediate', `Block or sinkhole ${d.length ? d.slice(0, 3).join(', ') : 'the queried domains'} at the DNS resolver.`, `${a.eventCount} lookups from ${src} (${a.id}).`, a),
        act('Next', `Scan ${src} for malware (processes, persistence, recent downloads).`, 'An infected host is the most likely source of these lookups.', a),
        act('Follow-up', 'Search DNS logs for other hosts resolving the same domains.', 'This finds other infected machines.', a),
      ];
    }
    case 'data_transfer':
      return [
        act('Immediate', `Block traffic from ${src} to ${dst} and keep the firewall and proxy logs.`, `${a.bytes !== null ? formatActivityBytes(a.bytes) : 'Data'} transferred (${a.id}).`, a),
        act('Immediate', `Work out what data left ${src} (file-access and DLP logs).`, 'This determines the impact and whether it must be reported.', a),
        act('Next', `Isolate ${src} if the transfer was not business-approved.`, 'This stops any further data loss.', a),
        act('Follow-up', 'Decide whether breach-notification obligations apply.', 'Legal and compliance teams need to be involved if data was lost.', a),
      ];
    case 'c2_channel':
      return [
        act('Immediate', `Block ${dst} on port(s) ${ports} and isolate ${src}.`, `Non-standard port traffic (${a.id}).`, a),
        act('Next', `Capture memory and the process list from ${src} before rebooting it.`, 'This preserves evidence of the implant.', a),
      ];
    case 'traffic_flood':
      return [
        act('Immediate', `Rate-limit or filter ${src} upstream and monitor whether ${dst} stays available.`, `High-rate burst (${a.id}).`, a),
      ];
    default:
      return [
        act('Next', `Review the flagged flows between ${src} and ${dst} against normal behaviour, then escalate or tune the rule.`, `${a.eventCount} anomalous packets (${a.id}).`, a),
      ];
  }
}

/** Actions across activities: most severe activities first, duplicates merged, capped for readability. */
export function recommendedActions(activities: GroupedActivity[], limit = 10): RecommendedAction[] {
  const ordered = [...activities].sort((p, q) => SEVERITY_RANK[q.severity] - SEVERITY_RANK[p.severity] || p.firstSeen - q.firstSeen);
  const merged = new Map<string, RecommendedAction>();
  for (const a of ordered) {
    for (const r of recommendedActionsFor(a)) {
      const cur = merged.get(r.action);
      if (cur) { if (!cur.activityIds.includes(a.id)) cur.activityIds.push(a.id); }
      else merged.set(r.action, { ...r, activityIds: [...r.activityIds] });
    }
  }
  return Array.from(merged.values())
    .sort((p, q) => PRIORITY_RANK[p.priority] - PRIORITY_RANK[q.priority])
    .slice(0, limit);
}

export function actionLine(r: RecommendedAction): string {
  return `[${r.priority}] ${r.action} — ${r.rationale}`;
}

// ── Attack stage map ──────────────────────────────────────────────────────────

/** "1 event" / "12 events"; detector-derived activities count indicators. */
export function countLabel(a: GroupedActivity): string {
  const noun = a.detectorConfirmed ? 'indicator' : 'event';
  return `${a.eventCount.toLocaleString()} ${noun}${a.eventCount === 1 ? '' : 's'}`;
}

export const KILL_CHAIN_STAGES = [
  'Reconnaissance', 'Initial Access', 'Lateral Movement', 'Command & Control', 'Data Exfiltration', 'Impact',
] as const;

export type StageStatus = 'observed' | 'predicted' | 'not_observed';

export interface StageMapEntry {
  stage: string;
  status: StageStatus;
  activityIds: string[];
  severity: AlertSeverity | null;
  firstSeen: number | null;
  summary: string;
}

/** Kill-chain view: each stage marked observed (with evidence), predicted (forecast) or not observed. */
export function buildStageMap(activities: GroupedActivity[], predictedStage?: string | null): StageMapEntry[] {
  return KILL_CHAIN_STAGES.map(stage => {
    const acts = activities.filter(a => a.stage === stage);
    if (acts.length) {
      const sev = acts.reduce<AlertSeverity>((m, a) => SEVERITY_RANK[a.severity] > SEVERITY_RANK[m] ? a.severity : m, 'LOW');
      return {
        stage, status: 'observed' as const, activityIds: acts.map(a => a.id), severity: sev,
        firstSeen: Math.min(...acts.map(a => a.firstSeen)),
        summary: acts.map(a => `${a.label} (${countLabel(a)})`).join('; '),
      };
    }
    if (predictedStage && predictedStage === stage) {
      return { stage, status: 'predicted' as const, activityIds: [], severity: null, firstSeen: null, summary: 'Forecast as the likely next stage' };
    }
    return { stage, status: 'not_observed' as const, activityIds: [], severity: null, firstSeen: null, summary: 'No evidence' };
  });
}

// ── Entity behaviour (aggregated view behind one alert) ───────────────────────

const ATTEMPT_NOUN: Record<ActivityCategory, string> = {
  icmp_recon: 'ping probes',
  port_scan: 'port probes',
  auth_probe: 'login attempts',
  lateral_movement: 'remote-admin connections',
  suspicious_dns: 'DNS lookups',
  data_transfer: 'transfer packets',
  c2_channel: 'connections',
  traffic_flood: 'packets',
  anomalous_flow: 'packets',
};

const OUTCOME: Partial<Record<ActivityCategory, string>> = {
  auth_probe: 'Success/failure not visible (encrypted) — verify in the server login logs',
  lateral_movement: 'Whether code ran is not visible in traffic — verify with host logs',
  data_transfer: 'Transfer completed at network level; content not inspected',
  port_scan: 'Open/closed state of probed ports not recorded',
};

function plural(noun: string, n: number): string {
  return n === 1 && noun.endsWith('s') ? noun.slice(0, -1) : noun;
}

export interface BehaviourRow {
  activityId: string;
  label: string;
  category: ActivityCategory;
  role: 'source' | 'target';
  counterparts: string[];
  attempts: number;
  noun: string;
  services: string;
  firstSeen: number;
  lastSeen: number;
  severity: AlertSeverity;
  outcome: string;
  alertIds: string[];
}

export interface EntityBehaviour {
  rows: BehaviourRow[];
  /** Raw events that the rows aggregate. */
  totalEvents: number;
  alerts: number;
  attackTypes: number;
  repeated: boolean;
}

/** Everything one host did (or had done to it), aggregated per activity — the evidence behind its alerts. */
export function entityBehaviour(ip: string, activities: GroupedActivity[]): EntityBehaviour {
  const rows: BehaviourRow[] = [];
  for (const a of activities) {
    const isSrc = a.sources.includes(ip);
    const isTgt = a.targets.includes(ip);
    if (!isSrc && !isTgt) continue;
    rows.push({
      activityId: a.id,
      label: a.label,
      category: a.category,
      role: isSrc ? 'source' : 'target',
      counterparts: realHosts(isSrc ? a.targets : a.sources),
      attempts: a.eventCount,
      noun: plural(a.detectorConfirmed ? 'detector indicators' : ATTEMPT_NOUN[a.category], a.eventCount),
      services: a.portCount ? (services(a) !== 'the service' ? services(a) : `${a.portCount} port(s)`) : '—',
      firstSeen: a.firstSeen,
      lastSeen: a.lastSeen,
      severity: a.severity,
      outcome: OUTCOME[a.category] ?? 'Observed at network level',
      alertIds: a.alertIds,
    });
  }
  rows.sort((p, q) => SEVERITY_RANK[q.severity] - SEVERITY_RANK[p.severity] || q.attempts - p.attempts);
  return {
    rows,
    totalEvents: rows.reduce((n, r) => n + r.attempts, 0),
    alerts: rows.reduce((n, r) => n + r.alertIds.length, 0),
    attackTypes: new Set(rows.map(r => r.category)).size,
    repeated: rows.some(r => r.attempts > 1),
  };
}
