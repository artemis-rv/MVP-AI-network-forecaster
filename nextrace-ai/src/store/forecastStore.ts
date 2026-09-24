// NEXTRACE AI — Forecast Zustand Store

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
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

export const useForecastStore = create<ForecastStore>()(
  persist(
    (set) => ({
      currentForecast: null,
      selectedStage: null,
      isLoading: false,

      setForecast: (f) => set({ currentForecast: f }),
      clearForecast: () => set({ currentForecast: null, selectedStage: null }),
      setSelectedStage: (s) => set({ selectedStage: s }),
      setLoading: (v) => set({ isLoading: v }),
    }),
    {
      name: 'forecast-storage',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
