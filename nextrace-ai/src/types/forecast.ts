// NEXTRACE AI — Forecast TypeScript Types
// Mirrors backend/models/schemas.py ForecastResult

export interface StageProbability {
  stage: string;
  probability: number;
}

export interface FeatureContribution {
  feature: string;
  value: number;
  weight: number; // 0–1 relative importance
}

export interface StateSequenceEntry {
  timestamp: number;   // Unix epoch float
  stage: string;
  window_end: number | string;
}

export interface ForecastResult {
  current_stage: string;
  predicted_next_stage: string;
  confidence: number;           // 0.0 – 1.0
  time_window: string;
  target: string;
  supporting_features: string[];
  feature_contributions: FeatureContribution[];
  state_sequence: StateSequenceEntry[];
  is_benign: boolean;
  demo_label: string;
  stage_probabilities: StageProbability[];
  /** Early forecast from the first, still-filling window — replaced when that window closes. */
  provisional?: boolean;
}

export const ATTACK_STAGES = [
  'Reconnaissance',
  'Initial Access',
  'Lateral Movement',
  'Data Exfiltration',
] as const;

export type AttackStage = typeof ATTACK_STAGES[number];

export const STAGE_COLORS: Record<string, { text: string; bg: string; border: string; glow: string }> = {
  'Reconnaissance':   { text: '#f59e0b', bg: '#fef3c7', border: '#f59e0b', glow: 'rgba(245,158,11,0.25)' },
  'Initial Access':   { text: '#f97316', bg: '#ffedd5', border: '#f97316', glow: 'rgba(249,115,22,0.25)' },
  'Lateral Movement': { text: '#ef4444', bg: '#fee2e2', border: '#ef4444', glow: 'rgba(239,68,68,0.30)' },
  'Data Exfiltration':{ text: '#dc2626', bg: '#fecaca', border: '#dc2626', glow: 'rgba(220,38,38,0.35)' },
  'Normal Activity':  { text: '#10b981', bg: '#d1fae5', border: '#10b981', glow: 'rgba(16,185,129,0.25)' },
  'No Active Session':{ text: '#94a3b8', bg: 'var(--bg-input)', border: 'var(--border-default)', glow: 'transparent' },
};
