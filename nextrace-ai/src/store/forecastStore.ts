// NEXTRACE AI — Forecast Zustand Store

import { create } from 'zustand';
import type { ForecastResult } from '@/types/forecast';

interface ForecastStore {
  currentForecast: ForecastResult | null;
  selectedStage: string | null;
  isLoading: boolean;

  setForecast: (f: ForecastResult) => void;
  clearForecast: () => void;
  setSelectedStage: (s: string | null) => void;
  setLoading: (v: boolean) => void;
}

export const useForecastStore = create<ForecastStore>((set) => ({
  currentForecast: null,
  selectedStage: null,
  isLoading: false,

  setForecast: (f) => set({ currentForecast: f }),
  clearForecast: () => set({ currentForecast: null, selectedStage: null }),
  setSelectedStage: (s) => set({ selectedStage: s }),
  setLoading: (v) => set({ isLoading: v }),
}));
