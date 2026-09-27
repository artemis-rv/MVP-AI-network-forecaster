// NEXTRACE AI — Forensic Analysis Store (Step 6)
// Completely isolated from liveStore, forecastStore, and investigationStore.
// No imports from live or forecast modules.
// State is keyed by historical_job_id — one forensic analysis per historical job.

import { create } from 'zustand';
import { apiService } from '@/services/api';
import type {
  ForensicStatus,
  ForensicAnalysisResult,
  EvidenceIntegrity,
  EvidenceSummary,
  AntiForensicIndicator,
  Hypothesis,
  FinalAssessment,
} from '@/types/forensic';
import type { HypothesisValidation } from '@/lib/reportBuilder';

const POLL_INTERVAL_MS = 600;

interface ForensicStore {
  // ── Identity ───────────────────────────────────────────────────────────────
  selectedHistoricalJobId: string | null;

  // ── Analysis state ─────────────────────────────────────────────────────────
  status:       ForensicStatus;
  progress:     number;
  currentStage: string;
  error:        string | null;
  forensicId:   string | null;

  // ── Result sections ────────────────────────────────────────────────────────
  integrity:               EvidenceIntegrity | null;
  evidenceSummary:         EvidenceSummary | null;
  antiForensicIndicators:  AntiForensicIndicator[];
  hypotheses:              Hypothesis[];
  finalAssessment:         FinalAssessment | null;
  isDemo:                  boolean;
  prototypeDisclaimer:     string | null;

  // ── UI state ───────────────────────────────────────────────────────────────
  expandedHypothesisId:    string | null;
  /** Analyst verdict per hypothesis id — the engine proposes, the analyst validates. */
  validations:             Record<string, HypothesisValidation>;

  // ── Actions ────────────────────────────────────────────────────────────────
  /** Initiate forensic analysis for a completed historical job. */
  startAnalysis:   (historicalJobId: string) => Promise<void>;
  /** Poll status until complete. */
  pollStatus:      () => Promise<void>;
  /** Fetch full result after completion. */
  fetchResult:     () => Promise<void>;
  /** Reset store state (does NOT affect historical or live state). */
  reset:           () => void;
  /** Toggle hypothesis expand/collapse. */
  toggleHypothesis:(id: string) => void;
  /** Record (or clear with null) the analyst's validation of a hypothesis. */
  validateHypothesis: (id: string, verdict: HypothesisValidation['verdict'] | null, note?: string) => void;
}

// Internal polling handle — isolated from any live/historical polling handles.
let _forensicPollInterval: ReturnType<typeof setInterval> | null = null;

function _stopPolling() {
  if (_forensicPollInterval) {
    clearInterval(_forensicPollInterval);
    _forensicPollInterval = null;
  }
}

function _startPolling(get: () => ForensicStore) {
  _forensicPollInterval = setInterval(() => {
    get().pollStatus();
  }, POLL_INTERVAL_MS);
}

const _initialState = {
  selectedHistoricalJobId: null,
  status:                  'idle' as ForensicStatus,
  progress:                0,
  currentStage:            '',
  error:                   null,
  forensicId:              null,
  integrity:               null,
  evidenceSummary:         null,
  antiForensicIndicators:  [],
  hypotheses:              [],
  finalAssessment:         null,
  isDemo:                  false,
  prototypeDisclaimer:     null,
  expandedHypothesisId:    null,
  validations:             {} as Record<string, HypothesisValidation>,
};

export const useForensicStore = create<ForensicStore>((set, get) => ({
  ..._initialState,

  // ── Start forensic analysis ───────────────────────────────────────────────
  startAnalysis: async (historicalJobId: string) => {
    _stopPolling();
    set({
      ..._initialState,
      selectedHistoricalJobId: historicalJobId,
      status: 'queued',
      currentStage: 'queued',
    });

    try {
      await apiService.startForensicAnalysis(historicalJobId);
    } catch (err) {
      set({ status: 'failed', error: String(err), currentStage: 'failed' });
      return;
    }

    _startPolling(get);
  },

  // ── Poll status ───────────────────────────────────────────────────────────
  pollStatus: async () => {
    const { selectedHistoricalJobId } = get();
    if (!selectedHistoricalJobId) return;

    try {
      const data = await apiService.getForensicStatus(selectedHistoricalJobId);
      set({
        status:       data.status,
        progress:     data.progress,
        currentStage: data.current_stage,
        forensicId:   data.forensic_id,
        error:        data.error,
      });

      if (data.status === 'completed') {
        _stopPolling();
        await get().fetchResult();
      } else if (data.status === 'failed') {
        _stopPolling();
      }
    } catch {
      // Network hiccup — keep polling
    }
  },

  // ── Fetch full result ─────────────────────────────────────────────────────
  fetchResult: async () => {
    const { selectedHistoricalJobId } = get();
    if (!selectedHistoricalJobId) return;

    try {
      const envelope = await apiService.getForensicResult(selectedHistoricalJobId);
      const r: ForensicAnalysisResult = envelope.result;
      set({
        status:                 'completed',
        integrity:              r.integrity,
        evidenceSummary:        r.evidence_summary,
        antiForensicIndicators: r.anti_forensic_indicators,
        hypotheses:             r.hypotheses,
        finalAssessment:        r.final_assessment,
        isDemo:                 r.is_demo,
        prototypeDisclaimer:    r.prototype_disclaimer,
      });
    } catch (err) {
      set({ status: 'failed', error: String(err) });
    }
  },

  // ── Reset ─────────────────────────────────────────────────────────────────
  reset: () => {
    _stopPolling();
    set(_initialState);
  },

  // ── Toggle hypothesis ─────────────────────────────────────────────────────
  toggleHypothesis: (id: string) => {
    set(s => ({
      expandedHypothesisId: s.expandedHypothesisId === id ? null : id,
    }));
  },

  validateHypothesis: (id, verdict, note = '') => {
    set(s => {
      const next = { ...s.validations };
      if (verdict === null) delete next[id];
      else next[id] = { verdict, note: note.slice(0, 500), at: Date.now() };
      return { validations: next };
    });
  },
}));
