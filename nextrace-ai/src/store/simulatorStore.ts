// NEXTRACE AI — Simulator Store (Step 7)
// Completely isolated from liveStore, historicalStore, forensicStore, investigationStore.
// No cross-store imports. Manages all simulation state independently.

import { create } from 'zustand';
import { apiService } from '@/services/api';
import type {
  SimulatorStatus,
  SimulatorStateResponse,
  SimulatorResult,
  SimEvent,
  ForecastSnapshot,
  StageProfile,
  SyntheticFeatureProfile,
  ScenarioDescriptor,
} from '@/types/simulator';

const POLL_MS = 800;

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

  // ── Result data (loaded after completion or on demand) ─────────────────────
  allEvents: SimEvent[];
  allForecasts: ForecastSnapshot[];
  stageProfiles: StageProfile[];
  result: SimulatorResult | null;

  // ── UI state ───────────────────────────────────────────────────────────────
  selectedStep: number | null;
  error: string | null;
  isLoading: boolean;

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

function _stopPolling() {
  if (_pollInterval) { clearInterval(_pollInterval); _pollInterval = null; }
}
function _startPolling(get: () => SimulatorStore) {
  _pollInterval = setInterval(() => { get().refreshStatus(); }, POLL_MS);
}

const _initial: Pick<SimulatorStore,
  'simulationId' | 'status' | 'currentStep' | 'totalSteps' | 'stageSequence' |
  'currentStage' | 'currentEvent' | 'currentForecast' | 'currentFeatures' |
  'allEvents' | 'allForecasts' | 'stageProfiles' | 'result' | 'selectedStep' | 'error' | 'isLoading'
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
  allEvents: [],
  allForecasts: [],
  stageProfiles: [],
  result: null,
  selectedStep: null,
  error: null,
  isLoading: false,
};

function _applyState(
  state: SimulatorStateResponse,
  extra?: Partial<Pick<SimulatorStore, 'allEvents' | 'allForecasts' | 'stageProfiles' | 'result' | 'selectedStep'>>,
): Partial<SimulatorStore> {
  return {
    simulationId:   state.simulation_id,
    status:         state.status,
    currentStep:    state.current_step,
    totalSteps:     state.total_steps,
    stageSequence:  state.stage_sequence,
    currentStage:   state.current_stage,
    currentEvent:   state.current_event,
    currentForecast:state.current_forecast,
    currentFeatures:state.current_event?.synthetic_feature_profile ?? null,
    error:          null,
    isLoading:      false,
    ...extra,
  };
}

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
  setConfig: (patch) => set(s => ({ config: { ...s.config, ...patch } })),

  // ── Start ───────────────────────────────────────────────────────────────────
  startSimulation: async () => {
    _stopPolling();
    const { config } = get();
    set({ ..._initial, isLoading: true, status: 'running', config });
    try {
      const data = await apiService.startSimulation(config);
      set(_applyState(data));
      _startPolling(get);
    } catch (err) {
      set({ status: 'idle', error: String(err), isLoading: false });
    }
  },

  // ── Pause ───────────────────────────────────────────────────────────────────
  pauseSimulation: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    try {
      const data = await apiService.pauseSimulation(simulationId);
      _stopPolling();
      set(_applyState(data));
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Resume ──────────────────────────────────────────────────────────────────
  resumeSimulation: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    try {
      const data = await apiService.resumeSimulation(simulationId);
      set(_applyState(data));
      _startPolling(get);
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Stop ────────────────────────────────────────────────────────────────────
  stopSimulation: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    _stopPolling();
    try {
      const data = await apiService.stopSimulation(simulationId);
      set(_applyState(data));
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Reset ───────────────────────────────────────────────────────────────────
  resetSimulation: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    _stopPolling();
    try {
      const data = await apiService.resetSimulation(simulationId);
      set(_applyState(data, { allEvents: [], allForecasts: [], stageProfiles: [], result: null, selectedStep: null }));
      _startPolling(get);
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Next Step ───────────────────────────────────────────────────────────────
  nextStep: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    try {
      const data = await apiService.nextStep(simulationId);
      set(_applyState(data));
      // If completed, load full result
      if (data.status === 'completed') {
        _stopPolling();
        await get().loadResult();
      }
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Refresh status ──────────────────────────────────────────────────────────
  refreshStatus: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    try {
      const data = await apiService.getSimulatorStatus(simulationId);
      set(_applyState(data));
      if (data.status === 'completed' || data.status === 'stopped') {
        _stopPolling();
        if (data.status === 'completed') await get().loadResult();
      }
    } catch { /* network hiccup */ }
  },

  // ── Load full result ─────────────────────────────────────────────────────────
  loadResult: async () => {
    const { simulationId } = get();
    if (!simulationId) return;
    try {
      const result = await apiService.getSimulatorResult(simulationId);
      set({
        result,
        allEvents:     result.generated_events,
        allForecasts:  result.forecast_snapshots,
        stageProfiles: result.stage_profiles,
      });
    } catch (err) { set({ error: String(err) }); }
  },

  // ── Select step ─────────────────────────────────────────────────────────────
  selectStep: (step) => set({ selectedStep: step }),

  // ── Hard reset (clears everything) ─────────────────────────────────────────
  hardReset: () => {
    _stopPolling();
    set({ ..._initial, config: { ...DEFAULT_CONFIG }, scenarios: get().scenarios });
  },
}));
