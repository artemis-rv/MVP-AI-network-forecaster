import { create } from 'zustand';
import { apiService } from '@/services/api';
import { useLiveStore } from './liveStore';
import { generateProbabilisticForecast } from '@/lib/forecastEngine';
import type {
  SimulatorStatus,
  SimulatorResult,
  SimEvent,
  ForecastSnapshot,
  StageProfile,
  SyntheticFeatureProfile,
  ScenarioDescriptor,
} from '@/types/simulator';


// ── Config defaults (mirrors backend defaults) ─────────────────────────────────
export const DEFAULT_CONFIG = {
  scenario: 'controlled_attack_progression',
  k: 5,
  window_seconds: 15,
  speed: 1.0,
};

export const K_MIN = 3;
export const K_MAX = 8;

interface SimulatorStore {
  // ── Config ─────────────────────────────────────────────────────────────────
  config: { scenario: string; k: number; window_seconds: number; speed: number };
  scenarios: ScenarioDescriptor[];

  // ── Identity ───────────────────────────────────────────────────────────────
  simulationId: string | null;

  // ── Status ─────────────────────────────────────────────────────────────────
  status: SimulatorStatus;
  currentStep: number;
  totalSteps: number;
  stageSequence: string[];
  currentStage: string | null;

  // ── Current step data ──────────────────────────────────────────────────────
  currentEvent: SimEvent | null;
  currentForecast: ForecastSnapshot | null;
  currentFeatures: SyntheticFeatureProfile | null;
  liveTrafficHistory: SimEvent[];

  // ── Result data (loaded after completion or on demand) ─────────────────────
  allEvents: SimEvent[];
  allForecasts: ForecastSnapshot[];
  stageProfiles: StageProfile[];
  result: SimulatorResult | null;

  // ── UI state ───────────────────────────────────────────────────────────────
  selectedStep: number | null;
  error: string | null;
  isLoading: boolean;

  // ── Snapshot state ────────────────────────────────────────────────────────
  snapshotNodes: any[];
  snapshotEdges: any[];

  // ── Actions ────────────────────────────────────────────────────────────────
  loadScenarios: () => Promise<void>;
  setConfig: (patch: Partial<typeof DEFAULT_CONFIG>) => void;
  startSimulation: () => Promise<void>;
  pauseSimulation: () => Promise<void>;
  resumeSimulation: () => Promise<void>;
  stopSimulation: () => Promise<void>;
  resetSimulation: () => Promise<void>;
  nextStep: () => Promise<void>;
  refreshStatus: () => Promise<void>;
  loadResult: () => Promise<void>;
  selectStep: (step: number | null) => void;
  hardReset: () => void;
}

// Internal polling handle — isolated from any other module's polling handles
let _pollInterval: ReturnType<typeof setInterval> | null = null;
let _autoAdvanceInterval: ReturnType<typeof setInterval> | null = null;
let _stepInFlight = false;

function _stopPolling() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}
function _stopAutoAdvance() {
  if (_autoAdvanceInterval) { clearInterval(_autoAdvanceInterval); _autoAdvanceInterval = null; }
}

function _startAutoAdvance(get: () => SimulatorStore) {
  _stopAutoAdvance();
  // Fixed interval for auto-advance (since speed config was removed)
  const intervalMs = 2500;
  _autoAdvanceInterval = setInterval(() => {
    if (get().status === 'running') void get().nextStep();
  }, intervalMs);
}

const _initial: Pick<SimulatorStore,
  'simulationId' | 'status' | 'currentStep' | 'totalSteps' | 'stageSequence' |
  'currentStage' | 'currentEvent' | 'currentForecast' | 'currentFeatures' |
  'liveTrafficHistory' | 'allEvents' | 'allForecasts' | 'stageProfiles' | 'result' | 'selectedStep' | 'error' | 'isLoading' |
  'snapshotNodes' | 'snapshotEdges'
> = {
  simulationId: null,
  status: 'idle',
  currentStep: -1,
  totalSteps: 0,
  stageSequence: [],
  currentStage: null,
  currentEvent: null,
  currentForecast: null,
  currentFeatures: null,
  liveTrafficHistory: [],
  allEvents: [],
  allForecasts: [],
  stageProfiles: [],
  result: null,
  selectedStep: null,
  error: null,
  isLoading: false,
  snapshotNodes: [],
  snapshotEdges: [],
};



export const useSimulatorStore = create<SimulatorStore>((set, get) => ({
  ..._initial,
  config: { ...DEFAULT_CONFIG },
  scenarios: [],

  // ── Load scenarios ──────────────────────────────────────────────────────────
  loadScenarios: async () => {
    try {
      const data = await apiService.getScenarios();
      set({ scenarios: data.scenarios });
    } catch { /* non-critical */ }
  },

  // ── Config ──────────────────────────────────────────────────────────────────
  setConfig: (patch: Partial<typeof DEFAULT_CONFIG>) => set((s: any) => ({ config: { ...s.config, ...patch } })),

  // ── Start ───────────────────────────────────────────────────────────────────
  startSimulation: async () => {
    _stopPolling();
    _stopAutoAdvance();
    const { config } = get();
    
    // Capture snapshot from Live Store
    const liveStore = useLiveStore.getState();
    const snapshotNodes = [...liveStore.liveNodes];
    const snapshotEdges = [...liveStore.liveEdges];

    set({ ..._initial, isLoading: true, status: 'running', config, snapshotNodes, snapshotEdges });
    try {
      const forecast = generateProbabilisticForecast(snapshotNodes, snapshotEdges, config.k, config.window_seconds);
      
      const simulationId = `FORECAST-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

      set({
        simulationId,
        status: 'running',
        currentStep: -1,
        totalSteps: forecast.stageSequence.length,
        stageSequence: forecast.stageSequence,
        allEvents: forecast.allEvents,
        allForecasts: forecast.allForecasts,
        stageProfiles: forecast.stageProfiles,
        liveTrafficHistory: [],
      });

      _startAutoAdvance(get);
    } catch (err) {
      set({ status: 'idle', error: String(err), isLoading: false });
    }
  },

  // ── Pause ───────────────────────────────────────────────────────────────────
  pauseSimulation: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    try {
      _stopPolling();
      _stopAutoAdvance();
      set({ status: 'paused' });
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Resume ──────────────────────────────────────────────────────────────────
  resumeSimulation: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    try {
      set({ status: 'running' });
      _startAutoAdvance(get);
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Stop ────────────────────────────────────────────────────────────────────
  stopSimulation: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    _stopPolling();
    _stopAutoAdvance();
    try {
      set({ status: 'stopped' });
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Reset ───────────────────────────────────────────────────────────────────
  resetSimulation: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    _stopPolling();
    _stopAutoAdvance();
    try {
      set({
        currentStep: -1,
        currentStage: null,
        currentEvent: null,
        currentForecast: null,
        currentFeatures: null,
        liveTrafficHistory: [],
        status: 'running',
        selectedStep: null,
      });
      _startAutoAdvance(get);
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Next Step ───────────────────────────────────────────────────────────────
  nextStep: async () => {
    const state = get();
    if (!state.simulationId || _stepInFlight) return;
    _stepInFlight = true;
    try {
      const nextIdx = state.currentStep + 1;
      if (nextIdx >= state.totalSteps) {
        set({ status: 'completed' });
        _stopAutoAdvance();
        await get().loadResult();
        return;
      }

      const currentEvent = state.allEvents[nextIdx];
      const currentForecast = state.allForecasts[nextIdx];
      const currentStage = state.stageSequence[nextIdx];
      const currentFeatures = currentEvent?.synthetic_feature_profile ?? null;
      const liveTrafficHistory = [...state.liveTrafficHistory, currentEvent].filter(Boolean) as SimEvent[];

      set({
        currentStep: nextIdx,
        currentStage,
        currentEvent,
        currentForecast,
        currentFeatures,
        liveTrafficHistory,
      });

      if (nextIdx === state.totalSteps - 1) {
        set({ status: 'completed' });
        _stopAutoAdvance();
        await get().loadResult();
      }
    } catch (err) { set({ error: String(err) }); }
    finally { _stepInFlight = false; }
  },

  // ── Refresh status ──────────────────────────────────────────────────────────
  refreshStatus: async () => {
    // Local simulation does not need polling the backend.
  },

  // ── Load full result ─────────────────────────────────────────────────────────
  loadResult: async () => {
    // Local simulation already has everything in memory.
  },

  // ── Select step ─────────────────────────────────────────────────────────────
  selectStep: (step: number | null) => set({ selectedStep: step }),

  // ── Hard reset (clears everything) ─────────────────────────────────────────
  hardReset: () => {
    _stopAutoAdvance();
    _stepInFlight = false;
    set({ ..._initial, config: { ...DEFAULT_CONFIG }, scenarios: get().scenarios });
  },
}));
