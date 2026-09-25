// NEXTRACE AI — Investigation Zustand Store
// Pure frontend state — no backend calls.
// generateFindings() reads from useForecastStore + useLiveStore.

import { create } from 'zustand';
import type {
  Investigation, InvestigationContext, Finding,
  TimelineEntry,
} from '@/types/investigation';
import { useForecastStore } from '@/store/forecastStore';
import { useLiveStore } from '@/store/liveStore';

// ── Deterministic ID generator ─────────────────────────────────────────────────
let _invCounter = 1;
function nextInvId() {
  return `INV-DEMO-${String(_invCounter++).padStart(3, '0')}`;
}

function nowHHMMSS(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: false });
}

function isoNow(): string {
  return new Date().toISOString();
}

// ── Entity classification helpers ─────────────────────────────────────────────
function classifyEntityType(ip: string): string {
  if (ip.startsWith('10.0.0.'))   return 'Suspicious Host';
  if (ip === '8.8.8.8' || ip === '1.1.1.1' || ip.startsWith('203.0.113') || ip.startsWith('198.51.100')) return 'External Destination';
  const last = parseInt(ip.split('.')[3] ?? '0');
  if (last >= 100)  return 'Application Server';
  if (last >= 50)   return 'Database Server';
  return 'Internal Workstation';
}

function priorityFromForecast(stage: string): Investigation['priority'] {
  switch (stage) {
    case 'Data Exfiltration': return 'CRITICAL';
    case 'Lateral Movement':  return 'HIGH';
    case 'Initial Access':    return 'HIGH';
    case 'Reconnaissance':    return 'MEDIUM';
    default:                  return 'LOW';
  }
}

// ── Demo fallback timeline ─────────────────────────────────────────────────────
function buildDemoTimeline(entityIp: string): TimelineEntry[] {
  const base = new Date();
  const entries: Array<[number, string, TimelineEntry['type'], string?]> = [
    [0,  `Reconnaissance activity detected from ${entityIp}`, 'observed', 'Reconnaissance'],
    [15, 'Multiple destination ports observed (scan pattern)', 'observed', 'Reconnaissance'],
    [30, `Suspicious connection established to ${entityIp}`, 'observed', 'Reconnaissance'],
    [45, 'Internal host relationship increased — multiple new edges', 'observed', 'Initial Access'],
    [60, 'Lateral movement pattern observed — cross-segment traffic', 'observed', 'Lateral Movement'],
    [75, 'Potential next stage: Data Exfiltration', 'predicted', 'Data Exfiltration'],
  ];

  return entries.map(([offsetSec, event, type, stage], i) => {
    const t = new Date(base.getTime() - (75 - offsetSec) * 1000);
    return {
      id: `tl-${i}`,
      timestamp: t.toLocaleTimeString('en-US', { hour12: false }),
      event,
      type,
      stage,
    };
  });
}

// ── Build timeline from live state ────────────────────────────────────────────
function buildLiveTimeline(entityIp?: string): TimelineEntry[] {
  const { displayEvents } = useLiveStore.getState();
  const { currentForecast } = useForecastStore.getState();

  const entries: TimelineEntry[] = displayEvents
    .filter(e => e.classification === 'suspicious' && (!entityIp || e.src_ip === entityIp || e.dst_ip === entityIp))
    .slice(0, 12)
    .reverse()
    .map((e, i) => ({
      id: `ev-${i}`,
      timestamp: e.timestamp.slice(11, 19) || nowHHMMSS(),
      event: `${e.protocol} suspicious packet: ${e.src_ip} → ${e.dst_ip}:${e.dst_port}`,
      type: 'observed' as const,
    }));

  // Append forecast sequence entries
  if (currentForecast?.state_sequence) {
    currentForecast.state_sequence.slice(-4).forEach((s, i) => {
      const t = typeof s.window_end === 'number'
        ? new Date(s.window_end * 1000).toLocaleTimeString('en-US', { hour12: false })
        : String(s.window_end).slice(11, 19);
      entries.push({
        id: `seq-${i}`,
        timestamp: t,
        event: `Attack stage classified: ${s.stage}`,
        type: 'observed',
        stage: s.stage,
      });
    });
  }

  // Predicted next
  if (currentForecast && !currentForecast.is_benign) {
    entries.push({
      id: 'predicted-next',
      timestamp: '→ Next predicted',
      event: `Potential next stage: ${currentForecast.predicted_next_stage}`,
      type: 'predicted',
      stage: currentForecast.predicted_next_stage,
    });
  }

  if (entries.length === 0) return buildDemoTimeline('unknown');
  return entries;
}

// ── Store ──────────────────────────────────────────────────────────────────────
interface InvestigationStore {
  investigation: Investigation | null;
  context: InvestigationContext | null;
  timeline: TimelineEntry[];
  findings: Finding[];
  showFindingCard: boolean;
  showReportModal: boolean;
  selectedNodeIp: string | null;

  openInvestigation: (ctx: InvestigationContext) => void;
  closeInvestigation: () => void;
  generateFindings: () => void;
  openReportModal: () => void;
  closeReportModal: () => void;
  setSelectedNodeIp: (ip: string | null) => void;
  refreshTimeline: () => void;
}

export const useInvestigationStore = create<InvestigationStore>((set, get) => ({
  investigation: null,
  context: null,
  timeline: [],
  findings: [],
  showFindingCard: false,
  showReportModal: false,
  selectedNodeIp: null,

  openInvestigation: (ctx) => {
    const { currentForecast } = useForecastStore.getState();
    const { session } = useLiveStore.getState();
    const isLive = session?.running ?? false;

    const stage = currentForecast?.current_stage ?? 'Reconnaissance';
    const priority = priorityFromForecast(stage);
    const entityType = ctx.entityType || classifyEntityType(ctx.ip);

    const inv: Investigation = {
      id: nextInvId(),
      status: 'OPEN',
      priority,
      selectedEntityIp: ctx.ip,
      entityType,
      openedAt: isoNow(),
      findings: [],
      sourceType: ctx.sourceType,
    };

    const timeline = isLive ? buildLiveTimeline(ctx.ip) : buildDemoTimeline(ctx.ip);

    set({
      investigation: inv,
      context: { ...ctx, entityType },
      timeline,
      findings: [],
      showFindingCard: false,
      selectedNodeIp: ctx.ip,
    });
  },

  closeInvestigation: () => set({ investigation: null, context: null, timeline: [], findings: [], showFindingCard: false }),

  generateFindings: () => {
    const { investigation } = get();
    const { currentForecast } = useForecastStore.getState();
    const { currentTemporal } = useLiveStore.getState();

    const stage   = currentForecast?.current_stage ?? 'Reconnaissance';
    const nextStg = currentForecast?.predicted_next_stage ?? 'Initial Access';
    const conf    = currentForecast ? (currentForecast.confidence > 0.6 ? 'Demo / High' : 'Demo / Medium') : 'Demo / Medium';

    const observations = [
      { text: `Increased internal connection rate${currentTemporal ? ` (${currentTemporal.connection_rate.toFixed(1)}/s)` : ''}`, supported: true },
      { text: `Multiple internal destination hosts${currentTemporal ? ` (${currentTemporal.unique_dst_ips} observed)` : ''}`, supported: true },
      { text: `Elevated suspicious traffic ratio${currentTemporal ? ` (${(currentTemporal.suspicious_ratio * 100).toFixed(1)}%)` : ''}`, supported: currentTemporal ? currentTemporal.suspicious_ratio > 0.1 : true },
      ...(currentForecast?.supporting_features.slice(0, 3).map(f => ({ text: f, supported: true })) ?? []),
    ];

    const finding: Finding = {
      id: `finding-${Date.now()}`,
      generatedAt: nowHHMMSS(),
      summary: `Observed traffic from ${investigation?.selectedEntityIp ?? 'unknown'} is consistent with a simulated ${stage.toLowerCase()} progression in the demo environment.`,
      confidence: conf as Finding['confidence'],
      observations,
      predictedNext: nextStg,
      currentStage: stage,
      isDemoFinding: true,
    };

    set(state => ({
      findings: [finding, ...state.findings],
      showFindingCard: true,
      investigation: state.investigation
        ? { ...state.investigation, findings: [finding, ...state.investigation.findings] }
        : null,
    }));
  },

  openReportModal: () => set({ showReportModal: true }),
  closeReportModal: () => set({ showReportModal: false }),
  setSelectedNodeIp: (ip) => set({ selectedNodeIp: ip }),

  refreshTimeline: () => {
    const { session } = useLiveStore.getState();
    const timeline = (session?.running) ? buildLiveTimeline(get().context?.ip) : buildDemoTimeline(get().context?.ip ?? 'unknown');
    set({ timeline });
  },
}));
