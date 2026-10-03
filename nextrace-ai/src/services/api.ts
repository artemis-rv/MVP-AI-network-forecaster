// NEXTRACE AI — REST API Service
// All calls go through this module so the base URL is configured in one place.

import type { SessionStatus, CaptureInterface, TrafficSourceMetrics } from '@/types/live';
import type { ForecastResult } from '@/types/forecast';
import type {
  ForensicStatusResponse,
  ForensicResultEnvelope,
} from '@/types/forensic';
import type {
  Report,
  ReportListResponse,
  GenerateReportResponse,
  FindingsResponse,
} from '@/types/report';
import type { Alert, AlertStats, AlertStatus, MitigationRequest, MitigationResult } from '@/types/alert';

const BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`API ${path} → ${res.status}: ${detail}`);
  }
  return res.json() as Promise<T>;
}

export const apiService = {
  async checkHealth(): Promise<{ status: string; mode: string }> {
    return request('/api/health');
  },

  async getInterfaces(): Promise<{
    interfaces: CaptureInterface[];
    default_interface: string | null;
    platform: string;
    tshark_available: boolean;
  }> {
    return request('/api/live/interfaces');
  },

  async getLiveStatus(): Promise<SessionStatus> {
    return request('/api/live/status');
  },

  async getLiveMetrics(): Promise<TrafficSourceMetrics> {
    return request('/api/live/metrics');
  },

  async testCapture(body: {
    interface_id: string;
    duration_seconds?: number;
    bpf_filter?: string;
  }): Promise<import('@/types/live').CaptureSelfTestResult> {
    return request('/api/live/self-test', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async startLive(body: {
    mode?: string;
    window_seconds: number;
    source_type?: 'synthetic' | 'live';
    interface?: string;
    bpf_filter?: string;
  }): Promise<{ message: string; status: SessionStatus }> {
    return request('/api/live/start', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async stopLive(): Promise<{ message: string; status: SessionStatus }> {
    return request('/api/live/stop', { method: 'POST' });
  },

  async resetLive(): Promise<{ message: string; status: SessionStatus }> {
    return request('/api/live/reset', { method: 'POST' });
  },

  async getLiveSummary(): Promise<SessionStatus> {
    return request('/api/live/summary');
  },

  async getForecast(): Promise<ForecastResult> {
    return request('/api/forecast/current');
  },

  async cancelHistoricalJob(jobId: string): Promise<{ message: string; job_id: string; status: string }> {
    return request(`/api/historical/${encodeURIComponent(jobId)}/cancel`, { method: 'POST' });
  },

  // ── Forensic Analysis — isolated from all live/forecast methods ──────────────

  async startForensicAnalysis(historicalJobId: string): Promise<{ historical_job_id: string; status: string; message: string }> {
    return request(`/api/forensic/${historicalJobId}/analyze`, { method: 'POST' });
  },

  async getForensicStatus(historicalJobId: string): Promise<ForensicStatusResponse> {
    return request(`/api/forensic/${historicalJobId}/status`);
  },

  async getForensicResult(historicalJobId: string): Promise<ForensicResultEnvelope> {
    return request(`/api/forensic/${historicalJobId}/result`);
  },

  // ── Simulator — isolated from all live/forecast/historical/forensic methods ─

  async getScenarios(): Promise<import('@/types/simulator').ScenariosResponse> {
    return request('/api/simulator/scenarios');
  },

  async startSimulation(body: {
    scenario: string; k: number; window_seconds: number; speed: number;
  }): Promise<import('@/types/simulator').SimulatorStateResponse> {
    return request('/api/simulator/start', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getSimulatorStatus(simulationId: string): Promise<import('@/types/simulator').SimulatorStateResponse> {
    return request(`/api/simulator/${simulationId}/status`);
  },

  async pauseSimulation(simulationId: string): Promise<import('@/types/simulator').SimulatorStateResponse> {
    return request(`/api/simulator/${simulationId}/pause`, { method: 'POST' });
  },

  async resumeSimulation(simulationId: string): Promise<import('@/types/simulator').SimulatorStateResponse> {
    return request(`/api/simulator/${simulationId}/resume`, { method: 'POST' });
  },

  async stopSimulation(simulationId: string): Promise<import('@/types/simulator').SimulatorStateResponse> {
    return request(`/api/simulator/${simulationId}/stop`, { method: 'POST' });
  },

  async resetSimulation(simulationId: string): Promise<import('@/types/simulator').SimulatorStateResponse> {
    return request(`/api/simulator/${simulationId}/reset`, { method: 'POST' });
  },

  async nextStep(simulationId: string): Promise<import('@/types/simulator').SimulatorStateResponse> {
    return request(`/api/simulator/${simulationId}/next`, { method: 'POST' });
  },

  async getSimulatorResult(simulationId: string): Promise<import('@/types/simulator').SimulatorResult> {
    return request(`/api/simulator/${simulationId}/result`);
  },

  // ── Reports — isolated from all live/forecast/historical/forensic/simulator methods ─

  async getHistoricalFindings(jobId: string): Promise<FindingsResponse> {
    return request(`/api/reports/historical/${jobId}/findings`);
  },

  async getSimulationFindings(simulationId: string): Promise<FindingsResponse> {
    return request(`/api/reports/simulation/${simulationId}/findings`);
  },

  async generateHistoricalReport(jobId: string): Promise<GenerateReportResponse> {
    return request(`/api/reports/historical/${jobId}/generate`, { method: 'POST' });
  },

  async generateSimulationReport(simulationId: string): Promise<GenerateReportResponse> {
    return request(`/api/reports/simulation/${simulationId}/generate`, { method: 'POST' });
  },

  async getReport(reportId: string): Promise<Report> {
    return request(`/api/reports/${reportId}`);
  },

  async getReportList(): Promise<ReportListResponse> {
    return request('/api/reports/list');
  },

  // ── ALERTS API (Phase 10) ──────────────────────────────────────────────────

  async getAlerts(params?: Record<string, string>): Promise<{ alerts: Alert[]; total: number }> {
    const qs = params ? '?' + new URLSearchParams(params).toString() : '';
    return request(`/api/alerts${qs}`);
  },

  async getAlertStats(): Promise<AlertStats> {
    return request(`/api/alerts/stats`);
  },

  async getAlert(alertId: string): Promise<Alert> {
    return request(`/api/alerts/${encodeURIComponent(alertId)}`);
  },

  async acknowledgeAlert(alertId: string): Promise<Alert> {
    return request(`/api/alerts/${encodeURIComponent(alertId)}/acknowledge`, { method: 'POST' });
  },

  async resolveAlert(alertId: string): Promise<Alert> {
    return request(`/api/alerts/${encodeURIComponent(alertId)}/resolve`, { method: 'POST' });
  },

  async updateAlert(alertId: string, updates: {
    status?: AlertStatus;
    assigned_to?: string | null;
    event_count?: number;
    last_seen?: string;
    confidence?: number;
    affected_assets?: string[];
  }): Promise<Alert> {
    return request(`/api/alerts/${encodeURIComponent(alertId)}`, {
      method: 'PATCH',
      body: JSON.stringify(updates),
    });
  },

  async reopenAlert(alertId: string): Promise<Alert> {
    return request(`/api/alerts/${encodeURIComponent(alertId)}/reopen`, { method: 'POST' });
  },

  async createAlert(data: Partial<Alert> & { dedupe_key?: string }): Promise<Alert> {
    return request('/api/alerts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async mitigateAlert(body: MitigationRequest): Promise<MitigationResult> {
    return request('/api/alerts/mitigate', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async getMitigationAudit(): Promise<{ total: number; entries: MitigationResult[] }> {
    return request('/api/alerts/mitigate/audit');
  },

  /** Plain-language explanation of grouped activities (LLM when configured on the server, template otherwise). */
  async explain(body: ExplainRequest): Promise<ExplainResponse> {
    return request('/api/explain', { method: 'POST', body: JSON.stringify(body) });
  },
};

export interface ExplainActivityFacts {
  id: string;
  category: string;
  label: string;
  severity: string;
  stage: string;
  sources: string[];
  targets: string[];
  ports: number[];
  event_count: number;
  duration_seconds: number;
  bytes: number | null;
  mitre_id: string | null;
}

export interface ExplainRequest {
  context: 'historical' | 'live' | 'investigation';
  totals: { packets: number; flows: number; duration_seconds: number };
  activities: ExplainActivityFacts[];
}

export interface ExplainResponse {
  explanation: string;
  source: 'llm' | 'template';
  model: string | null;
}



