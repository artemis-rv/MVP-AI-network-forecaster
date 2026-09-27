// NEXTRACE AI — Guided tour state (kept apart from the overlay component for fast refresh)
import { create } from 'zustand';
import { stepsFor, type TourStep } from '@/components/tour/tourSteps';

const SEEN_KEY = 'nextrace-tour-seen';

interface TourState {
  steps: TourStep[] | null;
  index: number;
  start: (steps: TourStep[]) => void;
  stop: () => void;
  go: (index: number) => void;
}

export const useTourStore = create<TourState>((set) => ({
  steps: null,
  index: 0,
  start: (steps) => set({ steps: steps.length ? steps : null, index: 0 }),
  stop: () => set({ steps: null, index: 0 }),
  go: (index) => set({ index }),
}));

/** Starts the tour for the current page (plus the app-wide steps when asked). */
export function startTour(pathname: string, includeGlobal = false): void {
  const available = stepsFor(pathname, includeGlobal).filter(s => document.querySelector(s.selector));
  useTourStore.getState().start(available);
}

export function markTourSeen() {
  try { localStorage.setItem(SEEN_KEY, '1'); } catch { /* storage unavailable — tour may show again */ }
}


export function tourSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === '1'; } catch { return true; }
}
