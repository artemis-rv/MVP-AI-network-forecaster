// NEXTRACE AI — Historical Analysis Store
// Completely isolated from liveStore, forecastStore, and investigationStore.
// No imports from live or forecast modules.

import { create } from 'zustand';
import type {
  HistoricalJobMeta,
  HistoricalJobStatus,
  HistoricalJobStatusResponse,
  HistoricalResult,
} from '@/types/historical';

const API_BASE = 'http://localhost:8000/api/historical';
const POLL_INTERVAL_MS = 800;

interface HistoricalStore {
  // ── Job state ──────────────────────────────────────────────────────────────
  currentJobId:    string | null;
  jobMeta:         HistoricalJobMeta | null;
  status:          HistoricalJobStatus;
  progress:        number;
  packetsProcessed:number;
  flowsDetected:   number;
  currentStage:    string;
  error:           string | null;
  result:          HistoricalResult | null;
  isDemo:          boolean;

  // ── UI state ──────────────────────────────────────────────────────────────
  selectedEntityIp:     string | null;
  selectedTimelineIdx:  number | null;

  // ── Actions ───────────────────────────────────────────────────────────────
  uploadPcap:     (file: File) => Promise<void>;
  loadDemoJob:    () => Promise<void>;
  pollStatus:     () => Promise<void>;
  fetchResult:    () => Promise<void>;
  clearJob:       () => void;
  setSelectedEntity: (ip: string | null) => void;
  setSelectedTimeline: (idx: number | null) => void;
}

// Internal polling handle
let _pollInterval: ReturnType<typeof setInterval> | null = null;

function _stopPolling() {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
}

export const useHistoricalStore = create<HistoricalStore>((set, get) => ({
  currentJobId:        null,
  jobMeta:             null,
  status:              'idle',
  progress:            0,
  packetsProcessed:    0,
  flowsDetected:       0,
  currentStage:        '',
  error:               null,
  result:              null,
  isDemo:              false,
  selectedEntityIp:    null,
  selectedTimelineIdx: null,

  // ── Upload a real PCAP file ──────────────────────────────────────────────
  uploadPcap: async (file: File) => {
    _stopPolling();
    set({
      status: 'queued', progress: 0, error: null,
      result: null, currentJobId: null, jobMeta: null,
      packetsProcessed: 0, flowsDetected: 0, currentStage: 'uploading', isDemo: false,
    });

    const formData = new FormData();
    formData.append('file', file);

    let meta: HistoricalJobMeta;
    try {
      const res = await fetch(`${API_BASE}/upload`, { method: 'POST', body: formData });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Upload failed: ${res.status}`);
      }
      meta = await res.json();
    } catch (err) {
      set({ status: 'failed', error: String(err), currentStage: 'failed' });
      return;
    }

    set({ currentJobId: meta.job_id, jobMeta: meta, status: 'parsing', currentStage: 'parsing' });
    _startPolling(get);
  },

  // ── Start a demo analysis job ─────────────────────────────────────────────
  loadDemoJob: async () => {
    _stopPolling();
    set({
      status: 'queued', progress: 0, error: null,
      result: null, currentJobId: null, jobMeta: null,
      packetsProcessed: 0, flowsDetected: 0, currentStage: 'queued', isDemo: true,
    });

    let meta: HistoricalJobMeta;
    try {
      const res = await fetch(`${API_BASE}/demo`, { method: 'POST' });
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(detail.detail ?? `Demo failed: ${res.status}`);
      }
      meta = await res.json();
    } catch (err) {
      set({ status: 'failed', error: String(err), currentStage: 'failed' });
      return;
    }

    set({
      currentJobId: meta.job_id, jobMeta: { ...meta, is_demo: true },
      status: 'queued', currentStage: 'queued',
    });
    _startPolling(get);
  },

  // ── Poll status endpoint ──────────────────────────────────────────────────
  pollStatus: async () => {
    const { currentJobId } = get();
    if (!currentJobId) return;

    try {
      const res = await fetch(`${API_BASE}/${currentJobId}/status`);
      if (!res.ok) return;
      const data: HistoricalJobStatusResponse = await res.json();

      set({
        status:           data.status,
        progress:         data.progress,
        packetsProcessed: data.packets_processed,
        flowsDetected:    data.flows_detected,
        currentStage:     data.current_stage,
        error:            data.error,
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
    const { currentJobId } = get();
    if (!currentJobId) return;

    try {
      const res = await fetch(`${API_BASE}/${currentJobId}/result`);
      if (!res.ok) {
        const detail = await res.json().catch(() => ({ detail: res.statusText }));
        set({ status: 'failed', error: detail.detail ?? 'Failed to fetch result' });
        return;
      }
      const envelope = await res.json();
      set({ result: envelope.result, status: 'completed' });
    } catch (err) {
      set({ status: 'failed', error: String(err) });
    }
  },

  // ── Clear / reset ─────────────────────────────────────────────────────────
  clearJob: () => {
    _stopPolling();
    set({
      currentJobId: null, jobMeta: null, status: 'idle',
      progress: 0, packetsProcessed: 0, flowsDetected: 0,
      currentStage: '', error: null, result: null, isDemo: false,
      selectedEntityIp: null, selectedTimelineIdx: null,
    });
  },

  setSelectedEntity:  (ip) => set({ selectedEntityIp: ip }),
  setSelectedTimeline:(idx) => set({ selectedTimelineIdx: idx }),
}));

function _startPolling(get: () => HistoricalStore) {
  _pollInterval = setInterval(() => {
    get().pollStatus();
  }, POLL_INTERVAL_MS);
}
