// NEXTRACE AI — Forensic Analysis Types
// Completely isolated from live, forecast, and investigation types.

// ── Evidence Integrity ────────────────────────────────────────────────────────

export type IntegrityStatus = 'VERIFIED' | 'SIMULATED' | 'UNAVAILABLE';

export interface EvidenceIntegrity {
  status: IntegrityStatus;
  is_demo: boolean;
  sha256: string | null;
  filename: string;
  file_size: number;
  historical_job_id: string;
  upload_timestamp: number | null;
  processing_start: number | null;
  processing_completed: number | null;
  packet_count: number;
  flow_count: number;
  analysis_status: string;
  disclaimer: string;
}

// ── Evidence Summary ──────────────────────────────────────────────────────────

export interface EvidenceSummary {
  network_evidence: string[];
  temporal_evidence: string[];
  entity_evidence: string[];
}

// ── Anti-Forensic Indicators ──────────────────────────────────────────────────

export type IndicatorSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

export interface AntiForensicIndicator {
  id: string;
  type: string;
  severity: IndicatorSeverity;
  confidence: number;          // deterministic percentage 0-100
  timestamp: number | null;
  source: string;
  destination: string;
  description: string;
  evidence_basis: string;
  indicator_note: string;
}

// ── Hypotheses ────────────────────────────────────────────────────────────────

export type HypothesisStatus =
  | 'SUPPORTED'
  | 'PLAUSIBLE'
  | 'WEAK'
  | 'INSUFFICIENT_EVIDENCE';

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  confidence: number;           // deterministic percentage 0-100
  supporting_evidence: string[];
  contradicting_evidence: string[];
  limitations: string[];
  status: HypothesisStatus;
  prototype_note: string;
}

// ── Final Assessment ──────────────────────────────────────────────────────────

export interface FinalAssessment {
  assessment_text: string;
  overall_confidence: number;
  activity_pattern: string;
  key_evidence: string[];
  limitations: string[];
  anti_forensic_notes: string[];
  prototype_label: string;
  cautionary_note: string;
}

// ── Full Forensic Analysis Result ─────────────────────────────────────────────

export interface ForensicAnalysisResult {
  id: string;
  historical_job_id: string;
  status: 'completed';
  is_demo: boolean;
  created_at: number;
  integrity: EvidenceIntegrity;
  evidence_summary: EvidenceSummary;
  anti_forensic_indicators: AntiForensicIndicator[];
  hypotheses: Hypothesis[];
  final_assessment: FinalAssessment;
  prototype_disclaimer: string;
}

// ── API Response Envelope ─────────────────────────────────────────────────────

export type ForensicStatus = 'idle' | 'queued' | 'processing' | 'completed' | 'failed';

export interface ForensicStatusResponse {
  historical_job_id: string;
  forensic_id: string;
  status: ForensicStatus;
  progress: number;
  current_stage: string;
  error: string | null;
  created_at: number | null;
  completed_at: number | null;
}

export interface ForensicResultEnvelope {
  historical_job_id: string;
  forensic_id: string;
  status: 'completed';
  created_at: number;
  completed_at: number;
  result: ForensicAnalysisResult;
}
