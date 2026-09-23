// NEXTRACE AI — Simulator TypeScript Types (Step 7)
// Completely isolated from live, forecast, historical, forensic, investigation types.

// ── Configuration ─────────────────────────────────────────────────────────────

export type SimulatorStatus = 'idle' | 'running' | 'paused' | 'completed' | 'stopped';

export interface SimulatorConfig {
  scenario: string;
  k: number;
  window_seconds: number;
  speed: number;
}

// ── Synthetic Feature Profile ─────────────────────────────────────────────────
// Mirrors the temporal window feature schema for visual consistency

export interface SyntheticFeatureProfile {
  window_index: number;
  window_start: number;
  window_end: number;
  packet_count: number;
  byte_count: number;
  flow_count: number;
  unique_src_ips: number;
  unique_dst_ips: number;
  unique_dst_ports: number;
  tcp_count: number;
  udp_count: number;
  icmp_count: number;
  mean_packet_size: number;
  connection_rate: number;
  suspicious_ratio: number;
}

// ── Synthetic Event ───────────────────────────────────────────────────────────

export interface SimEvent {
  step: number;
  stage: string;
  timestamp: number;           // simulated epoch — not real wall clock
  source: string;              // reserved IP
  destination: string;         // reserved IP
  source_label: string;
  destination_label: string;
  protocol: string;
  source_port: number;
  destination_port: number;
  packet_count: number;
  byte_count: number;
  connection_count: number;
  synthetic_feature_profile: SyntheticFeatureProfile;
  disclaimer: string;
}

// ── Forecast Snapshot ─────────────────────────────────────────────────────────

export interface ForecastSnapshot {
  step: number;
  current_stage: string;
  predicted_next_stage: string;
  confidence: number;           // deterministic 0-100
  supporting_features: string[];
  time_window: string;
  target_entity: string;
}

// ── Stage Profile ─────────────────────────────────────────────────────────────

export interface StageProfile {
  step: number;
  name: string;
  description: string;
  feature_narrative: string[];
  packet_count: number;
  byte_count: number;
  connection_count: number;
  unique_dst_ports: number;
  connection_rate: number;
  suspicious_ratio: number;
}

// ── Simulator State (from /status endpoint) ───────────────────────────────────

export interface SimulatorStateResponse {
  simulation_id: string;
  scenario: string;
  scenario_label: string;
  k: number;
  status: SimulatorStatus;
  current_step: number;         // 0-indexed; -1 = not yet started
  total_steps: number;
  stage_sequence: string[];
  current_stage: string | null;
  current_event: SimEvent | null;
  current_forecast: ForecastSnapshot | null;
  completed_steps: number;
  disclaimer: string;
}

// ── Full Result ───────────────────────────────────────────────────────────────

export interface SimulatorResult {
  simulation_id: string;
  scenario: string;
  scenario_label: string;
  k: number;
  status: SimulatorStatus;
  current_step: number;
  total_steps: number;
  stage_sequence: string[];
  generated_events: SimEvent[];
  forecast_snapshots: ForecastSnapshot[];
  stage_profiles: StageProfile[];
  disclaimer: string;
}

// ── Scenario descriptor ───────────────────────────────────────────────────────

export interface ScenarioDescriptor {
  id: string;
  description: string;
}

export interface ScenariosResponse {
  scenarios: ScenarioDescriptor[];
  k_range: { min: number; max: number };
  valid_window_seconds: number[];
  valid_speeds: number[];
}
