// NEXTRACE AI — REST API Service
// All calls go through this module so the base URL is configured in one place.

import type { SessionStatus } from '@/types/live';
import type { ForecastResult } from '@/types/forecast';

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
};
