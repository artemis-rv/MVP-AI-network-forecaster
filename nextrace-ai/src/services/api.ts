// NEXTRACE AI — REST API Service
// All calls go through this module so the base URL is configured in one place.

import type { SessionStatus } from '@/types/live';
import type { ForecastResult } from '@/types/forecast';
import type {
  ForensicStatusResponse,
  ForensicResultEnvelope,
} from '@/types/forensic';

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

  async getLiveStatus(): Promise<SessionStatus> {
    return request('/api/live/status');
  },

  async startLive(body: { mode: string; window_seconds: number }): Promise<{ message: string; status: SessionStatus }> {
    return request('/api/live/start', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  async stopLive(): Promise<{ message: string; status: SessionStatus }> {
    return request('/api/live/stop', { method: 'POST' });
  },

  async getLiveSummary(): Promise<SessionStatus> {
    return request('/api/live/summary');
  },

  async getForecast(): Promise<ForecastResult> {
    return request('/api/forecast/current');
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
};


