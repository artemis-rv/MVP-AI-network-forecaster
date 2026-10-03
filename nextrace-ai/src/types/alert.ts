export type AlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type AlertStatus = "OPEN" | "ACKNOWLEDGED" | "IN_PROGRESS" | "RESOLVED";

export interface Alert {
  id: string;
  title: string;
  description: string;
  severity: AlertSeverity;
  status: AlertStatus;
  category: string;
  source_ip?: string;
  destination_ip?: string;
  protocol?: string;
  event_count: number;
  confidence: number;
  first_seen: string;
  last_seen: string;
  created_at: string;
  assigned_to?: string | null;
  acknowledged_at?: string | null;
  tags: string[];
  evidence: string[];
  simulation?: boolean;
  /** Grouped activity this alert aggregates (live / historical activity id). */
  activity_id?: string;
  /** Internal hosts impacted, e.g. "192.168.1.100 (Server) — Credential attack on login service". */
  affected_assets?: string[];
  /** Prioritised SOC actions, e.g. "[Immediate] Block 10.0.0.5 … — rationale". */
  recommended_actions?: string[];
  /** Plain-language explanation of what the activity means. */
  explanation?: string;
}

export interface AlertStats {
  total: number;
  open: number;
  acknowledged: number;
  in_progress: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface MitigationRequest {
  action: 'BLOCK_REMOTE_IP' | 'UNBLOCK_REMOTE_IP' | 'RATE_LIMIT_IP';
  target_host: string;
  remote_ip: string;
  direction?: 'inbound' | 'outbound' | 'both';
  duration_seconds?: number;
  analyst_id: string;
  reason: string;
  dry_run?: boolean;
}

export interface MitigationResult {
  action_id: string;
  status: 'SUCCESS' | 'DRY_RUN_SUCCESS' | 'REJECTED' | 'FAILED';
  action: string;
  remote_ip: string;
  target_host: string;
  rule_name: string;
  command_executed: string;
  analyst_id: string;
  timestamp: number;
  audit_hash: string;
  details: string;
}

