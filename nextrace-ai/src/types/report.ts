// NEXTRACE AI — Report TypeScript Types (Step 8)
// Completely isolated from live, forecast, historical, forensic, simulation types.

// ── Finding ───────────────────────────────────────────────────────────────────

export type FindingSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type FindingCategory =
  | 'Network Activity'
  | 'Suspicious Activity'
  | 'Attack Progression'
  | 'Evidence Integrity'
  | 'Anti-Forensic Indicator'
  | 'Hypothesis'
  | 'Forecast'
  | 'Simulation';

export type FindingSourceType = 'historical' | 'simulation' | 'live';

export interface Finding {
  id:          string;
  title:       string;
  category:    FindingCategory;
  severity:    FindingSeverity;
  confidence:  number;     // 0–100
  summary:     string;
  evidence:    string[];
  source_type: FindingSourceType;
  source_id:   string;
  created_at:  number;
}

// ── Report Section ────────────────────────────────────────────────────────────

export interface ReportSection {
  order:         number;
  title:         string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content:       Record<string, any>;
  evidence_refs: string[];
}

// ── Report ────────────────────────────────────────────────────────────────────

export type ReportType   = 'historical' | 'simulation' | 'live';
export type ReportStatus = 'GENERATED' | 'FAILED';

export interface ReportMetadata {
  job_id?:         string;
  simulation_id?:  string;
  filename?:       string;
  is_demo?:        boolean;
  forensic_id?:    string;
  scenario?:       string;
  k?:              number;
  status?:         string;
  generated_at:    number;
  analysis_status?: string;
  session_id?:     string;
  investigation_id?: string;
  entity_ip?:      string;
  capture_source?: string;
  /** Reports built in the browser from the current session / analysis state (not stored on the backend). */
  local?:          boolean;
  /** Headline figures shown at the top of the report and PDF, taken from the analysed data. */
  kpis?:           ReportKpi[];
}

export interface ReportKpi {
  label: string;
  value: string;
  tone?: 'critical' | 'high' | 'neutral';
}

export interface Report {
  report_id:    string;
  report_type:  ReportType;
  source_id:    string;
  title:        string;
  generated_at: number;
  status:       ReportStatus;
  sections:     ReportSection[];
  findings:     Finding[];
  disclaimer:   string;
  metadata:     ReportMetadata;
}

// ── Report List Item (summary) ────────────────────────────────────────────────

export interface ReportListItem {
  report_id:     string;
  report_type:   ReportType;
  source_id:     string;
  title:         string;
  generated_at:  number;
  status:        ReportStatus;
  finding_count: number;
}

// ── API response envelopes ─────────────────────────────────────────────────────

export interface GenerateReportResponse {
  report_id:     string;
  report_type:   ReportType;
  source_id:     string;
  title:         string;
  generated_at:  number;
  status:        ReportStatus;
  finding_count: number;
  section_count: number;
}

export interface FindingsResponse {
  job_id?:         string;
  simulation_id?:  string;
  finding_count:   number;
  findings:        Finding[];
}

export interface ReportListResponse {
  reports: ReportListItem[];
}
