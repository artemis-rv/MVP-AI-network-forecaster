// NEXTRACE AI — Findings / Report Store (Step 8)
// No cross-store imports. Manages report and findings state independently.
// Holds both backend-stored reports and reports built in the browser by lib/reportBuilder
// (live session / historical / forensic); both render through the same ReportPage and exporters.

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

  // ── Browser-built reports (session scoped) ────────────────────────────────
  localReports:    Record<string, Report>;

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
  saveLocalReport:          (report: Report) => string;
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

function toListItem(r: Report): ReportListItem {
  return {
    report_id: r.report_id, report_type: r.report_type, source_id: r.source_id, title: r.title,
    generated_at: r.generated_at, status: r.status, finding_count: r.findings.length,
  };
}

export const useFindingsStore = create<FindingsStore>()(persist((set, get) => ({
  ..._initial,
  localReports: {},

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
    const local = get().localReports[reportId];
    if (local) {
      set({ report: local, findings: local.findings, selectedFindingId: null, filterSeverity: 'ALL', filterCategory: 'ALL', loading: false, error: null });
      return;
    }
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
    const local = Object.values(get().localReports).map(toListItem);
    let remote: ReportListItem[] = [];
    try {
      remote = (await apiService.getReportList()).reports;
    } catch {
      // Non-critical — silently ignore network errors for list polling
    }
    set({ reportList: [...local, ...remote].sort((a, b) => b.generated_at - a.generated_at) });
  },

  // ── Store a report built from current session / analysis state ───────────
  saveLocalReport: (report: Report): string => {
    set(state => ({
      localReports: { ...state.localReports, [report.report_id]: report },
      reportList: [toListItem(report), ...state.reportList.filter(r => r.report_id !== report.report_id)],
    }));
    return report.report_id;
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
}), {
  name: 'findings-storage',
  storage: createJSONStorage(() => sessionStorage),
  partialize: (state) => ({ localReports: state.localReports }),
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
