// NEXTRACE AI — Investigation Zustand Store
// Pure frontend state — no backend calls.
// generateFindings() reads from useForecastStore + useLiveStore.

import { create } from 'zustand';
import type {
  Investigation, InvestigationContext, Finding,
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

// ── Entity role helper (role only — suspicion comes from observed activity) ────
function classifyEntityType(ip: string): string {
  if (!/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)) return 'External Destination';
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


// ── Store ──────────────────────────────────────────────────────────────────────
interface InvestigationStore {
  investigation: Investigation | null;
  context: InvestigationContext | null;
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
}

export const useInvestigationStore = create<InvestigationStore>((set, get) => ({
  investigation: null,
  context: null,
  findings: [],
  showFindingCard: false,
  showReportModal: false,
  selectedNodeIp: null,

  openInvestigation: (ctx) => {
    const { currentForecast } = useForecastStore.getState();

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

    set({
      investigation: inv,
      context: { ...ctx, entityType },
      findings: [],
      showFindingCard: false,
      selectedNodeIp: ctx.ip,
    });
  },

  closeInvestigation: () => set({ investigation: null, context: null, findings: [], showFindingCard: false }),

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
}));
