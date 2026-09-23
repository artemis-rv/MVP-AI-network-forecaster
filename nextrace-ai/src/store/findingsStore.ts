// NEXTRACE AI — Findings / Report Store (Step 8)
// Completely isolated from liveStore, historicalStore, forensicStore, simulatorStore.
// No cross-store imports. Manages report and findings state independently.

import { create } from 'zustand';
import { apiService } from '@/services/api';
import type {
  Finding,
  Report,
  ReportListItem,
  FindingSeverity,
  FindingCategory,
} from '@/types/report';

interface FindingsStore {
  // ── Report state ──────────────────────────────────────────────────────────
  report:          Report | null;
  reportList:      ReportListItem[];

  // ── Findings (current report) ────────────────────────────────────────────
  findings:        Finding[];
  selectedFindingId: string | null;

  // ── Filters ───────────────────────────────────────────────────────────────
  filterSeverity:  FindingSeverity | 'ALL';
  filterCategory:  FindingCategory | 'ALL';

  // ── UI state ──────────────────────────────────────────────────────────────
  loading:         boolean;
  error:           string | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  generateHistoricalReport: (jobId: string) => Promise<string | null>;
  generateSimulationReport: (simulationId: string) => Promise<string | null>;
  fetchReport:              (reportId: string) => Promise<void>;
  fetchReportList:          () => Promise<void>;
  selectFinding:            (id: string | null) => void;
  setFilterSeverity:        (s: FindingSeverity | 'ALL') => void;
  setFilterCategory:        (c: FindingCategory | 'ALL') => void;
  clearFindings:            () => void;
  clearError:               () => void;
}

const _initial = {
  report:            null,
  reportList:        [],
  findings:          [],
  selectedFindingId: null,
  filterSeverity:    'ALL' as const,
  filterCategory:    'ALL' as const,
  loading:           false,
  error:             null,
};

export const useFindingsStore = create<FindingsStore>((set, get) => ({
  ..._initial,

  // ── Generate historical report ────────────────────────────────────────────
  generateHistoricalReport: async (jobId: string): Promise<string | null> => {
    set({ loading: true, error: null });
    try {
      const resp = await apiService.generateHistoricalReport(jobId);
      set({ loading: false });
      // Refresh the list
      get().fetchReportList().catch(() => {});
      return resp.report_id;
    } catch (err) {
      set({ loading: false, error: String(err) });
      return null;
    }
  },

  // ── Generate simulation report ────────────────────────────────────────────
  generateSimulationReport: async (simulationId: string): Promise<string | null> => {
    set({ loading: true, error: null });
    try {
      const resp = await apiService.generateSimulationReport(simulationId);
      set({ loading: false });
      get().fetchReportList().catch(() => {});
      return resp.report_id;
    } catch (err) {
      set({ loading: false, error: String(err) });
      return null;
    }
  },

  // ── Fetch a single report ─────────────────────────────────────────────────
  fetchReport: async (reportId: string): Promise<void> => {
    set({ loading: true, error: null });
    try {
      const report = await apiService.getReport(reportId);
      set({
        report,
        findings:          report.findings,
        selectedFindingId: null,
        filterSeverity:    'ALL',
        filterCategory:    'ALL',
        loading:           false,
      });
    } catch (err) {
      set({ loading: false, error: String(err) });
    }
  },

  // ── Fetch report list ─────────────────────────────────────────────────────
  fetchReportList: async (): Promise<void> => {
    try {
      const data = await apiService.getReportList();
      set({ reportList: data.reports });
    } catch {
      // Non-critical — silently ignore network errors for list polling
    }
  },

  // ── Select a finding ──────────────────────────────────────────────────────
  selectFinding: (id) => set({ selectedFindingId: id }),

  // ── Filters ───────────────────────────────────────────────────────────────
  setFilterSeverity: (s) => set({ filterSeverity: s }),
  setFilterCategory: (c) => set({ filterCategory: c }),

  // ── Clear findings (reset to initial) ─────────────────────────────────────
  clearFindings: () => set(_initial),

  // ── Clear error ───────────────────────────────────────────────────────────
  clearError: () => set({ error: null }),
}));

// ── Derived selector — filtered findings ─────────────────────────────────────

export function getFilteredFindings(store: FindingsStore): Finding[] {
  const { findings, filterSeverity, filterCategory } = store;
  return findings.filter(f => {
    if (filterSeverity !== 'ALL' && f.severity !== filterSeverity) return false;
    if (filterCategory !== 'ALL' && f.category !== filterCategory) return false;
    return true;
  });
}
